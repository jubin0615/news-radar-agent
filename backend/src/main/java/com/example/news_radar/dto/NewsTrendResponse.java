package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NewsTrendResponse {
    private String fromDate;
    private String toDate;
    private int recentWindowDays;
    private int previousWindowDays;
    private int recentCount;
    private int previousCount;
    private int deltaCount;
    private double deltaRate;
    private List<TimelinePoint> timeline;
    private List<SignalShift> keywordShifts;
    private List<SignalShift> categoryShifts;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimelinePoint {
        private String date;
        private int totalCount;
        private int highImpactCount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SignalShift {
        private String name;
        private int recentCount;
        private int previousCount;
        private int deltaCount;
        private double deltaRate;
        private String momentum;
    }
}
