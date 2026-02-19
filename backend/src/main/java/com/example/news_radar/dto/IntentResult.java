package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * LLM 의도 분류 결과 DTO
 * - action: "collect" | "report" | "search" | "chat"
 * - keyword: "search" 액션일 때만 유효
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class IntentResult {
    private String action;
    private String keyword;
}
