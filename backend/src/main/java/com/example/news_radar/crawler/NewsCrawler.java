package com.example.news_radar.crawler;

import com.example.news_radar.dto.RawNewsItem;

import java.util.List;

// 크롤러 공통 인터페이스 (새로운 소스 추가 시 이것만 구현하면 됨)
public interface NewsCrawler {

    // 키워드로 뉴스를 크롤링해서 결과 리스트 반환
    List<RawNewsItem> crawl(String keyword);
}
