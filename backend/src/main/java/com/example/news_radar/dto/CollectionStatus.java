package com.example.news_radar.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// 뉴스 수집 현황 DTO - 대시보드에서 현재 상태 확인용
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CollectionStatus {
    private boolean collecting;         // 현재 수집 진행 중 여부
    private int totalNewsCount;         // DB 전체 뉴스 수
    private int todayNewsCount;         // 오늘 수집된 뉴스 수
    private int activeKeywordCount;     // 활성 키워드 수
    private LocalDateTime lastCollectedAt;  // 마지막 수집 완료 시각
}
