package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// AI 중요도 평가 결과 DTO
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AiEvaluation {
    private int score;       // AI 점수 (1~10)
    private String reason;   // 중요도 판단 근거
    private String category; // 기술 카테고리
    private String summary;  // 3줄 요약
}
