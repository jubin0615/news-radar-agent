package com.example.news_radar.crawler;

import com.example.news_radar.dto.RawNewsItem;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 네이버 뉴스 검색 크롤러 (키워드 기반)
@Slf4j
@Component
public class NaverNewsCrawler implements NewsCrawler {

    private static final int MAX_ITEMS_PER_KEYWORD = 8;
    private static final Pattern SEARCH_BASIC_TITLE_PATTERN = Pattern.compile(
            "\"title\":\"((?:\\\\\"|[^\"])*)\",\"titleHref\":\"((?:\\\\\"|[^\"])*)\",\"type\":\"searchBasic\"");
    private static final Pattern UNICODE_ESCAPE_PATTERN = Pattern.compile("\\\\u([0-9a-fA-F]{4})");

    private static final String[] USER_AGENTS = {
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    };

    private final Random random = new Random();

    @Override
    public List<RawNewsItem> crawl(String keyword) {
        List<RawNewsItem> results = new ArrayList<>();

        try {
            String encodedKeyword = URLEncoder.encode(keyword, StandardCharsets.UTF_8);
            // sort=1: 최신순 정렬
            String searchUrl = "https://search.naver.com/search.naver?where=news&query="
                    + encodedKeyword + "&sort=1";

            String ua = USER_AGENTS[random.nextInt(USER_AGENTS.length)];

            Document doc = Jsoup.connect(searchUrl)
                    .userAgent(ua)
                    .referrer("https://www.naver.com")
                    .header("Accept", "text/html,application/xhtml+xml")
                    .header("Accept-Language", "ko-KR,ko;q=0.9,en-US;q=0.8")
                    .timeout(15000)
                    .get();

            // 구형(서버 렌더링) DOM 셀렉터
            Elements newsItems = doc.select(".news_tit");
            if (!newsItems.isEmpty()) {
                log.info("[네이버] keyword={}, legacy selector hit {}건", keyword, newsItems.size());
                int limit = Math.min(newsItems.size(), MAX_ITEMS_PER_KEYWORD);
                for (int i = 0; i < limit; i++) {
                    Element item = newsItems.get(i);
                    String title = item.text();
                    String link = item.attr("href");
                    addCrawledItem(results, title, link);
                }
            } else {
                // 신형(클라이언트 렌더링) 페이지는 HTML 내부 JSON payload에서 기사 정보를 추출
                int extracted = extractFromEmbeddedPayload(doc.html(), results);
                log.info("[네이버] keyword={}, payload fallback hit {}건", keyword, extracted);
            }

        } catch (IOException e) {
            log.error("[네이버] 크롤링 실패. keyword={}, error={}", keyword, e.getMessage());
        }

        return results;
    }

    private int extractFromEmbeddedPayload(String html, List<RawNewsItem> results) {
        int count = 0;
        Matcher matcher = SEARCH_BASIC_TITLE_PATTERN.matcher(html);
        while (matcher.find() && results.size() < MAX_ITEMS_PER_KEYWORD) {
            String title = decodeEscapes(matcher.group(1));
            String link = decodeEscapes(matcher.group(2));

            if (!isLikelyArticleUrl(link)) continue;

            if (addCrawledItem(results, title, link)) {
                count++;
            }
        }
        return count;
    }

    private boolean addCrawledItem(List<RawNewsItem> results, String rawTitle, String rawLink) {
        if (rawTitle == null || rawLink == null) return false;

        String title = Jsoup.parse(rawTitle).text().trim();
        String link = rawLink.replace("\\/", "/").trim();

        if (title.isBlank() || link.isBlank()) return false;

        String content = fetchArticleContent(link);
        results.add(new RawNewsItem(title, link, content));
        sleep(300 + random.nextInt(500)); // anti-bot
        return true;
    }

    private String decodeEscapes(String value) {
        if (value == null || value.isBlank()) return "";

        String decoded = value
                .replace("\\/", "/")
                .replace("\\\"", "\"")
                .replace("\\n", " ")
                .replace("\\t", " ")
                .replace("\\u003c", "<")
                .replace("\\u003e", ">")
                .replace("\\u0026", "&");

        Matcher matcher = UNICODE_ESCAPE_PATTERN.matcher(decoded);
        StringBuffer out = new StringBuffer();
        while (matcher.find()) {
            String unicode = matcher.group(1);
            char ch = (char) Integer.parseInt(unicode, 16);
            matcher.appendReplacement(out, Matcher.quoteReplacement(String.valueOf(ch)));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private boolean isLikelyArticleUrl(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            String path = uri.getPath();

            if (host == null || host.isBlank()) return false;
            if (url.contains("media.naver.com/press")) return false; // 언론사 프로필 페이지
            if (path == null || path.isBlank() || "/".equals(path)) return false; // 홈페이지 루트 제외
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    // 기사 링크를 따라가서 본문 텍스트 추출
    private String fetchArticleContent(String articleUrl) {
        try {
            String ua = USER_AGENTS[random.nextInt(USER_AGENTS.length)];

            Document doc = Jsoup.connect(articleUrl)
                    .userAgent(ua)
                    .referrer("https://search.naver.com")
                    .header("Accept", "text/html,application/xhtml+xml")
                    .header("Accept-Language", "ko-KR,ko;q=0.9")
                    .timeout(10000)
                    .followRedirects(true)
                    .get();

            // 네이버 뉴스 본문 셀렉터 (여러 포맷 대응)
            Element articleBody = doc.selectFirst("#dic_area");           // 네이버 뉴스
            if (articleBody == null) articleBody = doc.selectFirst("#newsct_article"); // 네이버 뉴스 (신형)
            if (articleBody == null) articleBody = doc.selectFirst("#articleBodyContents"); // 구형
            if (articleBody == null) articleBody = doc.selectFirst("#articleBody");   // 구형 포맷
            if (articleBody == null) articleBody = doc.selectFirst(".article_body"); // 언론사 직접
            if (articleBody == null) articleBody = doc.selectFirst(".news_end");     // 일부 언론사
            if (articleBody == null) articleBody = doc.selectFirst("article");       // 일반 HTML5
            if (articleBody == null) {
                // 메타 태그에서 description 추출
                Element meta = doc.selectFirst("meta[property=og:description]");
                if (meta != null) {
                    return meta.attr("content");
                }
            }

            if (articleBody != null) {
                String text = articleBody.text();
                return text.length() > 2000 ? text.substring(0, 2000) : text;
            }
        } catch (Exception e) {
            log.warn("[네이버] 본문 크롤링 실패. url={}, error={}", articleUrl, e.getMessage());
        }
        return "";
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
