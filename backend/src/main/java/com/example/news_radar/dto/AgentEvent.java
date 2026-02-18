package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// AG-UI BaseEvent 대응 DTO - SSE로 프론트엔드에 전송되는 이벤트
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentEvent {
    private String type;       // 이벤트 타입 (RUN_STARTED, TEXT_MESSAGE_CONTENT 등)
    private String runId;      // 실행 식별자
    private Object data;       // 이벤트별 페이로드
    private long timestamp;    // 이벤트 발생 시각 (epoch millis)
}
