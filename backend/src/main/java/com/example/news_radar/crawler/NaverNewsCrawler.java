package com.example.news_radar.crawler;

import com.example.news_radar.dto.RawNewsItem;

import com.example.news_radar.service.KeywordService;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 네이버 뉴스 검색 크롤러 (키워드 기반, 시간 기반 수집 + Safety Cap)
@Slf4j
@Component
public class NaverNewsCrawler implements NewsCrawler {

    private final KeywordService keywordService;

    public NaverNewsCrawler(KeywordService keywordService) {
        this.keywordService = keywordService;
    }

    @Value("${app.crawler.max-items-per-keyword:10}")
    private int maxItemsPerKeyword;

    private static final int CONTENT_FETCH_POOL_SIZE = 4;
    private static final int CONTENT_FETCH_TIMEOUT_SECONDS = 30;
    private static final int STAGGER_DELAY_MS = 200;

    private static final Pattern SEARCH_BASIC_TITLE_PATTERN = Pattern.compile(
            "\"title\":\"((?:\\\\\"|[^\"])*)\",\"titleHref\":\"((?:\\\\\"|[^\"])*)\",\"type\":\"searchBasic\"");
    private static final Pattern UNICODE_ESCAPE_PATTERN = Pattern.compile("\\\\u([0-9a-fA-F]{4})");

    // 네이버 검색 결과의 상대 시간 패턴 ("N분 전", "N시간 전", "N일 전")
    private static final Pattern RELATIVE_TIME_PATTERN = Pattern.compile("(\\d+)(분|시간|일)\\s*전");
    // 절대 날짜 패턴 ("2026.03.02.")
    private static final Pattern ABSOLUTE_DATE_PATTERN = Pattern.compile("(\\d{4})\\.(\\d{2})\\.(\\d{2})\\.");

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
        return crawl(keyword, Set.of(), null);
    }

    @Override
    public List<RawNewsItem> crawl(String keyword, Set<String> knownUrls, LocalDateTime lastCollectedAt) {
        try {
            // 1단계: 제목+링크+발행시각 수집 (시간 기반 중단 + Safety Cap 적용)
            List<TitleAndLink> titleAndLinks = extractTitleAndLinks(keyword, lastCollectedAt);

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
     * 1단계: 네이버 검색 결과에서 제목+링크 추출 (시간 기반 중단 + Safety Cap)
     * - lastCollectedAt 이전 기사를 만나면 즉시 중단 (최신순 정렬 가정)
     * - maxItemsPerKeyword 초과 시에도 중단 (비용 안전장치)
     */
    private List<TitleAndLink> extractTitleAndLinks(String keyword, LocalDateTime lastCollectedAt) throws IOException {
        // 하이브리드 동의어 조회: 정적 사전 → DB 캐시 → LLM 순 Fallback
        List<String> variants = keywordService.getSearchVariants(keyword);
        String expandedQuery = variants.stream()
                .map(String::trim)
                .distinct()
                .collect(Collectors.joining(" | "));

        log.info("[네이버] keyword={}, expandedQuery={}", keyword, expandedQuery);

        String encodedKeyword = URLEncoder.encode(expandedQuery, StandardCharsets.UTF_8);
        // 네이버 뉴스 검색: 최신순(sort=1) + 날짜 범위 필터(nso=p:from~to)
        String searchUrl = "https://search.naver.com/search.naver?where=news&query="
                + encodedKeyword + "&sort=1";
        if (lastCollectedAt != null) {
            String from = lastCollectedAt.format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
            String to = LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
            searchUrl += "&nso=so:dd,p:from" + from + "to" + to;
        }

        String ua = USER_AGENTS[random.nextInt(USER_AGENTS.length)];

        Document doc = Jsoup.connect(searchUrl)
                .userAgent(ua)
                .referrer("https://www.naver.com")
                .header("Accept", "text/html,application/xhtml+xml")
                .header("Accept-Language", "ko-KR,ko;q=0.9,en-US;q=0.8")
                .timeout(15000)
                .get();

        List<TitleAndLink> titleAndLinks = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        // Legacy selector 경로: .news_tit 기반 파싱
        Elements newsItems = doc.select(".news_tit");
        if (!newsItems.isEmpty()) {
            log.info("[네이버] keyword={}, legacy selector hit {}건", keyword, newsItems.size());
            for (Element item : newsItems) {
                // Safety Cap: 최대 수집 개수 초과 시 중단
                if (titleAndLinks.size() >= maxItemsPerKeyword) {
                    log.info("[네이버] keyword={}, Safety Cap 도달 ({}건) → 수집 중단",
                            keyword, maxItemsPerKeyword);
                    break;
                }

                String title = item.text();
                String link = item.attr("href");

                // 시간 기반 필터: 기사의 발행 시각 추출 후 비교
                LocalDateTime publishedAt = extractDateFromLegacyItem(item, now);
                if (shouldStopByTime(publishedAt, lastCollectedAt, keyword)) {
                    break;
                }
                // 날짜 파싱 실패 + cutoff 설정됨 → 오래된 기사일 수 있으므로 스킵
                if (publishedAt == null && lastCollectedAt != null) {
                    log.debug("[네이버] keyword={}, 날짜 파싱 실패 → 스킵: {}", keyword, title);
                    continue;
                }

                addTitleAndLink(titleAndLinks, title, link);
            }
        } else {
            // Embedded payload fallback 경로
            int extracted = extractFromEmbeddedPayload(doc.html(), titleAndLinks);
            log.info("[네이버] keyword={}, payload fallback hit {}건", keyword, extracted);
        }

        return titleAndLinks;
    }

    /**
     * Legacy selector 기사 항목에서 발행 시각을 추출한다.
     * 네이버 검색 결과 구조: .news_tit의 부모 .news_area 내 .info 요소에 시간 표시.
     * "N분 전", "N시간 전", "N일 전" (상대) 또는 "2026.03.02." (절대) 형식.
     */
    private LocalDateTime extractDateFromLegacyItem(Element newsTitElement, LocalDateTime now) {
        // .news_tit → 상위 .news_area 또는 가장 가까운 공통 컨테이너에서 .info 탐색
        Element container = newsTitElement.closest(".news_area");
        if (container == null) {
            container = newsTitElement.parent();
        }
        if (container == null) return null;

        Elements infoElements = container.select("span.info");
        for (Element info : infoElements) {
            LocalDateTime parsed = parseNaverDateText(info.text().trim(), now);
            if (parsed != null) return parsed;
        }
        return null;
    }

    /**
     * 네이버 검색 결과의 시간 텍스트를 LocalDateTime으로 변환한다.
     * 지원 형식:
     *  - 상대: "N분 전", "N시간 전", "N일 전"
     *  - 절대: "2026.03.02."
     */
    private LocalDateTime parseNaverDateText(String text, LocalDateTime now) {
        if (text == null || text.isBlank()) return null;

        // 상대 시간 ("3분 전", "2시간 전", "1일 전")
        Matcher relativeMatcher = RELATIVE_TIME_PATTERN.matcher(text);
        if (relativeMatcher.find()) {
            int amount = Integer.parseInt(relativeMatcher.group(1));
            String unit = relativeMatcher.group(2);
            return switch (unit) {
                case "분" -> now.minusMinutes(amount);
                case "시간" -> now.minusHours(amount);
                case "일" -> now.minusDays(amount);
                default -> null;
            };
        }

        // 절대 날짜 ("2026.03.02.")
        Matcher absoluteMatcher = ABSOLUTE_DATE_PATTERN.matcher(text);
        if (absoluteMatcher.find()) {
            int year = Integer.parseInt(absoluteMatcher.group(1));
            int month = Integer.parseInt(absoluteMatcher.group(2));
            int day = Integer.parseInt(absoluteMatcher.group(3));
            return LocalDateTime.of(year, month, day, 0, 0);
        }

        return null;
    }

    /**
     * 시간 기반 중단 판정.
     * 기사 발행 시각이 마지막 수집 시각보다 이전이면 true를 반환하여 수집을 중단시킨다.
     * (검색 결과가 최신순으로 정렬되어 있으므로, 이후 기사도 모두 이전일 것)
     */
    private boolean shouldStopByTime(LocalDateTime publishedAt, LocalDateTime lastCollectedAt, String keyword) {
        if (lastCollectedAt == null || publishedAt == null) return false;

        if (publishedAt.isBefore(lastCollectedAt)) {
            log.info("[네이버] keyword={}, 기사 시각({})이 마지막 수집({}) 이전 → 시간 기반 중단",
                    keyword, publishedAt, lastCollectedAt);
            return true;
        }
        return false;
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
        while (matcher.find() && results.size() < maxItemsPerKeyword) {
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
