package com.example.news_radar.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// 뉴스 목록 응답 DTO - content(본문) 제외로 응답 크기 축소
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NewsResponse {
    private Long id;
    private String title;
    private String url;
    private String keyword;
    private String summary;           // 본문 대신 AI 요약만 포함
    private Integer importanceScore;  // 최종 중요도 (0~100)
    private String grade;             // 등급 (CRITICAL/HIGH/MEDIUM/LOW)
    private String category;          // AI 분류 카테고리
    private String aiReason;          // AI 판단 근거
    private LocalDateTime collectedAt;
}
