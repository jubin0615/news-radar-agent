package com.example.news_radar.controller;

import com.example.news_radar.dto.CollectionStatus;
import com.example.news_radar.dto.NewsTrendResponse;
import com.example.news_radar.dto.NewsResponse;
import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.NewsRepository;
import com.example.news_radar.service.ImportanceEvaluator;
import com.example.news_radar.service.KeywordService;
import com.example.news_radar.service.NewsService;
import com.example.news_radar.service.NewsTrendService;
import com.example.news_radar.service.OpenAiService;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import com.example.news_radar.dto.CollectionProgressEvent;
import com.example.news_radar.service.SseProgressListener;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// 뉴스 조회·수집 API — 인증된 사용자의 키워드 기반 격리
@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsRepository newsRepository;
    private final OpenAiService openAiService;
    private final NewsService newsService;
    private final NewsTrendService newsTrendService;
    private final KeywordService keywordService;

    /** 사용자의 키워드 이름 목록 조회 */
    private List<String> getUserKeywordNames(Long userId) {
        return keywordService.getKeywordsByUser(userId).stream()
                .map(Keyword::getName)
                .toList();
    }

    // 전체 뉴스 조회 (중요도 순, 사용자 키워드 기반)
    @GetMapping
    public List<NewsResponse> getAllNews(
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<String> myKeywords = getUserKeywordNames(userId);
        if (myKeywords.isEmpty()) return List.of();

        if (date != null) {
            return newsRepository.findByKeywordInAndCollectedAtBetween(
                            myKeywords, date.atStartOfDay(), date.atTime(LocalTime.MAX)).stream()
                    .map(this::toResponse)
                    .toList();
        }
        return newsRepository.findByKeywordInOrderByScore(myKeywords).stream()
                .map(this::toResponse)
                .toList();
    }

    // 키워드로 필터링 조회 — 사용자 본인의 키워드인지 검증
    @GetMapping("/search")
    public List<NewsResponse> searchByKeyword(
            @AuthenticationPrincipal Long userId,
            @RequestParam String keyword) {
        List<String> myKeywords = getUserKeywordNames(userId);
        boolean isOwned = myKeywords.stream().anyMatch(k -> k.equalsIgnoreCase(keyword));
        if (!isOwned) return List.of();

        List<News> results = newsRepository.findByKeywordLatest(keyword);
        if (results.isEmpty()) {
            results = newsRepository.searchByKeyword(keyword);
        }
        return results.stream()
                .map(this::toResponse)
                .toList();
    }

    // 중요도 N점 이상 필터링 (사용자 키워드 기반)
    @GetMapping("/top")
    public List<NewsResponse> getTopNews(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "60") int minScore) {
        List<String> myKeywords = getUserKeywordNames(userId);
        if (myKeywords.isEmpty()) return List.of();

        return newsRepository.findByMinScore(minScore).stream()
                .filter(n -> myKeywords.stream().anyMatch(k -> k.equalsIgnoreCase(n.getKeyword())))
                .map(this::toResponse)
                .toList();
    }

    // 최근 48시간 브리핑용 뉴스 조회 (사용자 키워드 기반)
    @GetMapping("/briefing")
    public List<NewsResponse> getBriefingNews(
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "48") int hours,
            @RequestParam(defaultValue = "5") int limit) {
        List<String> myKeywords = getUserKeywordNames(userId);
        if (myKeywords.isEmpty()) return List.of();

        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        return newsRepository.findRecentBriefingNewsByKeywords(myKeywords, since).stream()
                .limit(limit)
                .map(this::toResponse)
                .toList();
    }

    // 수동 뉴스 수집 (비동기, 즉시 반환)
    @PostMapping("/collect")
    public String collectNews() {
        return newsService.manualCollect();
    }

    // SSE 실시간 수집 진행 스트림 (수동 수집 + 진행률) — 사용자별 격리
    @GetMapping(value = "/collect/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter collectStream(@AuthenticationPrincipal Long userId) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5분 타임아웃

        // 사용자의 키워드 목록을 Set으로 전달 → 관련 이벤트만 수신
        Set<String> myKeywords = getUserKeywordNames(userId).stream()
                .collect(Collectors.toSet());
        SseProgressListener listener = new SseProgressListener(emitter, userId, myKeywords);

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

    // AI 분석 실패 뉴스 재분석 (DNS 장애 등 복구 후 일괄 재시도)
    @PostMapping("/retry-analysis")
    public String retryFailedAnalysis() {
        int count = newsService.retryFailedAnalysis();
        return count > 0
                ? count + "건의 뉴스를 재분석 완료했습니다."
                : "재분석할 실패 뉴스가 없습니다.";
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
