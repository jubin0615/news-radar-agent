package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SSE 실시간 수집 진행률 이벤트 DTO
 *
 * type:
 *   STARTED         - 수집 시작
 *   KEYWORD_BEGIN   - 키워드 수집 시작
 *   CRAWL_DONE      - 크롤링 목록 수집 완료
 *   FILTER_DONE     - URL 중복 필터링 완료
 *   AI_EVAL_BEGIN   - AI 분석 시작
 *   SAVE_DONE       - 저장 완료
 *   KEYWORD_COMPLETE- 키워드 수집 완료
 *   COMPLETED       - 전체 수집 완료
 *   ERROR           - 오류 발생
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CollectionProgressEvent {
    private String type;
    private String keyword;
    private String message;
    private int currentStep;
    private int totalSteps;
    private int percentage;
    private Integer count;
}
