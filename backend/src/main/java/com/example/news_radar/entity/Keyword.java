package com.example.news_radar.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 검색 키워드 엔티티
 *
 * status 필드로 생명주기를 관리합니다:
 *   ACTIVE   — 구독 중: 크롤러 수집 대상
 *   PAUSED   — 수집 정지: 수집 안 함, 기존 뉴스 보존
 *   ARCHIVED — 아카이브: 수집 안 함, 기존 뉴스 소프트 삭제
 *
 * DB 마이그레이션 메모:
 *   기존 'enabled' 컬럼은 Hibernate update 모드에서 자동 제거되지 않습니다.
 *   필요하다면 'ALTER TABLE keyword DROP COLUMN enabled;' 를 수동 실행하세요.
 */
@Entity
@Getter @Setter
@NoArgsConstructor
public class Keyword {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20) DEFAULT 'ACTIVE'")
    private KeywordStatus status = KeywordStatus.ACTIVE;

    private LocalDateTime createdAt;

    public Keyword(String name) {
        this.name = name;
        this.status = KeywordStatus.ACTIVE;
        this.createdAt = LocalDateTime.now();
    }
}
