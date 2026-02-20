package com.example.news_radar.service;

import com.example.news_radar.dto.NewsTrendResponse;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.NewsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class NewsTrendService {

    private final NewsRepository newsRepository;

    public NewsTrendResponse analyzeTrends(int days) {
        int periodDays = Math.max(3, Math.min(30, days));
        int windowDays = Math.max(1, Math.min(3, periodDays / 3));
        LocalDate today = LocalDate.now();
        LocalDate timelineStartDate = today.minusDays(periodDays - 1L);

        try {
            LocalDateTime timelineStart = timelineStartDate.atStartOfDay();
            LocalDateTime timelineEnd = today.atTime(LocalTime.MAX);

            List<News> newsList = newsRepository.findByCollectedAtBetween(timelineStart, timelineEnd);

            List<NewsTrendResponse.TimelinePoint> timeline = buildTimeline(newsList, timelineStartDate, today);
            WindowMetrics metrics = buildWindowMetrics(newsList, today, windowDays);

            return new NewsTrendResponse(
                    timelineStartDate.toString(),
                    today.toString(),
                    windowDays,
                    windowDays,
                    metrics.recentCount(),
                    metrics.previousCount(),
                    metrics.recentCount() - metrics.previousCount(),
                    round2(changeRate(metrics.recentCount(), metrics.previousCount())),
                    timeline,
                    metrics.keywordShifts(),
                    metrics.categoryShifts()
            );
        } catch (Exception e) {
            log.error("Trend analysis failed. days={}", days, e);
            return emptyResponse(today, timelineStartDate, windowDays);
        }
    }

    private List<NewsTrendResponse.TimelinePoint> buildTimeline(List<News> newsList, LocalDate start, LocalDate end) {
        Map<LocalDate, Counter> timeline = new LinkedHashMap<>();
        LocalDate cursor = start;
        while (!cursor.isAfter(end)) {
            timeline.put(cursor, new Counter());
            cursor = cursor.plusDays(1);
        }

        for (News news : newsList) {
            if (news == null) {
                continue;
            }

            LocalDateTime collectedAt = news.getCollectedAt();
            if (collectedAt == null) {
                continue;
            }
            LocalDate date = collectedAt.toLocalDate();
            Counter counter = timeline.get(date);
            if (counter == null) {
                continue;
            }
            counter.total++;
            if (news.getImportanceScore() != null && news.getImportanceScore() >= 60) {
                counter.highImpact++;
            }
        }

        List<NewsTrendResponse.TimelinePoint> points = new ArrayList<>();
        for (Map.Entry<LocalDate, Counter> entry : timeline.entrySet()) {
            points.add(new NewsTrendResponse.TimelinePoint(
                    entry.getKey().toString(),
                    entry.getValue().total,
                    entry.getValue().highImpact
            ));
        }
        return points;
    }

    private WindowMetrics buildWindowMetrics(List<News> newsList, LocalDate today, int windowDays) {
        LocalDate recentStart = today.minusDays(windowDays - 1L);
        LocalDate recentEnd = today;
        LocalDate previousEnd = recentStart.minusDays(1);
        LocalDate previousStart = previousEnd.minusDays(windowDays - 1L);

        int recentCount = 0;
        int previousCount = 0;

        Map<String, ShiftCounter> keywordCounters = new HashMap<>();
        Map<String, ShiftCounter> categoryCounters = new HashMap<>();

        for (News news : newsList) {
            if (news == null) {
                continue;
            }

            LocalDateTime collectedAt = news.getCollectedAt();
            if (collectedAt == null) {
                continue;
            }

            LocalDate date = collectedAt.toLocalDate();
            boolean inRecent = !date.isBefore(recentStart) && !date.isAfter(recentEnd);
            boolean inPrevious = !date.isBefore(previousStart) && !date.isAfter(previousEnd);
            if (!inRecent && !inPrevious) {
                continue;
            }

            if (inRecent) {
                recentCount++;
            } else {
                previousCount++;
            }

            String keyword = normalizeSignal(news.getKeyword(), "미분류 키워드");
            String category = normalizeSignal(news.getCategory(), "미분류 카테고리");

            increment(keywordCounters, keyword, inRecent);
            increment(categoryCounters, category, inRecent);
        }

        List<NewsTrendResponse.SignalShift> keywordShifts = buildSignalShifts(keywordCounters);
        List<NewsTrendResponse.SignalShift> categoryShifts = buildSignalShifts(categoryCounters);

        return new WindowMetrics(recentCount, previousCount, keywordShifts, categoryShifts);
    }

    private void increment(Map<String, ShiftCounter> counters, String key, boolean recent) {
        ShiftCounter counter = counters.computeIfAbsent(key, ignored -> new ShiftCounter());
        if (recent) {
            counter.recent++;
        } else {
            counter.previous++;
        }
    }

    private List<NewsTrendResponse.SignalShift> buildSignalShifts(Map<String, ShiftCounter> counters) {
        return counters.entrySet().stream()
                .map(entry -> {
                    int recent = entry.getValue().recent;
                    int previous = entry.getValue().previous;
                    int delta = recent - previous;
                    double rate = round2(changeRate(recent, previous));
                    return new NewsTrendResponse.SignalShift(
                            entry.getKey(),
                            recent,
                            previous,
                            delta,
                            rate,
                            momentum(delta, rate, recent)
                    );
                })
                .filter(shift -> shift.getRecentCount() > 0 || shift.getPreviousCount() > 0)
                .sorted((a, b) -> {
                    int byDelta = Integer.compare(b.getDeltaCount(), a.getDeltaCount());
                    if (byDelta != 0) {
                        return byDelta;
                    }
                    int byRecent = Integer.compare(b.getRecentCount(), a.getRecentCount());
                    if (byRecent != 0) {
                        return byRecent;
                    }
                    return nullSafe(a.getName()).compareToIgnoreCase(nullSafe(b.getName()));
                })
                .limit(8)
                .toList();
    }

    private String momentum(int delta, double rate, int recent) {
        if (delta >= 3 || (recent >= 3 && rate >= 100)) {
            return "SURGING";
        }
        if (delta > 0) {
            return "RISING";
        }
        if (delta == 0) {
            return "STEADY";
        }
        if (recent == 0) {
            return "COOLING";
        }
        return "FADING";
    }

    private String normalizeSignal(String value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return fallback;
        }
        return normalized;
    }

    private double changeRate(int current, int previous) {
        if (previous <= 0) {
            return current <= 0 ? 0.0 : 100.0;
        }
        return ((current - previous) / (double) previous) * 100.0;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private NewsTrendResponse emptyResponse(LocalDate today, LocalDate timelineStartDate, int windowDays) {
        return new NewsTrendResponse(
                timelineStartDate.toString(),
                today.toString(),
                windowDays,
                windowDays,
                0,
                0,
                0,
                0.0,
                buildTimeline(List.of(), timelineStartDate, today),
                List.of(),
                List.of()
        );
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private static class Counter {
        private int total;
        private int highImpact;
    }

    private static class ShiftCounter {
        private int recent;
        private int previous;
    }

    private record WindowMetrics(
            int recentCount,
            int previousCount,
            List<NewsTrendResponse.SignalShift> keywordShifts,
            List<NewsTrendResponse.SignalShift> categoryShifts
    ) {
    }
}
