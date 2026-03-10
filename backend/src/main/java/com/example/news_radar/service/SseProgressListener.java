package com.example.news_radar.service;

import com.example.news_radar.dto.CollectionProgressEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Set;

/**
 * SseEmitter 기반 진행률 리스너.
 * 수집 파이프라인의 각 단계에서 발행되는 이벤트를 SSE 스트림으로 클라이언트에 전달한다.
 * userId + 사용자 키워드를 보유하여, 본인과 관련된 이벤트만 수신한다.
 */
@Slf4j
public class SseProgressListener implements CollectionProgressListener {

    private final SseEmitter emitter;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 이 SSE 세션의 소유자 userId */
    @Getter
    private final Long userId;

    /** 이 사용자가 등록한 키워드 이름 목록 (소문자, 이벤트 매칭용) */
    private final Set<String> userKeywordsLower;

    /** 사용자별 격리 생성자 — 관련 키워드 이벤트만 수신 */
    public SseProgressListener(SseEmitter emitter, Long userId, Set<String> userKeywords) {
        this.emitter = emitter;
        this.userId = userId;
        this.userKeywordsLower = userKeywords != null
                ? userKeywords.stream().map(String::toLowerCase).collect(java.util.stream.Collectors.toSet())
                : Set.of();
    }

    /** 글로벌 리스너 생성자 — 모든 이벤트 수신 (시스템 초기화 등) */
    public SseProgressListener(SseEmitter emitter) {
        this(emitter, null, null);
    }

    /**
     * 이벤트가 이 사용자에게 전달되어야 하는지 판단.
     * - 글로벌 이벤트(keyword == null): STARTED, COMPLETED, ERROR → 모든 사용자에게 전달
     * - 키워드별 이벤트: 사용자의 키워드와 일치할 때만 전달
     */
    public boolean isRelevant(CollectionProgressEvent event) {
        // 글로벌 리스너(userId == null)는 모든 이벤트 수신
        if (userId == null) return true;
        // 글로벌 이벤트(keyword == null): STARTED, COMPLETED, ERROR → 모든 사용자에게 전달
        if (event.getKeyword() == null || event.getKeyword().isBlank()) {
            return true;
        }
        // 키워드별 이벤트: 사용자의 키워드와 일치할 때만 전달
        return userKeywordsLower.contains(event.getKeyword().toLowerCase());
    }

    @Override
    public void onProgress(CollectionProgressEvent event) {
        try {
            String json = objectMapper.writeValueAsString(event);
            emitter.send(SseEmitter.event()
                    .name(event.getType())
                    .data(json));
        } catch (Exception e) {
            log.warn("[SSE] 이벤트 전송 실패 (클라이언트 연결 끊김 가능): {}", e.getMessage());
        }
    }

    public void complete() {
        try {
            emitter.complete();
        } catch (Exception e) {
            log.warn("[SSE] emitter 완료 처리 실패: {}", e.getMessage());
        }
    }
}
