package com.example.news_radar.controller;

import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.KeywordStatus;
import com.example.news_radar.service.KeywordService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 키워드 관리 API
 *
 * GET    /api/keywords              — 전체 키워드 조회
 * POST   /api/keywords?name=...     — 키워드 등록 (ACTIVE 상태로 생성)
 * DELETE /api/keywords/{id}         — 키워드 영구 삭제 (연결 뉴스 소프트 삭제)
 * PATCH  /api/keywords/{id}/status  — 상태 변경: ACTIVE | PAUSED | ARCHIVED
 */
@RestController
@RequestMapping("/api/keywords")
@RequiredArgsConstructor
public class KeywordController {

    private final KeywordService keywordService;

    @GetMapping
    public List<Keyword> getAllKeywords() {
        return keywordService.getAllKeywords();
    }

    @PostMapping
    public ResponseEntity<Keyword> addKeyword(@RequestParam String name) {
        return keywordService.addKeyword(name)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.badRequest().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKeyword(@PathVariable @NonNull Long id) {
        return keywordService.deleteKeyword(id)
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
            @RequestParam KeywordStatus status) {
        return keywordService.setStatus(id, status)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
