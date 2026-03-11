package com.example.news_radar.controller;

import com.example.news_radar.entity.Keyword;
import com.example.news_radar.service.KeywordService;
import com.example.news_radar.service.NewsService;
import com.example.news_radar.service.CollectionProgressListener;
import com.example.news_radar.service.SseProgressListener;
import com.example.news_radar.dto.CollectionProgressEvent;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 시스템 초기화 API — 온보딩 시 기본 키워드 등록 + 첫 뉴스 수집 트리거
 */
@Slf4j
@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
public class SystemController {

    private final KeywordService keywordService;
    private final NewsService newsService;

    private static final List<String> DEFAULT_KEYWORDS = List.of("ai", "openai", "llm", "google");

    /**
     * POST /api/system/initialize
     * 기본 키워드 4개 등록 후 SSE 스트림으로 뉴스 수집 진행률을 반환한다.
     * 프론트엔드는 EventSource로 이 스트림을 구독하면 된다.
     */
    @PostMapping(value = "/initialize", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter initialize(@AuthenticationPrincipal Long userId) {
        log.info("[초기화] 온보딩 초기화 요청 수신: userId={}", userId);

        // 1. 기본 키워드 등록 (사용자별)
        List<String> registered = new ArrayList<>();
        for (String kw : DEFAULT_KEYWORDS) {
            keywordService.addKeyword(kw, userId).ifPresent(k -> registered.add(k.getName()));
        }
        log.info("[초기화] 기본 키워드 등록 완료: {}", registered);

        // 2. SSE 스트림으로 뉴스 수집 진행률 전달
        SseEmitter emitter = new SseEmitter(300_000L); // 5분 타임아웃

        SseProgressListener listener = new SseProgressListener(emitter);

        emitter.onCompletion(() -> newsService.removeProgressListener(listener));
        emitter.onTimeout(() -> {
            newsService.removeProgressListener(listener);
            emitter.complete();
        });
        emitter.onError(ex -> newsService.removeProgressListener(listener));

        // 키워드 등록 완료 이벤트 전송
        listener.onProgress(new CollectionProgressEvent(
                "KEYWORDS_REGISTERED", null,
                "기본 키워드 " + registered.size() + "개 등록 완료. 뉴스 수집을 시작합니다.",
                0, 0, 0, registered.size()));

        // 리스너 등록 후 수집 트리거
        newsService.addProgressListener(listener);
        newsService.manualCollect();

        return emitter;
    }

    /**
     * GET /api/system/status
     * 시스템 초기화 상태 확인 — 키워드가 하나라도 있으면 initialized
     */
    @GetMapping("/status")
    public Map<String, Object> getSystemStatus(@AuthenticationPrincipal Long userId) {
        List<Keyword> keywords = keywordService.getKeywordsByUser(userId);
        boolean initialized = !keywords.isEmpty();
        return Map.of(
                "initialized", initialized,
                "keywordCount", keywords.size()
        );
    }

    /**
     * DELETE /api/system/reset
     * 사용자 데이터 초기화 — 키워드(동의어 포함) + 관련 뉴스 소프트 삭제 → 온보딩 재진입
     */
    @DeleteMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetUserData(@AuthenticationPrincipal Long userId) {
        log.info("[리셋] 사용자 데이터 초기화 요청: userId={}", userId);

        List<Keyword> keywords = keywordService.getKeywordsByUser(userId);
        int keywordCount = keywords.size();

        // deleteKeyword 내부에서 뉴스 소프트 삭제 + 벡터 스토어 재빌드 처리
        for (Keyword kw : keywords) {
            keywordService.deleteKeyword(kw.getId(), userId);
        }

        log.info("[리셋] 완료: userId={}, deletedKeywords={}", userId, keywordCount);

        return ResponseEntity.ok(Map.of(
                "message", "사용자 데이터가 초기화되었습니다. 새로고침하면 온보딩이 다시 시작됩니다.",
                "deletedKeywords", keywordCount
        ));
    }
}
