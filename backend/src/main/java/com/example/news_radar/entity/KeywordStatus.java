package com.example.news_radar.entity;

/**
 * 키워드 생명주기 상태
 * - ACTIVE  : 구독 중 — 크롤러 수집 대상
 * - PAUSED  : 수집 정지 — 수집 안 함, 기존 뉴스는 RDB에 보존
 * - ARCHIVED: 아카이브 — 수집 안 함, 기존 뉴스 소프트 삭제
 */
public enum KeywordStatus {
    ACTIVE,
    PAUSED,
    ARCHIVED
}
