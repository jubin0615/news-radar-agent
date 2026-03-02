package com.example.news_radar.scheduler;

import com.example.news_radar.entity.News;
import com.example.news_radar.repository.NewsRepository;
import com.example.news_radar.service.NewsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * 뉴스 자동 수집 & DB 정리 스케줄러
 * - 하루 3회 (09시, 15시, 21시 KST): 자동 수집 실행
 * - 매일 새벽 3시: 30일 지난 뉴스 하드 삭제 (Url은 보존 → 중복 수집 차단 유지)
 * - 앱 시작 시 마지막 수집이 6시간 이상 경과했으면 catch-up 수집 실행
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NewsScheduler {

    private static final long CATCHUP_THRESHOLD_HOURS = 6;

    @Value("${app.scheduler.zone-id:Asia/Seoul}")
    private String schedulerZoneId;

    private final NewsService newsService;
    private final NewsRepository newsRepository;

    /**
     * 앱 시작 시 catch-up 수집.
     * 마지막 수집 시각이 6시간 이상 경과했으면 즉시 수집을 실행하여
     * cron 스케줄 사이에 앱이 꺼져 있었던 경우를 보상한다.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void catchUpOnStartup() {
        LocalDateTime now = LocalDateTime.now(resolveZone());
        LocalDateTime lastCollected = newsRepository.findTopByIsActiveTrueOrderByCollectedAtDesc()
                .map(News::getCollectedAt)
                .orElse(null);

        if (lastCollected == null) {
            log.info("[Catch-up] 수집 이력 없음 — 즉시 수집 실행. time={}", format(now));
            newsService.triggerScheduledCollection();
            return;
        }

        long hoursSince = Duration.between(lastCollected, now).toHours();
        if (hoursSince >= CATCHUP_THRESHOLD_HOURS) {
            log.info("[Catch-up] 마지막 수집 {}시간 경과 (last={}) — 즉시 수집 실행. time={}",
                    hoursSince, format(lastCollected), format(now));
            newsService.triggerScheduledCollection();
        } else {
            log.info("[Catch-up] 마지막 수집 {}시간 전 (last={}) — catch-up 불필요. time={}",
                    hoursSince, format(lastCollected), format(now));
        }
    }

    /** 하루 3회 자동 수집 (09시, 15시, 21시 — KST 실제 시각 기준) */
    @Scheduled(cron = "0 0 9,15,21 * * *", zone = "${app.scheduler.zone-id:Asia/Seoul}")
    public void scheduledCollect() {
        LocalDateTime now = LocalDateTime.now(resolveZone());
        log.info("[자동 수집] 스케줄러 작동. time={}",
                now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        newsService.triggerScheduledCollection();
    }

    /**
     * 매일 새벽 3시 — 수집된 지 30일이 지난 News 엔티티를 하드 삭제.
     * 무거운 content/aiReason 등의 텍스트 데이터를 DB에서 제거하여 용량을 절약한다.
     * CrawledUrl 테이블은 삭제하지 않으므로 URL 중복 검사는 영구적으로 유지된다.
     */
    @Scheduled(cron = "0 0 3 * * *", zone = "${app.scheduler.zone-id:Asia/Seoul}")
    @Transactional
    public void purgeOldNews() {
        LocalDateTime now = LocalDateTime.now(resolveZone());
        LocalDateTime threshold = now.minusDays(30);
        int deleted = newsRepository.deleteByCollectedAtBefore(threshold);
        log.info("[DB 정리] 30일 경과 뉴스 {}건 하드 삭제 완료. threshold={}, time={}",
                deleted, threshold, now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
    }

    private ZoneId resolveZone() {
        return ZoneId.of(schedulerZoneId);
    }

    private String format(LocalDateTime dt) {
        return dt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
}
