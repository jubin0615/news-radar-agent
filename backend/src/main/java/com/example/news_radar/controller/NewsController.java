package com.example.news_radar.controller;

import com.example.news_radar.dto.CollectionStatus;
import com.example.news_radar.dto.NewsTrendResponse;
import com.example.news_radar.dto.NewsResponse;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.NewsRepository;
import com.example.news_radar.service.ImportanceEvaluator;
import com.example.news_radar.service.NewsService;
import com.example.news_radar.service.NewsTrendService;
import com.example.news_radar.service.OpenAiService;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.example.news_radar.dto.CollectionProgressEvent;
import com.example.news_radar.service.SseProgressListener;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// 뉴스 조회·수집 API
@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsRepository newsRepository;
    private final OpenAiService openAiService;
    private final NewsService newsService;
    private final NewsTrendService newsTrendService;

    // 전체 뉴스 조회 (중요도 순) - content 제외한 DTO로 반환
    // 날짜 필터 추가: ?date=2024-01-01
    @GetMapping
    public List<NewsResponse> getAllNews(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        if (date != null) {
            return newsRepository.findByCollectedAtBetween(date.atStartOfDay(), date.atTime(LocalTime.MAX)).stream()
                    .map(this::toResponse)
                    .toList();
        }
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

    // SSE 실시간 수집 진행 스트림 (수동 수집 + 진행률)
    @GetMapping(value = "/collect/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter collectStream() {
        SseEmitter emitter = new SseEmitter(300_000L); // 5분 타임아웃

        SseProgressListener listener = new SseProgressListener(emitter);

        // 클라이언트 연결 해제·타임아웃·오류 시 리스너 정리
        emitter.onCompletion(() -> newsService.removeProgressListener(listener));
        emitter.onTimeout(() -> {
            newsService.removeProgressListener(listener);
            emitter.complete();
        });
        emitter.onError(ex -> newsService.removeProgressListener(listener));

        // 이미 수집 중이면 late-join 이벤트 전송
        if (newsService.isCollecting()) {
            listener.onProgress(new CollectionProgressEvent(
                    "STARTED", null, "수집이 이미 진행 중입니다. 진행 상황을 표시합니다.",
                    0, 0, -1, null));
        }

        // 리스너 등록 후 비동기 수집 트리거 (이미 실행 중이면 내부에서 무시)
        newsService.addProgressListener(listener);
        newsService.manualCollect();

        return emitter;
    }

    // 키워드 재수집: 기존 뉴스 소프트 삭제 후 백그라운드 신규 수집 (즉시 반환)
    @PostMapping("/recollect")
    public String recollectNews(@RequestParam String keyword) {
        return newsService.recollectByKeyword(keyword);
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

    @GetMapping("/trends")
    public NewsTrendResponse getTrends(@RequestParam(defaultValue = "7") int days) {
        return newsTrendService.analyzeTrends(days);
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
