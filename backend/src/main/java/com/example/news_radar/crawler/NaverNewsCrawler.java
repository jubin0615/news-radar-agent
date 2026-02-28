package com.example.news_radar.crawler;

import com.example.news_radar.dto.RawNewsItem;

import jakarta.annotation.PreDestroy;
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
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 네이버 뉴스 검색 크롤러 (키워드 기반)
@Slf4j
@Component
public class NaverNewsCrawler implements NewsCrawler {

    private static final int MAX_ITEMS_PER_KEYWORD = 8;
    private static final int CONTENT_FETCH_POOL_SIZE = 4;
    private static final int CONTENT_FETCH_TIMEOUT_SECONDS = 30;
    private static final int STAGGER_DELAY_MS = 200;

    private static final Pattern SEARCH_BASIC_TITLE_PATTERN = Pattern.compile(
            "\"title\":\"((?:\\\\\"|[^\"])*)\",\"titleHref\":\"((?:\\\\\"|[^\"])*)\",\"type\":\"searchBasic\"");
    private static final Pattern UNICODE_ESCAPE_PATTERN = Pattern.compile("\\\\u([0-9a-fA-F]{4})");

    private static final String[] USER_AGENTS = {
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    };

    private final Random random = new Random();
    private final ScheduledExecutorService contentFetchExecutor =
            Executors.newScheduledThreadPool(CONTENT_FETCH_POOL_SIZE, r -> {
                Thread t = new Thread(r, "content-fetch");
                t.setDaemon(true);
                return t;
            });

    @PreDestroy
    public void shutdown() {
        contentFetchExecutor.shutdown();
        try {
            if (!contentFetchExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                contentFetchExecutor.shutdownNow();
            }
        } catch (InterruptedException e) {
            contentFetchExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public List<RawNewsItem> crawl(String keyword) {
        return crawl(keyword, Set.of());
    }

    @Override
    public List<RawNewsItem> crawl(String keyword, Set<String> knownUrls) {
        try {
            // 1단계: 제목+링크만 수집 (본문 크롤링 없이)
            List<TitleAndLink> titleAndLinks = extractTitleAndLinks(keyword);

            if (titleAndLinks.isEmpty()) {
                return List.of();
            }

            // Early Exit: DB에 이미 존재하는 URL 필터링 (본문 크롤링 전)
            if (!knownUrls.isEmpty()) {
                int beforeCount = titleAndLinks.size();
                titleAndLinks = titleAndLinks.stream()
                        .filter(item -> !knownUrls.contains(item.link()))
                        .toList();

                int skipped = beforeCount - titleAndLinks.size();
                if (skipped > 0) {
                    log.info("[네이버] keyword={}, {}건 중 {}건 기존 URL → 본문 크롤링 생략",
                            keyword, beforeCount, skipped);
                }

                if (titleAndLinks.isEmpty()) {
                    log.info("[네이버] keyword={}, 모든 기사가 기존 URL → 전체 생략", keyword);
                    return List.of();
                }
            }

            // 2단계: 신규 URL만 본문 크롤링을 논블로킹 스케줄 방식으로 병렬 실행
            return fetchContentsInParallel(titleAndLinks);

        } catch (IOException e) {
            log.error("[네이버] 크롤링 실패. keyword={}, error={}", keyword, e.getMessage());
            return List.of();
        }
    }

    /**
     * 1단계: 네이버 검색 결과에서 제목+링크만 추출 (본문 크롤링 없이)
     */
    private List<TitleAndLink> extractTitleAndLinks(String keyword) throws IOException {
        String encodedKeyword = URLEncoder.encode(keyword, StandardCharsets.UTF_8);
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

        List<TitleAndLink> titleAndLinks = new ArrayList<>();

        Elements newsItems = doc.select(".news_tit");
        if (!newsItems.isEmpty()) {
            log.info("[네이버] keyword={}, legacy selector hit {}건", keyword, newsItems.size());
            int limit = Math.min(newsItems.size(), MAX_ITEMS_PER_KEYWORD);
            for (int i = 0; i < limit; i++) {
                Element item = newsItems.get(i);
                String title = item.text();
                String link = item.attr("href");
                addTitleAndLink(titleAndLinks, title, link);
            }
        } else {
            int extracted = extractFromEmbeddedPayload(doc.html(), titleAndLinks);
            log.info("[네이버] keyword={}, payload fallback hit {}건", keyword, extracted);
        }

        return titleAndLinks;
    }

    /**
     * 기사 목록의 본문을 논블로킹 스케줄 방식으로 병렬 크롤링합니다.
     * ScheduledExecutorService.schedule()을 사용하여 각 작업을 stagger delay만큼
     * 지연 예약하므로, 스레드를 블로킹하지 않고 요청 간격을 분산합니다.
     */
    private List<RawNewsItem> fetchContentsInParallel(List<TitleAndLink> items) {
        List<CompletableFuture<RawNewsItem>> futures = new ArrayList<>();

        for (int i = 0; i < items.size(); i++) {
            TitleAndLink item = items.get(i);
            long delay = (long) i * STAGGER_DELAY_MS;

            // schedule()로 논블로킹 지연 예약 → CompletableFuture로 래핑
            CompletableFuture<RawNewsItem> future = new CompletableFuture<>();
            contentFetchExecutor.schedule(() -> {
                try {
                    String content = fetchArticleContent(item.link);
                    future.complete(new RawNewsItem(item.title, item.link, content));
                } catch (Exception ex) {
                    future.completeExceptionally(ex);
                }
            }, delay, TimeUnit.MILLISECONDS);

            // 예외 발생 시 빈 content로 대체
            futures.add(future.exceptionally(ex -> {
                log.warn("[네이버] 본문 병렬 크롤링 실패. url={}, error={}", item.link, ex.getMessage());
                return new RawNewsItem(item.title, item.link, "");
            }));
        }

        // 전체 완료 대기 (타임아웃 적용)
        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                    .get(CONTENT_FETCH_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("[네이버] 본문 병렬 크롤링 타임아웃 또는 오류. 완료된 결과만 사용합니다. error={}", e.getMessage());
        }

        return futures.stream()
                .map(f -> {
                    try {
                        return f.isDone() ? f.get() : null;
                    } catch (Exception e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .toList();
    }

    // ==================== 1단계 헬퍼: 제목+링크 수집 ====================

    /** 제목+링크 임시 홀더 */
    private record TitleAndLink(String title, String link) {}

    private void addTitleAndLink(List<TitleAndLink> list, String rawTitle, String rawLink) {
        if (rawTitle == null || rawLink == null) return;

        String title = Jsoup.parse(rawTitle).text().trim();
        String link = rawLink.replace("\\/", "/").trim();

        if (title.isBlank() || link.isBlank()) return;
        list.add(new TitleAndLink(title, link));
    }

    private int extractFromEmbeddedPayload(String html, List<TitleAndLink> results) {
        int count = 0;
        Matcher matcher = SEARCH_BASIC_TITLE_PATTERN.matcher(html);
        while (matcher.find() && results.size() < MAX_ITEMS_PER_KEYWORD) {
            String title = decodeEscapes(matcher.group(1));
            String link = decodeEscapes(matcher.group(2));

            if (!isLikelyArticleUrl(link)) continue;

            addTitleAndLink(results, title, link);
            count++;
        }
        return count;
    }

    // ==================== 2단계 헬퍼: 본문 추출 ====================

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
}
