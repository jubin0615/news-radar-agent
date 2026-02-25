package com.example.news_radar.crawler;

import com.example.news_radar.dto.RawNewsItem;
import com.example.news_radar.service.OpenAiService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

// 등록된 모든 크롤러를 실행하고 중복 제거
@Slf4j
@Component
@RequiredArgsConstructor
public class CrawlerManager {

    // NewsCrawler 인터페이스 구현체들을 자동 주입 (현재는 NaverNewsCrawler만)
    private final List<NewsCrawler> crawlers;
    private final OpenAiService openAiService;

    // 키워드로 모든 크롤러 실행 → URL 기준 중복 제거 (하위 호환용)
    public List<RawNewsItem> crawlAll(String keyword) {
        return crawlAll(keyword, Collections.emptySet());
    }

    // 키워드로 모든 크롤러 실행 → DB 기존 URL + 크로스-쿼리 중복 제거
    // Query Expansion: 원본 키워드 + LLM 확장 검색어를 모두 순회하며 크롤링
    public List<RawNewsItem> crawlAll(String keyword, Set<String> knownUrls) {
        List<RawNewsItem> allResults = new ArrayList<>();
        Set<String> seenUrls = new HashSet<>(knownUrls); // DB URL로 사전 초기화

        // 원본 키워드 + 확장 검색어 목록 구성
        List<String> searchQueries = new ArrayList<>();
        searchQueries.add(keyword);
        try {
            List<String> expanded = openAiService.expandKeyword(keyword);
            searchQueries.addAll(expanded);
        } catch (Exception e) {
            log.warn("[CrawlerManager] 검색어 확장 실패, 원본만 사용: keyword={}, error={}", keyword, e.getMessage());
        }

        log.info("[CrawlerManager] 크롤링 시작: 원본='{}', 전체 검색어={}, 기존 URL {}건 사전 필터",
                keyword, searchQueries, knownUrls.size());

        for (String query : searchQueries) {
            for (NewsCrawler crawler : crawlers) {
                List<RawNewsItem> items = crawler.crawl(query, knownUrls);

                for (RawNewsItem item : items) {
                    // URL 기준으로 중복 뉴스 제거 (크로스-쿼리 + DB 중복 모두 포함)
                    if (seenUrls.add(item.getUrl())) {
                        allResults.add(item);
                    }
                }
            }
        }

        log.info("[CrawlerManager] 크롤링 완료: keyword='{}', 총 {}건 수집 (중복 제거 후)", keyword, allResults.size());
        return allResults;
    }
}
