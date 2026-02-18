package com.example.news_radar.crawler;

import com.example.news_radar.dto.RawNewsItem;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

// 등록된 모든 크롤러를 실행하고 중복 제거
@Component
@RequiredArgsConstructor
public class CrawlerManager {

    // NewsCrawler 인터페이스 구현체들을 자동 주입 (현재는 NaverNewsCrawler만)
    private final List<NewsCrawler> crawlers;

    // 키워드로 모든 크롤러 실행 → URL 기준 중복 제거
    public List<RawNewsItem> crawlAll(String keyword) {
        List<RawNewsItem> allResults = new ArrayList<>();
        Set<String> seenUrls = new HashSet<>();

        for (NewsCrawler crawler : crawlers) {
            List<RawNewsItem> items = crawler.crawl(keyword);

            for (RawNewsItem item : items) {
                // URL 기준으로 중복 뉴스 제거
                if (seenUrls.add(item.getUrl())) {
                    allResults.add(item);
                }
            }
        }

        return allResults;
    }
}
