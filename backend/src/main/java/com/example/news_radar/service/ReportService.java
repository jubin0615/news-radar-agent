package com.example.news_radar.service;

import com.example.news_radar.dto.ReportResult;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.NewsRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

// 뉴스 분석 리포트 생성 서비스 (티어링·컷오프·Connecting the Dots)
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final NewsRepository newsRepository;
    private final OpenAiService openAiService;

    // 리포트 저장 디렉토리
    private static final String REPORT_DIR = "reports";

    // Radar Board 편입 기준: innovationScore가 이 값 이상이면 잠재 트렌드로 분류
    private static final int RADAR_INNOVATION_THRESHOLD = 8;

    /**
     * 특정 키워드 + 날짜 기준 JSON 리포트 생성
     */
    public ReportResult generateReport(String keyword, LocalDate date) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = date.atTime(LocalTime.MAX);

        List<News> newsList = newsRepository.findByKeywordAndPeriod(keyword, start, end);
        return buildReportData(newsList);
    }

    /**
     * 전체 키워드 일일 리포트 (오늘 날짜 기준)
     */
    public ReportResult generateDailyReport() {
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.atTime(LocalTime.MAX);

        List<News> allToday = newsRepository.findByCollectedAtBetween(start, end);
        return buildReportData(allToday);
    }

    /**
     * 전체 수집된 뉴스 리포트 (오늘 뉴스가 없을 때 폴백용)
     */
    public ReportResult generateAllNewsReport() {
        List<News> allNews = newsRepository.findAllByScore();
        return buildReportData(allNews);
    }

    /**
     * 마크다운 리포트 생성 → 파일로 저장 후 경로 반환
     */
    public Optional<String> generateMarkdownReport(String keyword, LocalDate date) {
        ReportResult report = generateReport(keyword, date);
        String markdown = buildMarkdown(report);

        Path dir = Paths.get(REPORT_DIR);
        try {
            Files.createDirectories(dir);
            String filename = "report-" + keyword + "-" + date + ".md";
            Path filePath = dir.resolve(filename);
            Files.writeString(filePath, markdown);
            return Optional.of(filePath.toString());
        } catch (IOException e) {
            log.error("마크다운 리포트 저장 실패: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    // ==================== 핵심 티어링·컷오프 로직 ====================

    /**
     * 수집된 뉴스 목록을 티어링하여 ReportResult를 구성합니다.
     *
     * 알고리즘:
     *   1. 전체 뉴스 개수를 totalNewsCount에 저장
     *   2. importanceScore 내림차순 정렬 → 상위 3개를 headlines로 확정
     *   3. 나머지 뉴스 중 innovationScore >= RADAR_INNOVATION_THRESHOLD인 것을 radarBoard로 편입
     *   4. 두 그룹에 속하지 못한 뉴스는 과감히 Drop (통계 수치에만 반영)
     *   5. headlines + radarBoard를 합산하여 trendInsight 생성 (Connecting the Dots)
     */
    private ReportResult buildReportData(List<News> newsList) {
        int totalNewsCount = newsList.size();

        // importanceScore 내림차순 정렬 (null은 0으로 처리)
        List<News> sorted = newsList.stream()
                .filter(n -> n.getImportanceScore() != null)
                .sorted(Comparator.comparingInt(News::getImportanceScore).reversed())
                .collect(Collectors.toList());

        // Headlines: 상위 3개
        List<News> headlineNews = sorted.stream().limit(3).collect(Collectors.toList());

        // Radar Board: Top 3 이후 후보 중 innovationScore >= RADAR_INNOVATION_THRESHOLD
        Set<Long> headlineIds = headlineNews.stream()
                .map(News::getId)
                .collect(Collectors.toSet());

        List<News> radarNews = sorted.stream()
                .filter(n -> !headlineIds.contains(n.getId()))
                .filter(n -> n.getInnovationScore() != null
                        && n.getInnovationScore() >= RADAR_INNOVATION_THRESHOLD)
                .collect(Collectors.toList());

        int displayedNewsCount = headlineNews.size() + radarNews.size();

        log.info("[리포트] 전체={}건 | headlines={}건 | radarBoard={}건 | Drop={}건",
                totalNewsCount, headlineNews.size(), radarNews.size(),
                totalNewsCount - displayedNewsCount);

        // Connecting the Dots: 살아남은 뉴스들로만 트렌드 인사이트 생성
        List<News> topNews = Stream.concat(headlineNews.stream(), radarNews.stream())
                .collect(Collectors.toList());
        String trendInsight = openAiService.generateTrendInsight(topNews);

        // News → NewsItem DTO 변환
        List<ReportResult.NewsItem> headlines = headlineNews.stream()
                .map(this::toNewsItem)
                .collect(Collectors.toList());

        List<ReportResult.NewsItem> radarBoard = radarNews.stream()
                .map(this::toNewsItem)
                .collect(Collectors.toList());

        return new ReportResult(totalNewsCount, displayedNewsCount, trendInsight, headlines, radarBoard);
    }

    // News → NewsItem 변환
    private ReportResult.NewsItem toNewsItem(News news) {
        return new ReportResult.NewsItem(
                news.getTitle(),
                news.getUrl(),
                news.getImportanceScore(),
                news.getInnovationScore(),
                news.getCategory(),
                news.getSummary(),
                news.getAiReason()
        );
    }

    // ==================== 마크다운 생성 ====================

    private String buildMarkdown(ReportResult report) {
        StringBuilder md = new StringBuilder();

        md.append("# 뉴스 레이더 데일리 리포트\n\n");
        md.append("- **전체 검토 뉴스**: ").append(report.getTotalNewsCount()).append("건\n");
        md.append("- **리포트 수록 뉴스**: ").append(report.getDisplayedNewsCount()).append("건\n");
        md.append("- **Drop (컷오프)**: ")
                .append(report.getTotalNewsCount() - report.getDisplayedNewsCount()).append("건\n");

        md.append("\n---\n\n");

        // Trend Insight
        md.append("## Connecting the Dots — 트렌드 인사이트\n\n");
        md.append(report.getTrendInsight()).append("\n\n");

        md.append("---\n\n");

        // Headlines
        md.append("## 헤드라인 (Top 3)\n\n");
        if (report.getHeadlines().isEmpty()) {
            md.append("주요 뉴스가 없습니다.\n\n");
        } else {
            for (int i = 0; i < report.getHeadlines().size(); i++) {
                ReportResult.NewsItem item = report.getHeadlines().get(i);
                md.append("### ").append(i + 1).append(". ").append(item.getTitle()).append("\n");
                md.append("- **중요도**: ").append(item.getImportanceScore())
                        .append(" | **혁신성**: ").append(item.getInnovationScore()).append("/15\n");
                md.append("- **카테고리**: ").append(item.getCategory()).append("\n");
                md.append("- **AI 분석**: ").append(item.getAiReason()).append("\n");
                md.append("- **요약**: ").append(item.getSummary()).append("\n");
                md.append("- **링크**: ").append(item.getUrl()).append("\n\n");
            }
        }

        md.append("---\n\n");

        // Radar Board
        md.append("## 레이더 보드 (잠재 트렌드)\n\n");
        if (report.getRadarBoard().isEmpty()) {
            md.append("혁신성 기준(").append(RADAR_INNOVATION_THRESHOLD)
                    .append("/15)을 통과한 뉴스가 없습니다.\n\n");
        } else {
            for (ReportResult.NewsItem item : report.getRadarBoard()) {
                md.append("### ").append(item.getTitle()).append("\n");
                md.append("- **중요도**: ").append(item.getImportanceScore())
                        .append(" | **혁신성**: ").append(item.getInnovationScore()).append("/15\n");
                md.append("- **카테고리**: ").append(item.getCategory()).append("\n");
                md.append("- **AI 분석**: ").append(item.getAiReason()).append("\n");
                md.append("- **요약**: ").append(item.getSummary()).append("\n");
                md.append("- **링크**: ").append(item.getUrl()).append("\n\n");
            }
        }

        return md.toString();
    }
}
