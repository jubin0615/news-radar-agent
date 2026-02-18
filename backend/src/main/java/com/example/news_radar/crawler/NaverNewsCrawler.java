package com.example.news_radar.crawler;

import com.example.news_radar.dto.RawNewsItem;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

// 네이버 뉴스 검색 크롤러 (키워드 기반)
@Slf4j
@Component
public class NaverNewsCrawler implements NewsCrawler {

    @Override
    public List<RawNewsItem> crawl(String keyword) {
        List<RawNewsItem> results = new ArrayList<>();

        try {
            // 네이버 뉴스 검색 URL 생성
            String encodedKeyword = URLEncoder.encode(keyword, StandardCharsets.UTF_8);
            String searchUrl = "https://search.naver.com/search.naver?where=news&query=" + encodedKeyword;

            Document doc = Jsoup.connect(searchUrl)
                    .userAgent("Mozilla/5.0")
                    .timeout(10000)
                    .get();

            // 뉴스 검색 결과 목록
            Elements newsItems = doc.select(".news_tit");

            for (Element item : newsItems) {
                String title = item.text();
                String link = item.attr("href");

                // 기사 본문 크롤링 시도
                String content = fetchArticleContent(link);

                RawNewsItem rawNewsItem = new RawNewsItem(title, link, content);
                results.add(rawNewsItem);
            }

        } catch (IOException e) {
            log.error("[네이버] 크롤링 실패. keyword={}, error={}", keyword, e.getMessage(), e);
        }

        return results;
    }

    // 기사 링크를 따라가서 본문 텍스트 추출
    private String fetchArticleContent(String articleUrl) {
        try {
            Document doc = Jsoup.connect(articleUrl)
                    .userAgent("Mozilla/5.0")
                    .timeout(5000)
                    .get();

            // 네이버 뉴스 본문 셀렉터 (여러 포맷 대응)
            Element articleBody = doc.selectFirst("#dic_area");           // 네이버 뉴스
            if (articleBody == null) articleBody = doc.selectFirst("#articleBody");   // 구형 포맷
            if (articleBody == null) articleBody = doc.selectFirst(".article_body"); // 언론사 직접
            if (articleBody == null) articleBody = doc.selectFirst("article");       // 일반 HTML5

            if (articleBody != null) {
                // 본문이 너무 길면 앞부분만 사용 (AI 요청 토큰 절약)
                String text = articleBody.text();
                return text.length() > 2000 ? text.substring(0, 2000) : text;
            }
        } catch (Exception e) {
            // 본문 크롤링 실패해도 제목만으로 진행 가능
            log.warn("본문 크롤링 실패. url={}", articleUrl);
        }
        return "";
    }
}
