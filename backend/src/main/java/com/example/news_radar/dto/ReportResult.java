package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportResult {

    private ReportStats stats;
    private List<ArticleSummary> articles;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReportStats {
        private String keyword;
        private String date;
        private int totalCount;
        private double averageScore;
        private Map<String, Long> gradeDistribution;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ArticleSummary {
        private String title;
        private String url;
        private Integer importanceScore;
        private String grade;
        private Integer keywordMatchScore;
        private Integer aiScore;
        private String category;
        private String summary;
        private String aiReason;
    }
}
