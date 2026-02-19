package com.example.news_radar.service;

import com.example.news_radar.dto.AgentEvent;
import com.example.news_radar.dto.AgentRequest;
import com.example.news_radar.dto.ReportResult;
import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.KeywordRepository;
import com.example.news_radar.repository.NewsRepository;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * AG-UI 에이전트 서비스 (대화형 에이전트)
 * - LLM이 자연스럽게 대화하며, 필요할 때 도구를 호출하는 진정한 에이전트
 * - 전체 대화 히스토리를 컨텍스트로 활용해 맥락을 이해한 응답 제공
 * - 진행 상황을 SSE 이벤트로 프론트엔드에 스트리밍
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final NewsService newsService;
    private final NewsRepository newsRepository;
    private final KeywordRepository keywordRepository;
    private final ReportService reportService;
    private final OpenAiService openAiService;

    // runId → SseEmitter 매핑 (실행 중인 에이전트의 SSE 연결 관리)
    private final ConcurrentMap<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    // ==================== 공개 메서드 ====================

    public SseEmitter runAgent(AgentRequest request) {
        String runId = resolveId(request.getRunId());
        String threadId = resolveId(request.getThreadId(), "default-thread");

        SseEmitter emitter = new SseEmitter(0L);
        emitters.put(runId, emitter);

        emitter.onCompletion(() -> emitters.remove(runId));
        emitter.onTimeout(() -> { emitters.remove(runId); emitter.complete(); });
        emitter.onError(e -> emitters.remove(runId));

        CompletableFuture.runAsync(() -> processRequest(request, runId, threadId, emitter));
        return emitter;
    }

    /**
     * 뉴스 수집 진행 이벤트 수신 (NewsService에서 발행)
     */
    @EventListener
    public void onCollectionProgress(NewsService.CollectionProgressEvent event) {
        if (event.getRunId() == null || event.getRunId().isBlank()) return;

        SseEmitter emitter = emitters.get(event.getRunId());
        if (emitter == null) return;

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

        if ("FINISHED".equals(event.getStage())) {
            sendEvent(emitter, "TOOL_CALL_END", event.getRunId(), payload);
            sendText(emitter, event.getRunId(),
                    String.format("뉴스 수집이 완료되었습니다! 총 %d건의 새 뉴스를 수집하고 AI 분석을 마쳤습니다.", event.getSaved()));
            finishRun(emitter, event.getRunId(), "completed");
        } else if ("FAILED".equals(event.getStage())) {
            sendEvent(emitter, "TOOL_CALL_END", event.getRunId(), payload);
            sendText(emitter, event.getRunId(), event.getMessage());
            finishRun(emitter, event.getRunId(), "failed");
        }
    }

    // ==================== 요청 처리 ====================

    private void processRequest(AgentRequest request, String runId, String threadId, SseEmitter emitter) {
        try {
            sendEvent(emitter, "RUN_STARTED", runId, Map.of("threadId", threadId, "runId", runId));

            List<AgentRequest.Message> messages = request.getMessages();
            if (messages == null || messages.isEmpty()) {
                sendText(emitter, runId, "요청 메시지가 비어 있습니다.");
                finishRun(emitter, runId, "failed");
                return;
            }

            // 현재 시스템 상태 구성 (LLM에게 컨텍스트 제공)
            String systemContext = buildSystemContext();

            // LLM에게 대화 + 시스템 상태를 보내고, 자연스러운 응답 또는 도구 호출을 받음
            OpenAiService.AgentLlmResponse llmResponse = openAiService.agentChat(messages, systemContext);

            if (llmResponse.hasToolCall()) {
                // LLM이 도구 사용을 결정한 경우
                OpenAiService.ToolCall toolCall = llmResponse.toolCall();
                String toolMessage = toolCall.message();

                // 도구 실행 전 안내 메시지
                if (toolMessage != null && !toolMessage.isBlank()) {
                    sendText(emitter, runId, toolMessage);
                }

                switch (toolCall.tool()) {
                    case "search_news" -> handleSearch(emitter, runId, toolCall.keyword());
                    case "collect_news" -> handleCollect(emitter, runId);
                    case "generate_report" -> handleDailyReport(emitter, runId);
                    default -> {
                        sendText(emitter, runId, "알 수 없는 도구입니다: " + toolCall.tool());
                        finishRun(emitter, runId, "failed");
                    }
                }
            } else {
                // 일반 대화 응답
                sendText(emitter, runId, llmResponse.textResponse());
                finishRun(emitter, runId, "completed");
            }
        } catch (Exception e) {
            log.error("에이전트 처리 실패: {}", e.getMessage(), e);
            sendText(emitter, runId, "요청 처리 중 오류가 발생했습니다: " + e.getMessage());
            finishRun(emitter, runId, "failed");
        }
    }

    /**
     * 현재 시스템 상태를 문자열로 구성 (LLM이 상황을 파악할 수 있도록)
     */
    private String buildSystemContext() {
        List<Keyword> activeKeywords = keywordRepository.findByEnabledTrue();
        long totalNews = newsRepository.count();

        LocalDate today = LocalDate.now();
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime todayEnd = today.atTime(LocalTime.MAX);
        long todayNews = newsRepository.countByCollectedAtBetween(todayStart, todayEnd);

        StringBuilder ctx = new StringBuilder();
        ctx.append("- 등록된 키워드: ");
        if (activeKeywords.isEmpty()) {
            ctx.append("없음 (키워드를 먼저 등록해야 뉴스 수집이 가능합니다)");
        } else {
            ctx.append(activeKeywords.stream().map(Keyword::getName).collect(Collectors.joining(", ")));
        }
        ctx.append("\n");
        ctx.append("- 총 수집된 뉴스: ").append(totalNews).append("건\n");
        ctx.append("- 오늘 수집된 뉴스: ").append(todayNews).append("건\n");
        ctx.append("- 현재 날짜: ").append(today).append("\n");

        if (totalNews == 0) {
            ctx.append("- 주의: 아직 수집된 뉴스가 없습니다. 사용자가 뉴스를 검색하거나 리포트를 요청하면 먼저 뉴스 수집을 제안하세요.\n");
        }

        return ctx.toString();
    }

    // ---- 뉴스 수집 처리 ----
    private void handleCollect(SseEmitter emitter, String runId) {
        // 키워드 체크
        List<Keyword> activeKeywords = keywordRepository.findByEnabledTrue();
        if (activeKeywords.isEmpty()) {
            sendText(emitter, runId,
                    "현재 등록된 키워드가 없어서 뉴스를 수집할 수 없습니다.\n" +
                    "키워드를 먼저 등록해주세요. 사이드바의 키워드 관리 메뉴에서 추가할 수 있습니다.");
            finishRun(emitter, runId, "completed");
            return;
        }

        sendEvent(emitter, "TOOL_CALL_START", runId,
                Map.of("toolName", "collect_news", "input", Map.of("command", "collect")));
        newsService.collectByKeywordsAsync(runId);
    }

    // ---- 일일 리포트 처리 ----
    private void handleDailyReport(SseEmitter emitter, String runId) {
        // 뉴스가 있는지 먼저 체크
        long totalNews = newsRepository.count();
        if (totalNews == 0) {
            sendText(emitter, runId,
                    "아직 수집된 뉴스가 없어서 리포트를 생성할 수 없습니다.\n" +
                    "먼저 \"뉴스 수집해줘\"라고 말씀해 주시면 최신 뉴스를 수집한 후 리포트를 만들어 드리겠습니다.");
            finishRun(emitter, runId, "completed");
            return;
        }

        sendEvent(emitter, "TOOL_CALL_START", runId, Map.of("toolName", "daily_report"));

        // 오늘 뉴스가 없으면 전체 뉴스로 리포트 생성
        ReportResult report;
        LocalDate today = LocalDate.now();
        long todayCount = newsRepository.countByCollectedAtBetween(
                today.atStartOfDay(), today.atTime(LocalTime.MAX));

        if (todayCount > 0) {
            report = reportService.generateDailyReport();
        } else {
            // 오늘 뉴스가 없으면 전체 뉴스로 리포트
            report = reportService.generateAllNewsReport();
        }

        int count = report.getStats().getTotalCount();
        double avgScore = report.getStats().getAverageScore();

        Map<String, Object> result = Map.of(
                "toolName", "daily_report",
                "totalCount", count,
                "averageScore", avgScore
        );
        sendEvent(emitter, "TOOL_CALL_END", runId, result);
        sendStateDelta(emitter, runId, result);

        String msg;
        if (count == 0) {
            msg = "수집된 뉴스가 없어 리포트를 생성할 수 없습니다. 먼저 뉴스를 수집해주세요.";
        } else if (todayCount > 0) {
            msg = String.format("오늘의 뉴스 리포트를 생성했습니다!\n총 %d건의 뉴스를 분석했고, 평균 중요도는 %.1f점입니다.\n리포트를 클릭하면 상세 내용을 확인할 수 있습니다.", count, avgScore);
        } else {
            msg = String.format("전체 수집된 뉴스 리포트를 생성했습니다!\n총 %d건의 뉴스를 분석했고, 평균 중요도는 %.1f점입니다.\n(오늘 수집된 뉴스가 없어 전체 뉴스를 기준으로 생성했습니다)", count, avgScore);
        }

        sendText(emitter, runId, msg);
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

        List<News> top = newsList.stream().limit(10).toList();

        Map<String, Object> result = new HashMap<>();
        result.put("toolName", "search_news");
        result.put("keyword", keyword);
        result.put("count", top.size());
        sendEvent(emitter, "TOOL_CALL_END", runId, result);
        sendStateDelta(emitter, runId, result);

        if (top.isEmpty() && newsRepository.count() == 0) {
            sendText(emitter, runId,
                    "아직 수집된 뉴스가 없습니다.\n\"뉴스 수집해줘\"라고 말씀해 주시면 최신 뉴스를 수집해 드리겠습니다.");
        } else if (top.isEmpty()) {
            sendText(emitter, runId,
                    (keyword != null ? "\"" + keyword + "\" 관련 뉴스를 찾지 못했습니다." : "표시할 뉴스가 없습니다.") +
                    "\n다른 키워드로 검색하거나, \"뉴스 수집해줘\"로 최신 뉴스를 가져올 수 있습니다.");
        } else {
            sendText(emitter, runId, buildNewsReply(keyword, top));
        }

        finishRun(emitter, runId, "completed");
    }

    // ==================== 뉴스 결과 포맷 ====================

    private String buildNewsReply(String keyword, List<News> newsList) {
        List<String> lines = new ArrayList<>();

        if (keyword == null || keyword.isBlank()) {
            lines.add("최신 주요 뉴스입니다.");
        } else {
            lines.add("\"" + keyword + "\" 관련 뉴스를 찾았습니다.");
        }

        int rank = 1;
        for (News news : newsList) {
            String grade = news.getImportanceScore() != null
                    ? ImportanceEvaluator.getGrade(news.getImportanceScore()) : "N/A";
            String score = news.getImportanceScore() == null ? "N/A" : String.valueOf(news.getImportanceScore());
            lines.add(String.format("%d. [%s·%s점] %s", rank++, grade, score, news.getTitle()));
        }

        lines.add("\n위 뉴스 카드를 클릭하면 원문 기사를 확인할 수 있습니다.");
        return String.join("\n", lines);
    }

    // ==================== SSE 이벤트 전송 유틸 ====================

    private void sendText(SseEmitter emitter, String runId, String text) {
        sendEvent(emitter, "TEXT_MESSAGE_START", runId, Map.of("role", "assistant"));
        // 한글은 공백 분할보다 작은 청크 단위가 더 자연스러움
        for (String token : splitForStreaming(text)) {
            sendEvent(emitter, "TEXT_MESSAGE_CONTENT", runId, Map.of("delta", token));
        }
        sendEvent(emitter, "TEXT_MESSAGE_END", runId, Map.of("length", text.length()));
    }

    /**
     * 텍스트를 스트리밍용 토큰으로 분할
     * - 한국어 특성상 공백 기준으로 2~3어절씩 묶어서 전송
     */
    private List<String> splitForStreaming(String text) {
        List<String> tokens = new ArrayList<>();
        String[] words = text.split("(?<= )");  // 공백 뒤에서 분할 (공백 유지)
        StringBuilder buf = new StringBuilder();
        int count = 0;
        for (String word : words) {
            buf.append(word);
            count++;
            if (count >= 2) {
                tokens.add(buf.toString());
                buf.setLength(0);
                count = 0;
            }
        }
        if (!buf.isEmpty()) {
            tokens.add(buf.toString());
        }
        return tokens;
    }

    private void sendStateDelta(SseEmitter emitter, String runId, Map<String, Object> state) {
        Map<String, Object> patch = Map.of(
                "op", "replace",
                "path", "/state/latest",
                "value", state
        );
        sendEvent(emitter, "STATE_DELTA", runId, List.of(patch));
    }

    private void finishRun(SseEmitter emitter, String runId, String status) {
        sendEvent(emitter, "RUN_FINISHED", runId, Map.of("status", status));
        emitters.remove(runId);
        emitter.complete();
    }

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

    private String resolveId(String id) {
        return (id == null || id.isBlank()) ? UUID.randomUUID().toString() : id;
    }

    private String resolveId(String id, String defaultVal) {
        return (id == null || id.isBlank()) ? defaultVal : id;
    }
}
