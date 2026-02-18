package com.example.news_radar.service;

import com.example.news_radar.crawler.CrawlerManager;
import com.example.news_radar.dto.AiEvaluation;
import com.example.news_radar.dto.CollectionStatus;
import com.example.news_radar.dto.RawNewsItem;
import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.KeywordRepository;
import com.example.news_radar.repository.NewsRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 뉴스 수집 서비스
 * - 매일 9시 자동 수집 (스케줄러)
 * - API 호출로 수동 수집
 * - 수집 진행 상황을 이벤트로 발행 (AG-UI 연동용)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NewsService {

    private final NewsRepository newsRepository;
    private final KeywordRepository keywordRepository;
    private final OpenAiService openAiService;
    private final CrawlerManager crawlerManager;
    private final ImportanceEvaluator importanceEvaluator;
    private final ApplicationEventPublisher publisher;  // 수집 진행 이벤트 발행용

    // 수집 중복 실행 방지 플래그
    private final AtomicBoolean collecting = new AtomicBoolean(false);
    // 마지막 수집 완료 시각 (CollectionStatus에서 사용)
    private volatile LocalDateTime lastCollectedAt;

    // Self-injection: @Async는 Spring AOP 프록시를 통해야 동작
    @Autowired
    @Lazy
    private NewsService self;

    // ==================== 수집 트리거 ====================

    // 자동 수집: 매일 아침 9시
    @Scheduled(cron = "0 0 9 * * *")
    public void scheduledCollect() {
        log.info("[자동 수집] 스케줄러 작동. time={}", now());
        self.collectByKeywordsAsync(null);
    }

    // 수동 수집: REST API 호출 (즉시 반환, 백그라운드 처리)
    public String manualCollect() {
        log.info("[수동 수집] API 호출 수집 시작. time={}", now());
        self.collectByKeywordsAsync(null);
        return "뉴스 수집을 시작했습니다. 백그라운드에서 처리 중입니다. (" + now() + ")";
    }

    // 수집 현황 조회 (대시보드용)
    public CollectionStatus getCollectionStatus() {
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.atTime(LocalTime.MAX);

        CollectionStatus status = new CollectionStatus();
        status.setCollecting(collecting.get());
        status.setTotalNewsCount(Math.toIntExact(newsRepository.count()));
        status.setTodayNewsCount(Math.toIntExact(newsRepository.countByCollectedAtBetween(start, end)));
        status.setActiveKeywordCount(keywordRepository.findByEnabledTrue().size());

        // 마지막 수집 시각: 메모리 캐시 → DB 조회 순서로 확인
        LocalDateTime latest = lastCollectedAt;
        if (latest == null) {
            latest = newsRepository.findTopByOrderByCollectedAtDesc()
                    .map(News::getCollectedAt)
                    .orElse(null);
        }
        status.setLastCollectedAt(latest);
        return status;
    }

    // ==================== 비동기 수집 로직 ====================

    // runId 없이 호출 (스케줄러/기존 API 호환용)
    @Async("newsCollectionExecutor")
    public void collectByKeywordsAsync() {
        collectByKeywordsAsync(null);
    }

    // 메인 수집 로직 (runId가 있으면 AG-UI 이벤트 발행)
    @Async("newsCollectionExecutor")
    public void collectByKeywordsAsync(String runId) {
        // 중복 실행 방지
        if (!collecting.compareAndSet(false, true)) {
            publish(runId, "FAILED", null, 0, 0, 0, "이미 뉴스 수집이 실행 중입니다.");
            return;
        }

        try {
            List<Keyword> activeKeywords = keywordRepository.findByEnabledTrue();
            if (activeKeywords.isEmpty()) {
                publish(runId, "FAILED", null, 0, 0, 0, "활성화된 키워드가 없습니다.");
                return;
            }

            publish(runId, "START", null, 0, activeKeywords.size(), 0, "뉴스 수집을 시작합니다.");

            List<String> keywordNames = activeKeywords.stream()
                    .map(Keyword::getName)
                    .collect(Collectors.toList());

            int totalSaved = 0;

            for (Keyword keyword : activeKeywords) {
                // 크롤러로 뉴스 수집
                List<RawNewsItem> items = crawlerManager.crawlAll(keyword.getName());

                int processed = 0;
                for (RawNewsItem item : items) {
                    processed++;

                    // URL 중복 체크 → 새 기사만 분석·저장
                    if (!newsRepository.existsByUrl(item.getUrl())) {
                        int kwScore = importanceEvaluator.calculateKeywordScore(
                                item.getTitle(), item.getContent(), keywordNames);

                        AiEvaluation aiEval = openAiService.evaluateImportance(
                                item.getTitle(), item.getContent(), keywordNames);

                        int finalScore = importanceEvaluator.calculateFinalScore(kwScore, aiEval.getScore());

                        News news = new News(item.getTitle(), item.getUrl(), keyword.getName());
                        news.setContent(item.getContent());
                        news.setKeywordMatchScore(kwScore);
                        news.setAiScore(aiEval.getScore());
                        news.setAiReason(aiEval.getReason());
                        news.setCategory(aiEval.getCategory());
                        news.setSummary(aiEval.getSummary());
                        news.setImportanceScore(finalScore);

                        newsRepository.save(news);
                        totalSaved++;
                    }

                    // 진행 상황 이벤트 발행
                    publish(runId, "PROGRESS", keyword.getName(),
                            processed, items.size(), totalSaved,
                            String.format("%s 처리 중 (%d/%d)", keyword.getName(), processed, items.size()));

                    sleep(1000); // API 429 방지
                }
            }

            lastCollectedAt = LocalDateTime.now();
            log.info("[수집 완료] 총 {}건 저장. time={}", totalSaved, now());
            publish(runId, "FINISHED", null, totalSaved, totalSaved, totalSaved, "뉴스 수집이 완료되었습니다.");

        } catch (Exception e) {
            log.error("[수집 실패] {}", e.getMessage(), e);
            publish(runId, "FAILED", null, 0, 0, 0, "수집 중 오류 발생: " + e.getMessage());
        } finally {
            collecting.set(false);
        }
    }

    // ==================== 이벤트·유틸 ====================

    // 수집 진행 이벤트 발행 (AgentService에서 @EventListener로 수신)
    private void publish(String runId, String stage, String keyword,
                         int processed, int total, int saved, String message) {
        publisher.publishEvent(new CollectionProgressEvent(
                runId, stage, keyword, processed, total, saved, message, System.currentTimeMillis()));
    }

    private String now() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    // 수집 진행 이벤트 객체 (AgentService에서 @EventListener로 수신)
    @Data
    @AllArgsConstructor
    public static class CollectionProgressEvent {
        private String runId;      // AG-UI 실행 ID (null이면 비-AG-UI 수집)
        private String stage;      // START / PROGRESS / FINISHED / FAILED
        private String keyword;    // 현재 처리 중인 키워드
        private int processed;     // 처리 완료 건수
        private int total;         // 전체 건수
        private int saved;         // 저장 건수
        private String message;    // 사용자에게 표시할 메시지
        private long timestamp;
    }
}
