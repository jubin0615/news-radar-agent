package com.example.news_radar.service;

import com.example.news_radar.dto.CollectionProgressEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * SseEmitter 기반 진행률 리스너.
 * 수집 파이프라인의 각 단계에서 발행되는 이벤트를 SSE 스트림으로 클라이언트에 전달한다.
 */
@Slf4j
public class SseProgressListener implements CollectionProgressListener {

    private final SseEmitter emitter;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SseProgressListener(SseEmitter emitter) {
        this.emitter = emitter;
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
