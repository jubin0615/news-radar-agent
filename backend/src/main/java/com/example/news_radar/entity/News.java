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

    // 최종 중요도 점수 (0~100) = LLM 평가(0~50) + 구조적 연관도(0~30) + 메타데이터 신뢰도(0~20)
    private Integer importanceScore;

    // 구조적/문맥적 연관도 점수 (0~30): 제목·리드 키워드 포함 여부
    private Integer keywordMatchScore;

    // LLM 평가 합산 점수 (0~50): 파급력(0~20) + 혁신성(0~15) + 시의성(0~15)
    private Integer aiScore;

    // 혁신성 세부 점수 (0~15): radarBoard 필터링 기준으로 활용
    private Integer innovationScore;

    // 시의성 세부 점수 (0~15): 트렌드 브리핑 정렬 기준으로 활용
    private Integer timelinessScore;

    // 메타데이터 신뢰도 점수 (0~20): 출처 도메인 Tier별 차등 부여
    private Integer metadataScore;

    // AI가 중요도를 판단한 근거
    @Column(columnDefinition = "TEXT")
    private String aiReason;

    // AI가 분류한 카테고리 (예: "LLM", "보안", "반도체")
    private String category;

    // 뉴스 수집 시각
    private LocalDateTime collectedAt;

    // 기사 발행일
    private String published;

    // 소프트 삭제 여부: true = 활성(기본), false = 보관/비활성
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean isActive = true;

    public News(String title, String url, String keyword) {
        this.title = title;
        this.url = url;
        this.keyword = keyword;
        this.collectedAt = LocalDateTime.now();
        this.isActive = true;
    }
}
