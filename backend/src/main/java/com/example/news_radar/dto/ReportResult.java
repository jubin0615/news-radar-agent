package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportResult {

    /** 오늘 수집 및 검토한 전체 뉴스 개수 */
    private int totalNewsCount;

    /** 리포트에 실제 포함된(필터링 통과한) 핵심 뉴스 개수 */
    private int displayedNewsCount;

    /** AI가 주요 뉴스들 사이의 연관성·트렌드를 분석한 심층 인사이트 */
    private String trendInsight;

    /** importanceScore 상위 3개 핵심 뉴스 */
    private List<NewsItem> headlines;

    /** Top 3 탈락 후보 중 innovationScore 기준치 이상의 잠재 트렌드 뉴스 */
    private List<NewsItem> radarBoard;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NewsItem {
        private String title;
        private String url;
        private Integer importanceScore;
        private Integer innovationScore;
        private String category;
        private String summary;
        private String aiReason;
    }
}
