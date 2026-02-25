package com.example.news_radar.scheduler;

import com.example.news_radar.service.NewsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 뉴스 자동 수집 스케줄러
 * - 4시간 간격으로 자동 수집 실행 (0시, 4시, 8시, 12시, 16시, 20시)
 * - NewsService의 비동기 수집 파이프라인을 트리거
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NewsScheduler {

    private final NewsService newsService;

    @Scheduled(cron = "0 0 0/4 * * *")
    public void scheduledCollect() {
        log.info("[자동 수집] 스케줄러 작동. time={}",
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        newsService.triggerScheduledCollection();
    }
}
