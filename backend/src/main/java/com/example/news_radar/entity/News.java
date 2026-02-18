package com.example.news_radar.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter @Setter
@NoArgsConstructor
public class News {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String title;

    @Column(length = 1000)
    private String url;

    // 수집할 때 사용한 검색 키워드
    private String keyword;

    // 기사 본문 (요약·분석용)
    @Column(columnDefinition = "TEXT")
    private String content;

    // AI가 생성한 요약
    @Column(columnDefinition = "TEXT")
    private String summary;

    // 최종 중요도 점수 (0~100) = 키워드 매칭(0~50) + AI(0~50)
    private Integer importanceScore;

    // 키워드 매칭 점수 (0~50)
    private Integer keywordMatchScore;

    // AI가 부여한 점수 (1~10)
    private Integer aiScore;

    // AI가 중요도를 판단한 근거
    @Column(columnDefinition = "TEXT")
    private String aiReason;

    // AI가 분류한 카테고리 (예: "LLM", "보안", "반도체")
    private String category;

    // 뉴스 수집 시각
    private LocalDateTime collectedAt;

    // 기사 발행일
    private String published;

    public News(String title, String url, String keyword) {
        this.title = title;
        this.url = url;
        this.keyword = keyword;
        this.collectedAt = LocalDateTime.now();
    }
}
