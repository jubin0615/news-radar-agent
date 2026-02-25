package com.example.news_radar.crawler;

import com.example.news_radar.dto.RawNewsItem;

import java.util.List;
import java.util.Set;

// 크롤러 공통 인터페이스 (새로운 소스 추가 시 이것만 구현하면 됨)
public interface NewsCrawler {

    // 키워드로 뉴스를 크롤링해서 결과 리스트 반환
    List<RawNewsItem> crawl(String keyword);

    // Early Exit: 이미 수집된 URL 집합을 전달받아 본문 크롤링을 건너뛰는 오버로드
    default List<RawNewsItem> crawl(String keyword, Set<String> knownUrls) {
        return crawl(keyword);
    }
}
