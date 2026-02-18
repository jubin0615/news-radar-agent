package com.example.news_radar.service;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 키워드 매칭 기반 중요도 점수 계산기 (0~50점)
@Component
public class ImportanceEvaluator {

    /**
     * 제목 + 본문에서 키워드 출현 빈도를 분석해 점수 산출
     * - 제목에 등장하면 가중치 3배
     * - 본문에 등장하면 가중치 1배
     * - 최대 50점으로 정규화
     */
    public int calculateKeywordScore(String title, String content, List<String> keywords) {
        if (keywords == null || keywords.isEmpty()) return 0;

        int totalScore = 0;

        for (String keyword : keywords) {
            // 대소문자 무시해서 매칭
            Pattern pattern = Pattern.compile(Pattern.quote(keyword), Pattern.CASE_INSENSITIVE);

            // 제목에서 키워드 출현 횟수 × 3점
            totalScore += countMatches(pattern, title) * 3;

            // 본문에서 키워드 출현 횟수 × 1점
            if (content != null && !content.isEmpty()) {
                totalScore += countMatches(pattern, content);
            }
        }

        // 최대 50점으로 캡핑
        return Math.min(totalScore, 50);
    }

    // 정규식 매칭 횟수 카운트
    private int countMatches(Pattern pattern, String text) {
        if (text == null) return 0;
        Matcher matcher = pattern.matcher(text);
        int count = 0;
        while (matcher.find()) count++;
        return count;
    }

    /**
     * 최종 중요도 계산: 키워드 매칭(0~50) + AI 점수(0~50) = 0~100
     * AI 점수(1~10)를 0~50 스케일로 변환
     */
    public int calculateFinalScore(int keywordMatchScore, int aiScore) {
        // AI 점수 1~10 → 0~50으로 정규화
        int normalizedAiScore = (int) ((aiScore / 10.0) * 50);
        return Math.min(keywordMatchScore + normalizedAiScore, 100);
    }

    // 점수 → 등급 변환
    public static String getGrade(int score) {
        if (score >= 80) return "CRITICAL";
        if (score >= 60) return "HIGH";
        if (score >= 40) return "MEDIUM";
        return "LOW";
    }
}
