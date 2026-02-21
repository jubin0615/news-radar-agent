package com.example.news_radar.dto;

/**
 * AI 중요도 평가 결과 DTO
 * LLM이 3가지 기준으로 평가한 결과를 담는 불변 레코드
 */
public record AiEvaluation(
        int impact,       // 파급력 (0~20): IT 생태계/산업에 미치는 영향력
        int innovation,   // 혁신성 (0~15): 기술적 참신함과 새로운 관점 제시 여부
        int timeliness,   // 시의성 (0~15): 현재 트렌드와의 관련성 및 시의적절함
        String reason,    // 중요도 판단 근거 (1~2문장)
        String category,  // 기술 카테고리 (예: "LLM", "보안", "반도체")
        String summary    // 핵심 내용 3줄 요약
) {}
