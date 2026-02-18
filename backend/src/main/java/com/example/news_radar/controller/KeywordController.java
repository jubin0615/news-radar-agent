package com.example.news_radar.controller;

import com.example.news_radar.entity.Keyword;
import com.example.news_radar.service.KeywordService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// 검색 키워드 CRUD API
@RestController
@RequestMapping("/api/keywords")
@RequiredArgsConstructor
public class KeywordController {

    private final KeywordService keywordService;

    // 키워드 목록 조회
    @GetMapping
    public List<Keyword> getAllKeywords() {
        return keywordService.getAllKeywords();
    }

    // 키워드 등록
    @PostMapping
    public ResponseEntity<Keyword> addKeyword(@RequestParam String name) {
        return keywordService.addKeyword(name)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.badRequest().build());
    }

    // 키워드 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKeyword(@PathVariable @NonNull Long id) {
        return keywordService.deleteKeyword(id)
                ? ResponseEntity.ok().<Void>build()
                : ResponseEntity.notFound().build();
    }

    // 키워드 활성화/비활성화 토글
    @PutMapping("/{id}/toggle")
    public ResponseEntity<Keyword> toggleKeyword(@PathVariable @NonNull Long id) {
        return keywordService.toggleKeyword(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
