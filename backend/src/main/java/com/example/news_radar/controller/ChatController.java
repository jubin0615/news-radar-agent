package com.example.news_radar.controller;

import com.example.news_radar.dto.RagResponse;
import com.example.news_radar.service.RagService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * RAG 기반 뉴스 Q&A API
 *
 * POST /api/chat/rag
 * Request : { "question": "AI 반도체 동향은?" }
 * Response: { "answer": "...", "sources": [...] }
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final RagService ragService;

    @PostMapping("/rag")
    public ResponseEntity<RagResponse> ragQuery(@RequestBody Map<String, String> body) {
        String question = body != null ? body.getOrDefault("question", "").trim() : "";
        if (question.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new RagResponse("질문을 입력해 주세요.", List.of()));
        }
        return ResponseEntity.ok(ragService.ask(question));
    }
}
