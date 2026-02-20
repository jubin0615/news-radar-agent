package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * POST /api/chat/rag 응답 DTO
 * - answer  : GPT-4o-mini가 생성한 한국어 답변 (마크다운)
 * - sources : 답변 근거로 사용된 뉴스 기사 목록
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RagResponse {

    private String answer;
    private List<RagSourceItem> sources;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RagSourceItem {
        private Long    id;
        private String  title;
        private String  url;
        private String  keyword;
        private String  summary;
        private Integer importanceScore;
        private String  grade;
        private String  category;
        /** 벡터 검색 코사인 유사도 (0.0 ~ 1.0) */
        private Double  score;
    }
}
