package com.example.news_radar.service;

import com.example.news_radar.crawler.CrawlerManager;
import com.example.news_radar.dto.AiEvaluation;
import com.example.news_radar.dto.CollectionProgressEvent;
import com.example.news_radar.dto.CollectionStatus;
import com.example.news_radar.dto.RawNewsItem;
import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.KeywordStatus;
import com.example.news_radar.entity.News;
import com.example.news_radar.entity.CrawledUrl;
import com.example.news_radar.repository.CrawledUrlRepository;
import com.example.news_radar.repository.KeywordRepository;
import com.example.news_radar.repository.NewsRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 뉴스 수집 서비스
 * - 스케줄러 자동 수집 (NewsScheduler에서 호출)
 * - API 호출로 수동 수집
 * - SSE 실시간 진행률 지원 (CollectionProgressListener)
 * - 키워드별 재수집 (Soft Delete 후 신규 수집)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NewsService {

    private final NewsRepository newsRepository;
    private final CrawledUrlRepository crawledUrlRepository;
    private final KeywordRepository keywordRepository;
    private final OpenAiService openAiService;
    private final CrawlerManager crawlerManager;
    private final ImportanceEvaluator importanceEvaluator;
    private final NewsVectorStoreService newsVectorStoreService;

    // 수집 중복 실행 방지 플래그
    private final AtomicBoolean collecting = new AtomicBoolean(false);
    // 마지막 수집 완료 시각
    private volatile LocalDateTime lastCollectedAt;

    // SSE 진행률 리스너 레지스트리 (스레드 안전)
    private final List<CollectionProgressListener> progressListeners = new CopyOnWriteArrayList<>();

    // Self-injection: @Async는 Spring AOP 프록시를 통해야 동작
    @Autowired
    @Lazy
    private NewsService self;

    // ==================== SSE 리스너 관리 ====================

    public void addProgressListener(CollectionProgressListener listener) {
        progressListeners.add(listener);
    }

    public void removeProgressListener(CollectionProgressListener listener) {
        progressListeners.remove(listener);
    }

    public boolean isCollecting() {
        return collecting.get();
    }

    private void notifyProgress(CollectionProgressEvent event) {
        for (CollectionProgressListener listener : progressListeners) {
            try {
                listener.onProgress(event);
            } catch (Exception e) {
                log.warn("[Progress] 리스너 알림 실패: {}", e.getMessage());
            }
        }
    }

    // ==================== 수집 트리거 ====================

    // 스케줄러 트리거 (NewsScheduler에서 호출)
    public void triggerScheduledCollection() {
        log.info("[자동 수집] 스케줄러 트리거. time={}", now());
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
        status.setActiveKeywordCount(keywordRepository.findByStatus(KeywordStatus.ACTIVE).size());

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
            notifyProgress(new CollectionProgressEvent(
                    "ERROR", null, "이미 수집이 진행 중입니다.", 0, 0, 0, null));
            completeAllSseListeners();
            return;
        }

        try {
            List<Keyword> activeKeywords = keywordRepository.findByStatus(KeywordStatus.ACTIVE);
            if (activeKeywords.isEmpty()) {
                log.warn("[수집 건너뜀] 활성화된 키워드가 없습니다.");
                notifyProgress(new CollectionProgressEvent(
                        "COMPLETED", null, "활성화된 키워드가 없습니다.", 0, 0, 100, 0));
                return;
            }

            int totalKeywords = activeKeywords.size();
            log.info("[수집 시작] 키워드 {}개", totalKeywords);
            notifyProgress(new CollectionProgressEvent(
                    "STARTED", null,
                    "뉴스 수집을 시작합니다. 키워드 " + totalKeywords + "개",
                    0, totalKeywords, 0, totalKeywords));

            List<String> keywordNames = activeKeywords.stream()
                    .map(Keyword::getName)
                    .collect(Collectors.toList());

            int totalSaved = 0;
            for (int i = 0; i < activeKeywords.size(); i++) {
                Keyword keyword = activeKeywords.get(i);
                int basePercent = (i * 100) / totalKeywords;

                notifyProgress(new CollectionProgressEvent(
                        "KEYWORD_BEGIN", keyword.getName(),
                        String.format("키워드 '%s' 수집 시작 (%d/%d)", keyword.getName(), i + 1, totalKeywords),
                        i, totalKeywords, basePercent, null));

                int saved = collectAndSaveForKeyword(keyword.getName(), keywordNames, i, totalKeywords);
                totalSaved += saved;

                int endPercent = ((i + 1) * 100) / totalKeywords;
                notifyProgress(new CollectionProgressEvent(
                        "KEYWORD_COMPLETE", keyword.getName(),
                        String.format("키워드 '%s' 수집 완료. %d건 저장", keyword.getName(), saved),
                        i + 1, totalKeywords, endPercent, saved));
            }

            lastCollectedAt = LocalDateTime.now();
            notifyProgress(new CollectionProgressEvent(
                    "COMPLETED", null,
                    "전체 수집 완료. 총 " + totalSaved + "건 저장",
                    totalKeywords, totalKeywords, 100, totalSaved));
            log.info("[수집 완료] 총 {}건 저장. time={}", totalSaved, now());

        } catch (Exception e) {
            log.error("[수집 실패] {}", e.getMessage(), e);
            notifyProgress(new CollectionProgressEvent(
                    "ERROR", null,
                    "수집 중 오류 발생: " + e.getMessage(), 0, 0, 0, null));
        } finally {
            collecting.set(false);
            completeAllSseListeners();
        }
    }

    /** SSE 리스너를 완료 처리하고 레지스트리를 비운다 */
    private void completeAllSseListeners() {
        for (CollectionProgressListener listener : progressListeners) {
            if (listener instanceof SseProgressListener sseListener) {
                sseListener.complete();
            }
        }
        progressListeners.clear();
    }

    @Async("newsCollectionExecutor")
    @Transactional
    public void recollectByKeywordAsync(String keyword) {
        try {
            // 1. 해당 키워드의 기존 뉴스를 소프트 삭제 (isActive = false)
            int deactivated = newsRepository.deactivateByKeyword(keyword);
            log.info("[재수집] 키워드 '{}' 기존 뉴스 {}건 보관 처리", keyword, deactivated);

            // 2. 전체 활성 키워드 이름 목록 (AI 평가 컨텍스트용)
            List<String> allKeywordNames = keywordRepository.findByStatus(KeywordStatus.ACTIVE).stream()
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

    /** 하위 호환용 오버로드 (재수집 등 SSE 진행률 없이 호출) */
    private int collectAndSaveForKeyword(String keyword, List<String> allKeywordNames) {
        return collectAndSaveForKeyword(keyword, allKeywordNames, 0, 1);
    }

    /**
     * 특정 키워드에 대해 크롤링 → 배치 평가 → 일괄 저장 파이프라인 실행.
     * SSE 진행률 이벤트를 각 단계마다 발행한다.
     *
     * @param keywordIndex  현재 키워드 인덱스 (SSE 퍼센티지 계산용)
     * @param totalKeywords 전체 키워드 수
     * @return 신규 저장된 뉴스 건수
     */
    private int collectAndSaveForKeyword(String keyword, List<String> allKeywordNames,
                                          int keywordIndex, int totalKeywords) {
        // SSE 퍼센티지 서브-슬라이스 계산
        int sliceStart = (keywordIndex * 100) / totalKeywords;
        int sliceEnd = ((keywordIndex + 1) * 100) / totalKeywords;
        int sliceRange = sliceEnd - sliceStart;

        // Early Exit: CrawledUrl 테이블에서 URL을 사전 로드하여 크롤러에 전달 (본문 크롤링 전 중복 필터)
        Set<String> knownUrls = new HashSet<>(crawledUrlRepository.findAllUrls());
        List<RawNewsItem> items = crawlerManager.crawlAll(keyword, knownUrls);

        notifyProgress(new CollectionProgressEvent(
                "CRAWL_DONE", keyword,
                String.format("크롤링 목록 수집 완료. %d건 발견", items.size()),
                keywordIndex, totalKeywords, sliceStart + sliceRange / 4, items.size()));

        // 1. URL 중복 필터링 (CrawledUrl 기준 — 레이스 컨디션 안전장치)
        List<RawNewsItem> newItems = items.stream()
                .filter(item -> !crawledUrlRepository.existsByUrl(item.getUrl()))
                .collect(Collectors.toList());

        notifyProgress(new CollectionProgressEvent(
                "FILTER_DONE", keyword,
                String.format("새로운 기사 %d건 발견", newItems.size()),
                keywordIndex, totalKeywords, sliceStart + sliceRange / 3, newItems.size()));

        if (newItems.isEmpty()) {
            log.info("[수집] keyword='{}' 크롤링 {}건 중 신규 기사 없음", keyword, items.size());
            return 0;
        }

        log.info("[수집] keyword='{}' 크롤링 {}건 중 신규 {}건, 배치 평가 시작",
                keyword, items.size(), newItems.size());

        notifyProgress(new CollectionProgressEvent(
                "AI_EVAL_BEGIN", keyword,
                String.format("AI 분석 시작 (%d건)", newItems.size()),
                keywordIndex, totalKeywords, sliceStart + sliceRange / 2, newItems.size()));

        // 2. 배치 AI 평가 (1회 API 호출로 모든 기사 동시 평가)
        List<AiEvaluation> evaluations = openAiService.evaluateImportanceBatch(newItems, allKeywordNames);

        // 3. 평가 결과 + 구조적/메타 점수 계산 → News 엔티티 조립
        List<News> newsToSave = new ArrayList<>();
        for (int i = 0; i < newItems.size(); i++) {
            RawNewsItem item = newItems.get(i);
            AiEvaluation aiEval = evaluations.get(i);

            int llmScore = importanceEvaluator.calculateLlmScore(aiEval);
            int structuralScore = importanceEvaluator.calculateStructuralScore(
                    item.getTitle(), item.getContent(), allKeywordNames);
            int metadataScore = importanceEvaluator.calculateMetadataScore(item.getUrl());
            int finalScore = importanceEvaluator.calculateFinalScore(llmScore, structuralScore, metadataScore);

            News news = new News(item.getTitle(), item.getUrl(), keyword);
            news.setContent(item.getContent());
            news.setAiScore(llmScore);
            news.setInnovationScore(aiEval.innovation());
            news.setKeywordMatchScore(structuralScore);
            news.setMetadataScore(metadataScore);
            news.setAiReason(aiEval.reason());
            news.setCategory(aiEval.category());
            news.setSummary(aiEval.summary());
            news.setImportanceScore(finalScore);

            newsToSave.add(news);
        }

        // 4. 일괄 저장 (Batch Insert)
        List<News> savedNewsList = newsRepository.saveAll(newsToSave);

        // 5. CrawledUrl 테이블에 URL 히스토리 저장 (중복 수집 영구 방지)
        List<CrawledUrl> crawledUrlsToSave = savedNewsList.stream()
                .map(News::getUrl)
                .filter(url -> !crawledUrlRepository.existsByUrl(url))
                .map(CrawledUrl::new)
                .collect(Collectors.toList());
        if (!crawledUrlsToSave.isEmpty()) {
            crawledUrlRepository.saveAll(crawledUrlsToSave);
        }

        // 6. 벡터 인덱싱
        for (News savedNews : savedNewsList) {
            newsVectorStoreService.addOrUpdate(savedNews);
        }

        notifyProgress(new CollectionProgressEvent(
                "SAVE_DONE", keyword,
                String.format("%d건 저장 완료", savedNewsList.size()),
                keywordIndex, totalKeywords, sliceEnd - 1, savedNewsList.size()));

        log.info("[수집] keyword='{}' {}건 저장 완료", keyword, savedNewsList.size());
        return savedNewsList.size();
    }

    // ==================== 유틸 ====================

    private String now() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
}
