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

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 뉴스 수집 서비스
 * - 매일 9시 자동 수집 (스케줄러)
 * - API 호출로 수동 수집
 * - 키워드별 재수집 (Soft Delete 후 신규 수집)
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
    private final NewsVectorStoreService newsVectorStoreService;

    // 수집 중복 실행 방지 플래그
    private final AtomicBoolean collecting = new AtomicBoolean(false);
    // 마지막 수집 완료 시각
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
        self.collectByKeywordsAsync();
    }

    // 수동 수집: REST API 호출 (즉시 반환, 백그라운드 처리)
    public String manualCollect() {
        log.info("[수동 수집] API 호출 수집 시작. time={}", now());
        self.collectByKeywordsAsync();
        return "뉴스 수집을 시작했습니다. 백그라운드에서 처리 중입니다. (" + now() + ")";
    }

    // 키워드 재수집: 기존 뉴스 소프트 삭제 → 비동기 신규 수집
    public String recollectByKeyword(String keyword) {
        log.info("[재수집] 키워드 '{}' 재수집 요청. time={}", keyword, now());
        self.recollectByKeywordAsync(keyword);
        return "키워드 '" + keyword + "'의 기존 뉴스가 보관 처리되고, 백그라운드에서 새로운 뉴스 수집을 시작합니다.";
    }

    // 수집 현황 조회 (대시보드용)
    public CollectionStatus getCollectionStatus() {
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.atTime(LocalTime.MAX);

        CollectionStatus status = new CollectionStatus();
        status.setCollecting(collecting.get());
        status.setTotalNewsCount(Math.toIntExact(newsRepository.countByIsActiveTrue()));
        status.setTodayNewsCount(Math.toIntExact(newsRepository.countActiveByCollectedAtBetween(start, end)));
        status.setActiveKeywordCount(keywordRepository.findByEnabledTrue().size());

        // 마지막 수집 시각: 메모리 캐시 → DB 조회 순서로 확인
        LocalDateTime latest = lastCollectedAt;
        if (latest == null) {
            latest = newsRepository.findTopByIsActiveTrueOrderByCollectedAtDesc()
                    .map(News::getCollectedAt)
                    .orElse(null);
        }
        status.setLastCollectedAt(latest);
        return status;
    }

    // ==================== 비동기 수집 로직 ====================

    @Async("newsCollectionExecutor")
    public void collectByKeywordsAsync() {
        if (!collecting.compareAndSet(false, true)) {
            log.warn("[수집 중복] 이미 뉴스 수집이 실행 중입니다.");
            return;
        }

        try {
            List<Keyword> activeKeywords = keywordRepository.findByEnabledTrue();
            if (activeKeywords.isEmpty()) {
                log.warn("[수집 건너뜀] 활성화된 키워드가 없습니다.");
                return;
            }

            log.info("[수집 시작] 키워드 {}개", activeKeywords.size());

            List<String> keywordNames = activeKeywords.stream()
                    .map(Keyword::getName)
                    .collect(Collectors.toList());

            int totalSaved = 0;
            for (Keyword keyword : activeKeywords) {
                int saved = collectAndSaveForKeyword(keyword.getName(), keywordNames);
                totalSaved += saved;
            }

            lastCollectedAt = LocalDateTime.now();
            log.info("[수집 완료] 총 {}건 저장. time={}", totalSaved, now());

        } catch (Exception e) {
            log.error("[수집 실패] {}", e.getMessage(), e);
        } finally {
            collecting.set(false);
        }
    }

    @Async("newsCollectionExecutor")
    @Transactional
    public void recollectByKeywordAsync(String keyword) {
        try {
            // 1. 해당 키워드의 기존 뉴스를 소프트 삭제 (isActive = false)
            int deactivated = newsRepository.deactivateByKeyword(keyword);
            log.info("[재수집] 키워드 '{}' 기존 뉴스 {}건 보관 처리", keyword, deactivated);

            // 2. 전체 활성 키워드 이름 목록 (AI 평가 컨텍스트용)
            List<String> allKeywordNames = keywordRepository.findAll().stream()
                    .map(Keyword::getName)
                    .collect(Collectors.toList());

            // 3. 신규 수집
            int saved = collectAndSaveForKeyword(keyword, allKeywordNames);
            lastCollectedAt = LocalDateTime.now();
            log.info("[재수집 완료] 키워드 '{}' {}건 신규 저장. time={}", keyword, saved, now());

        } catch (Exception e) {
            log.error("[재수집 실패] 키워드 '{}': {}", keyword, e.getMessage(), e);
        }
    }

    // ==================== 내부 헬퍼 ====================

    /**
     * 특정 키워드에 대해 크롤링 → 평가 → 저장 파이프라인 실행
     * @return 신규 저장된 뉴스 건수
     */
    private int collectAndSaveForKeyword(String keyword, List<String> allKeywordNames) {
        List<RawNewsItem> items = crawlerManager.crawlAll(keyword);
        int saved = 0;
        int processed = 0;

        for (RawNewsItem item : items) {
            processed++;

            // 활성 뉴스 기준 URL 중복 체크 (비활성화된 기사는 재수집 허용)
            if (!newsRepository.existsByUrlAndIsActiveTrue(item.getUrl())) {
                // 1. LLM 평가 점수 (최대 50점)
                AiEvaluation aiEval = openAiService.evaluateImportance(
                        item.getTitle(), item.getContent(), allKeywordNames);
                int llmScore = importanceEvaluator.calculateLlmScore(aiEval);

                // 2. 구조적/문맥적 연관도 점수 (최대 30점)
                int structuralScore = importanceEvaluator.calculateStructuralScore(
                        item.getTitle(), item.getContent(), allKeywordNames);

                // 3. 메타데이터 신뢰도 점수 (최대 20점)
                int metadataScore = importanceEvaluator.calculateMetadataScore(item.getUrl());

                int finalScore = importanceEvaluator.calculateFinalScore(llmScore, structuralScore, metadataScore);

                News news = new News(item.getTitle(), item.getUrl(), keyword);
                news.setContent(item.getContent());
                news.setAiScore(llmScore);
                news.setKeywordMatchScore(structuralScore);
                news.setMetadataScore(metadataScore);
                news.setAiReason(aiEval.reason());
                news.setCategory(aiEval.category());
                news.setSummary(aiEval.summary());
                news.setImportanceScore(finalScore);

                News savedNews = newsRepository.save(news);
                newsVectorStoreService.addOrUpdate(savedNews); // RAG 벡터 인덱싱
                saved++;
            }

            log.debug("[수집 진행] {} ({}/{})", keyword, processed, items.size());
            sleep(1000); // API 429 방지
        }

        return saved;
    }

    // ==================== 유틸 ====================

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
}
