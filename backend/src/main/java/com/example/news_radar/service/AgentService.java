package com.example.news_radar.service;

import com.example.news_radar.dto.AgentEvent;
import com.example.news_radar.dto.AgentRequest;
import com.example.news_radar.dto.IntentResult;
import com.example.news_radar.dto.ReportResult;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.NewsRepository;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * AG-UI 에이전트 서비스
 * - LLM으로 사용자 의도를 파악하고 적절한 서비스를 호출
 * - 전체 대화 히스토리를 컨텍스트로 활용해 맥락을 이해한 응답 제공
 * - 진행 상황을 SSE 이벤트로 프론트엔드에 스트리밍
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final NewsService newsService;
    private final NewsRepository newsRepository;
    private final ReportService reportService;
    private final OpenAiService openAiService;

    // runId → SseEmitter 매핑 (실행 중인 에이전트의 SSE 연결 관리)
    private final ConcurrentMap<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    // ==================== 공개 메서드 ====================

    /**
     * 에이전트 실행 - SSE 연결을 열고 비동기로 요청 처리
     */
    public SseEmitter runAgent(AgentRequest request) {
        String runId = resolveId(request.getRunId());
        String threadId = resolveId(request.getThreadId(), "default-thread");

        // SSE 연결 생성 (타임아웃 무제한)
        SseEmitter emitter = new SseEmitter(0L);
        emitters.put(runId, emitter);

        // 연결 종료 시 emitter 맵에서 제거
        emitter.onCompletion(() -> emitters.remove(runId));
        emitter.onTimeout(() -> { emitters.remove(runId); emitter.complete(); });
        emitter.onError(e -> emitters.remove(runId));

        // 비동기로 요청 처리 시작
        CompletableFuture.runAsync(() -> processRequest(request, runId, threadId, emitter));
        return emitter;
    }

    /**
     * 뉴스 수집 진행 이벤트 수신 (NewsService에서 발행)
     * → 해당 runId의 SSE 연결로 진행 상황 전달
     */
    @EventListener
    public void onCollectionProgress(NewsService.CollectionProgressEvent event) {
        if (event.getRunId() == null || event.getRunId().isBlank()) return;

        SseEmitter emitter = emitters.get(event.getRunId());
        if (emitter == null) return;

        // 진행 상황 페이로드 구성
        Map<String, Object> payload = Map.of(
                "toolName", "collect_news",
                "keyword", String.valueOf(event.getKeyword()),
                "stage", event.getStage(),
                "processed", event.getProcessed(),
                "total", event.getTotal(),
                "saved", event.getSaved(),
                "message", event.getMessage()
        );

        sendEvent(emitter, "TOOL_CALL_CONTENT", event.getRunId(), payload);
        sendStateDelta(emitter, event.getRunId(), payload);

        // 수집 완료 또는 실패 시 실행 종료
        if ("FINISHED".equals(event.getStage())) {
            sendEvent(emitter, "TOOL_CALL_END", event.getRunId(), payload);
            sendText(emitter, event.getRunId(), "뉴스 수집이 완료되었습니다.");
            finishRun(emitter, event.getRunId(), "completed");
        } else if ("FAILED".equals(event.getStage())) {
            sendEvent(emitter, "TOOL_CALL_END", event.getRunId(), payload);
            sendText(emitter, event.getRunId(), event.getMessage());
            finishRun(emitter, event.getRunId(), "failed");
        }
    }

    // ==================== 요청 처리 ====================

    /**
     * LLM으로 전체 대화 컨텍스트를 분석해 의도를 파악하고 적절한 기능 실행
     * - "collect" → 뉴스 수집
     * - "report"  → 일일 리포트 생성
     * - "search"  → 키워드 뉴스 검색
     * - "chat"    → LLM 대화 응답 (맥락 반영)
     */
    private void processRequest(AgentRequest request, String runId, String threadId, SseEmitter emitter) {
        try {
            sendEvent(emitter, "RUN_STARTED", runId, Map.of("threadId", threadId, "runId", runId));

            List<AgentRequest.Message> messages = request.getMessages();
            if (messages == null || messages.isEmpty()) {
                sendText(emitter, runId, "요청 메시지가 비어 있습니다.");
                finishRun(emitter, runId, "failed");
                return;
            }

            // LLM으로 전체 대화 히스토리 기반 의도 분류
            IntentResult intent = openAiService.classifyIntent(messages);
            log.info("의도 분류 결과: action={}, keyword={}", intent.getAction(), intent.getKeyword());

            switch (intent.getAction()) {
                case "collect" -> handleCollect(emitter, runId);
                case "report"  -> handleDailyReport(emitter, runId);
                case "search"  -> handleSearch(emitter, runId, intent.getKeyword());
                default        -> handleChat(emitter, runId, messages);
            }
        } catch (Exception e) {
            log.error("에이전트 처리 실패: {}", e.getMessage(), e);
            sendText(emitter, runId, "요청 처리 중 오류가 발생했습니다: " + e.getMessage());
            finishRun(emitter, runId, "failed");
        }
    }

    // ---- 뉴스 수집 처리 ----
    private void handleCollect(SseEmitter emitter, String runId) {
        sendText(emitter, runId, "뉴스 수집을 시작합니다. 진행 상태를 실시간으로 전달합니다.");
        sendEvent(emitter, "TOOL_CALL_START", runId,
                Map.of("toolName", "collect_news", "input", Map.of("command", "collect")));
        // 비동기 수집 시작 (진행 상황은 onCollectionProgress로 수신)
        newsService.collectByKeywordsAsync(runId);
    }

    // ---- 일일 리포트 처리 ----
    private void handleDailyReport(SseEmitter emitter, String runId) {
        sendEvent(emitter, "TOOL_CALL_START", runId, Map.of("toolName", "daily_report"));

        ReportResult report = reportService.generateDailyReport();
        int count = report.getStats().getTotalCount();
        double avgScore = report.getStats().getAverageScore();

        Map<String, Object> result = Map.of(
                "toolName", "daily_report",
                "totalCount", count,
                "averageScore", avgScore
        );
        sendEvent(emitter, "TOOL_CALL_END", runId, result);
        sendStateDelta(emitter, runId, result);
        sendText(emitter, runId,
                String.format("오늘 리포트를 생성했습니다. 총 %d건, 평균 중요도 %.1f점입니다.", count, avgScore));
        finishRun(emitter, runId, "completed");
    }

    // ---- 뉴스 검색 처리 ----
    private void handleSearch(SseEmitter emitter, String runId, String keyword) {
        List<News> newsList;

        if (keyword != null && !keyword.isBlank()) {
            sendEvent(emitter, "TOOL_CALL_START", runId,
                    Map.of("toolName", "search_news", "keyword", keyword));

            // 1차: keyword 필드 exact match
            newsList = newsRepository.findByKeywordLatest(keyword);

            // 2차: exact match 결과 없으면 제목·본문·키워드 LIKE 검색
            if (newsList.isEmpty()) {
                newsList = newsRepository.searchByKeyword(keyword);
            }
        } else {
            sendEvent(emitter, "TOOL_CALL_START", runId, Map.of("toolName", "search_news"));
            newsList = newsRepository.findAllByScore();
        }

        List<News> top5 = newsList.stream().limit(5).toList();

        Map<String, Object> result = new HashMap<>();
        result.put("toolName", "search_news");
        result.put("keyword", keyword);
        result.put("count", top5.size());
        sendEvent(emitter, "TOOL_CALL_END", runId, result);
        sendStateDelta(emitter, runId, result);
        sendText(emitter, runId, buildNewsReply(keyword, top5));
        finishRun(emitter, runId, "completed");
    }

    // ---- 일반 대화 처리 (전체 메시지 컨텍스트 반영) ----
    private void handleChat(SseEmitter emitter, String runId, List<AgentRequest.Message> messages) {
        String response = openAiService.chatWithContext(messages);
        sendText(emitter, runId, response);
        finishRun(emitter, runId, "completed");
    }

    // ==================== 뉴스 결과 포맷 ====================

    // 뉴스 검색 결과를 텍스트 메시지로 변환
    private String buildNewsReply(String keyword, List<News> newsList) {
        if (newsList.isEmpty()) {
            return keyword == null
                    ? "표시할 뉴스가 없습니다."
                    : keyword + " 관련 뉴스를 찾지 못했습니다.";
        }

        List<String> lines = new ArrayList<>();
        lines.add(keyword == null ? "최신 주요 뉴스입니다." : keyword + " 관련 최신 뉴스입니다.");

        int rank = 1;
        for (News news : newsList) {
            String score = news.getImportanceScore() == null ? "N/A" : String.valueOf(news.getImportanceScore());
            lines.add(String.format("%d. [%s점] %s", rank++, score, news.getTitle()));
        }
        return String.join("\n", lines);
    }

    // ==================== SSE 이벤트 전송 유틸 ====================

    // 텍스트 메시지를 토큰 단위로 스트리밍 (AG-UI TEXT_MESSAGE 이벤트)
    private void sendText(SseEmitter emitter, String runId, String text) {
        sendEvent(emitter, "TEXT_MESSAGE_START", runId, Map.of("role", "assistant"));
        for (String token : text.split(" ")) {
            sendEvent(emitter, "TEXT_MESSAGE_CONTENT", runId, Map.of("delta", token + " "));
        }
        sendEvent(emitter, "TEXT_MESSAGE_END", runId, Map.of("length", text.length()));
    }

    // 상태 변경 이벤트 전송 (AG-UI STATE_DELTA - JSON Patch 형식)
    private void sendStateDelta(SseEmitter emitter, String runId, Map<String, Object> state) {
        Map<String, Object> patch = Map.of(
                "op", "replace",
                "path", "/state/latest",
                "value", state
        );
        sendEvent(emitter, "STATE_DELTA", runId, List.of(patch));
    }

    // 실행 종료 이벤트 전송 + SSE 연결 닫기
    private void finishRun(SseEmitter emitter, String runId, String status) {
        sendEvent(emitter, "RUN_FINISHED", runId, Map.of("status", status));
        emitters.remove(runId);
        emitter.complete();
    }

    // SSE 이벤트 전송 (공통)
    private void sendEvent(SseEmitter emitter, String type, String runId, Object data) {
        AgentEvent event = new AgentEvent(type, runId, data, System.currentTimeMillis());
        try {
            emitter.send(SseEmitter.event().name(type).data(event));
        } catch (IOException e) {
            log.warn("SSE 이벤트 전송 실패: {}", e.getMessage());
            emitters.remove(runId);
            emitter.completeWithError(e);
        }
    }

    // ID가 비어있으면 UUID 생성
    private String resolveId(String id) {
        return (id == null || id.isBlank()) ? UUID.randomUUID().toString() : id;
    }

    private String resolveId(String id, String defaultVal) {
        return (id == null || id.isBlank()) ? defaultVal : id;
    }
}
