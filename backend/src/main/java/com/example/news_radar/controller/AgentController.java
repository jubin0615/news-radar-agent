package com.example.news_radar.controller;

import com.example.news_radar.dto.AgentRequest;
import com.example.news_radar.service.AgentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// AG-UI 에이전트 엔드포인트 - POST 요청을 받아 SSE 이벤트 스트림 반환
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;

    // 프론트엔드에서 에이전트 실행 요청 → SSE 스트림으로 진행 상황 전달
    @PostMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter runAgent(@RequestBody AgentRequest request) {
        return agentService.runAgent(request);
    }
}
