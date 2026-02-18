package com.example.news_radar.dto;

import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// AG-UI RunAgentInput 대응 DTO - 프론트엔드에서 에이전트에게 보내는 요청
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentRequest {
    private String threadId;            // 대화 스레드 식별자
    private String runId;               // 이번 실행 식별자
    private List<Message> messages;     // 대화 히스토리
    private Object state;               // 현재 상태
    private List<Tool> tools;           // 사용 가능한 도구 목록

    // 대화 메시지 (role: "user" | "assistant")
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Message {
        private String role;
        private String content;
    }

    // 프론트엔드에서 정의한 도구
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Tool {
        private String name;
        private Map<String, Object> input;
    }
}
