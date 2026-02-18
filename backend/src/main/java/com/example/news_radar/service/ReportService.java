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

// 뉴스 분석 리포트 생성 서비스 (JSON + 마크다운)
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final NewsRepository newsRepository;

    // 리포트 저장 디렉토리
    private static final String REPORT_DIR = "reports";

    /**
     * 특정 키워드 + 날짜 기준 JSON 리포트 생성
     */
    public ReportResult generateReport(String keyword, LocalDate date) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = date.atTime(LocalTime.MAX);

        List<News> newsList = newsRepository.findByKeywordAndPeriod(keyword, start, end);

        return buildReportData(keyword, date, newsList);
    }

    /**
     * 전체 키워드 일일 리포트 (오늘 날짜 기준)
     */
    public ReportResult generateDailyReport() {
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.atTime(LocalTime.MAX);

        List<News> allToday = newsRepository.findByCollectedAtBetween(start, end);

        return buildReportData("전체", today, allToday);
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

    // 리포트 데이터 구조 생성
    private ReportResult buildReportData(String keyword, LocalDate date, List<News> newsList) {
        double avgScore = newsList.stream()
                .filter(n -> n.getImportanceScore() != null)
                .mapToInt(News::getImportanceScore)
                .average()
                .orElse(0);

        Map<String, Long> gradeDistribution = newsList.stream()
                .filter(n -> n.getImportanceScore() != null)
                .collect(Collectors.groupingBy(
                        n -> ImportanceEvaluator.getGrade(n.getImportanceScore()),
                        Collectors.counting()));

        ReportResult.ReportStats stats = new ReportResult.ReportStats(
                keyword,
                date.toString(),
                newsList.size(),
                Math.round(avgScore * 10) / 10.0,
                gradeDistribution
        );

        List<ReportResult.ArticleSummary> articles = newsList.stream()
                .sorted(Comparator.comparingInt(n -> -(n.getImportanceScore() != null ? n.getImportanceScore() : 0)))
                .map(this::newsToArticleSummary)
                .collect(Collectors.toList());

        return new ReportResult(stats, articles);
    }

    // News → ArticleSummary 변환
    private ReportResult.ArticleSummary newsToArticleSummary(News news) {
        return new ReportResult.ArticleSummary(
                news.getTitle(),
                news.getUrl(),
                news.getImportanceScore(),
                news.getImportanceScore() != null ? ImportanceEvaluator.getGrade(news.getImportanceScore()) : "N/A",
                news.getKeywordMatchScore(),
                news.getAiScore(),
                news.getCategory(),
                news.getSummary(),
                news.getAiReason()
        );
    }

    // 마크다운 리포트 문자열 생성
    private String buildMarkdown(ReportResult report) {
        StringBuilder md = new StringBuilder();
        ReportResult.ReportStats stats = report.getStats();
        List<ReportResult.ArticleSummary> articles = report.getArticles();

        md.append("# 뉴스 분석 리포트\n\n");
        md.append("- **키워드**: ").append(stats.getKeyword()).append("\n");
        md.append("- **날짜**: ").append(stats.getDate()).append("\n");
        md.append("- **총 수집 건수**: ").append(stats.getTotalCount()).append("건\n");
        md.append("- **평균 중요도**: ").append(stats.getAverageScore()).append("점\n");

        Map<String, Long> grades = stats.getGradeDistribution();
        if (grades != null && !grades.isEmpty()) {
            md.append("- **등급 분포**: ");
            grades.forEach((grade, count) -> md.append(grade).append("(").append(count).append(") "));
            md.append("\n");
        }

        md.append("\n---\n\n");

        md.append("## 주요 기사 (HIGH 이상)\n\n");
        boolean hasImportant = false;
        for (ReportResult.ArticleSummary article : articles) {
            if (article.getImportanceScore() != null && article.getImportanceScore() >= 60) {
                hasImportant = true;
                md.append("### ").append(article.getTitle()).append("\n");
                md.append("- **점수**: ").append(article.getImportanceScore())
                        .append(" (").append(article.getGrade()).append(")\n");
                md.append("- **카테고리**: ").append(article.getCategory()).append("\n");
                md.append("- **AI 분석**: ").append(article.getAiReason()).append("\n");
                md.append("- **요약**: ").append(article.getSummary()).append("\n");
                md.append("- **링크**: ").append(article.getUrl()).append("\n\n");
            }
        }
        if (!hasImportant) md.append("해당 등급의 기사가 없습니다.\n\n");

        md.append("---\n\n## 전체 기사 목록\n\n");
        md.append("| 순위 | 점수 | 등급 | 카테고리 | 제목 |\n");
        md.append("|------|------|------|----------|------|\n");
        int rank = 1;
        for (ReportResult.ArticleSummary article : articles) {
            md.append("| ").append(rank++).append(" | ")
              .append(article.getImportanceScore()).append(" | ")
              .append(article.getGrade()).append(" | ")
              .append(article.getCategory()).append(" | ")
              .append(article.getTitle()).append(" |\n");
        }

        return md.toString();
    }
}
