package com.example.news_radar.controller;

import com.example.news_radar.dto.CollectionStatus;
import com.example.news_radar.dto.NewsResponse;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.NewsRepository;
import com.example.news_radar.service.ImportanceEvaluator;
import com.example.news_radar.service.NewsService;
import com.example.news_radar.service.OpenAiService;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// 뉴스 조회·수집 API
@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsRepository newsRepository;
    private final OpenAiService openAiService;
    private final NewsService newsService;

    // 전체 뉴스 조회 (중요도 순) - content 제외한 DTO로 반환
    @GetMapping
    public List<NewsResponse> getAllNews() {
        return newsRepository.findAllByScore().stream()
                .map(this::toResponse)
                .toList();
    }

    // 키워드로 필터링 조회 (exact match → LIKE 폴백)
    @GetMapping("/search")
    public List<NewsResponse> searchByKeyword(@RequestParam String keyword) {
        List<News> results = newsRepository.findByKeywordLatest(keyword);
        if (results.isEmpty()) {
            results = newsRepository.searchByKeyword(keyword);
        }
        return results.stream()
                .map(this::toResponse)
                .toList();
    }

    // 중요도 N점 이상 필터링
    @GetMapping("/top")
    public List<NewsResponse> getTopNews(@RequestParam(defaultValue = "60") int minScore) {
        return newsRepository.findByMinScore(minScore).stream()
                .map(this::toResponse)
                .toList();
    }

    // 수동 뉴스 수집 (비동기, 즉시 반환)
    @PostMapping("/collect")
    public String collectNews() {
        return newsService.manualCollect();
    }

    // 수집 현황 조회 (대시보드용)
    @GetMapping("/collection-status")
    public CollectionStatus getCollectionStatus() {
        return newsService.getCollectionStatus();
    }

    // AI 요약 테스트
    @GetMapping("/ai-test")
    public String testAi(@RequestParam String title) {
        return openAiService.getSummary(title);
    }

    // News 엔티티 → NewsResponse DTO 변환 (content 제외)
    private NewsResponse toResponse(News news) {
        NewsResponse res = new NewsResponse();
        res.setId(news.getId());
        res.setTitle(news.getTitle());
        res.setUrl(news.getUrl());
        res.setKeyword(news.getKeyword());
        res.setSummary(news.getSummary());
        res.setImportanceScore(news.getImportanceScore());
        res.setCategory(news.getCategory());
        res.setAiReason(news.getAiReason());
        res.setCollectedAt(news.getCollectedAt());
        res.setGrade(news.getImportanceScore() == null
                ? "N/A"
                : ImportanceEvaluator.getGrade(news.getImportanceScore()));
        return res;
    }
}
