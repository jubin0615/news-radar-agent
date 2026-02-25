package com.example.news_radar.scheduler;

import com.example.news_radar.repository.NewsRepository;
import com.example.news_radar.service.NewsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 뉴스 자동 수집 & DB 정리 스케줄러
 * - 4시간 간격: 자동 수집 실행
 * - 매일 새벽 3시: 30일 지난 뉴스 하드 삭제 (CrawledUrl은 보존 → 중복 수집 차단 유지)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NewsScheduler {

    private final NewsService newsService;
    private final NewsRepository newsRepository;

    /** 4시간 간격 자동 수집 (0시, 4시, 8시, 12시, 16시, 20시) */
    @Scheduled(cron = "0 0 0/4 * * *")
    public void scheduledCollect() {
        log.info("[자동 수집] 스케줄러 작동. time={}",
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        newsService.triggerScheduledCollection();
    }

    /**
     * 매일 새벽 3시 — 수집된 지 30일이 지난 News 엔티티를 하드 삭제.
     * 무거운 content/aiReason 등의 텍스트 데이터를 DB에서 제거하여 용량을 절약한다.
     * CrawledUrl 테이블은 삭제하지 않으므로 URL 중복 검사는 영구적으로 유지된다.
     */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void purgeOldNews() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(30);
        int deleted = newsRepository.deleteByCollectedAtBefore(threshold);
        log.info("[DB 정리] 30일 경과 뉴스 {}건 하드 삭제 완료. threshold={}, time={}",
                deleted, threshold, LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
    }
}
