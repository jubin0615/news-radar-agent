package com.example.news_radar.controller;

import com.example.news_radar.dto.RagResponse;
import com.example.news_radar.entity.Keyword;
import com.example.news_radar.service.KeywordService;
import com.example.news_radar.service.RagService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * RAG 기반 뉴스 Q&A API — 사용자 키워드 기반 격리
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final RagService ragService;
    private final KeywordService keywordService;

    @PostMapping("/rag")
    public ResponseEntity<RagResponse> ragQuery(
            @AuthenticationPrincipal Long userId,
            @RequestBody Map<String, String> body) {
        String question = body != null ? body.getOrDefault("question", "").trim() : "";
        if (question.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new RagResponse("질문을 입력해 주세요.", List.of()));
        }
        List<String> myKeywords = getUserKeywordNames(userId);
        return ResponseEntity.ok(ragService.ask(question, myKeywords, userId));
    }

    /** 오늘의 AI 트렌드 브리핑 — 사용자 키워드 기반 */
    @PostMapping("/trend-briefing")
    public ResponseEntity<RagResponse> trendBriefing(@AuthenticationPrincipal Long userId) {
        List<String> myKeywords = getUserKeywordNames(userId);
        return ResponseEntity.ok(ragService.trendBriefing(myKeywords));
    }

    private List<String> getUserKeywordNames(Long userId) {
        return keywordService.getKeywordsByUser(userId).stream()
                .map(Keyword::getName)
                .toList();
    }
}
