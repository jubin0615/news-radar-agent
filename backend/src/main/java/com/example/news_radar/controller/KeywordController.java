package com.example.news_radar.controller;

import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.KeywordStatus;
import com.example.news_radar.service.KeywordService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 키워드 관리 API — 인증된 사용자별 키워드 격리
 *
 * GET    /api/keywords              — 내 키워드 조회
 * POST   /api/keywords?name=...     — 키워드 등록 (ACTIVE 상태로 생성)
 * DELETE /api/keywords/{id}         — 키워드 영구 삭제 (연결 뉴스 소프트 삭제)
 * PATCH  /api/keywords/{id}/status  — 상태 변경: ACTIVE | PAUSED | ARCHIVED
 *
 * @AuthenticationPrincipal Long userId — JWT 필터에서 설정한 사용자 ID
 */
@RestController
@RequestMapping("/api/keywords")
@RequiredArgsConstructor
public class KeywordController {

    private final KeywordService keywordService;

    @GetMapping
    public List<Keyword> getMyKeywords(@AuthenticationPrincipal Long userId) {
        return keywordService.getKeywordsByUser(userId);
    }

    @PostMapping
    public ResponseEntity<Keyword> addKeyword(@RequestParam String name,
                                              @AuthenticationPrincipal Long userId) {
        return keywordService.addKeyword(name, userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.badRequest().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKeyword(@PathVariable @NonNull Long id,
                                              @AuthenticationPrincipal Long userId) {
        return keywordService.deleteKeyword(id, userId)
                ? ResponseEntity.ok().<Void>build()
                : ResponseEntity.notFound().build();
    }

    /**
     * 키워드 상태 변경.
     * @param status ACTIVE | PAUSED | ARCHIVED
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<Keyword> setStatus(
            @PathVariable @NonNull Long id,
            @RequestParam KeywordStatus status,
            @AuthenticationPrincipal Long userId) {
        return keywordService.setStatus(id, status, userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
