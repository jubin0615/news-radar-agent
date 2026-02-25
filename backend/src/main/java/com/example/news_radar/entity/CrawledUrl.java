package com.example.news_radar.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 크롤링된 URL 히스토리 (경량 엔티티)
 * - News 본문이 하드 삭제되어도 URL 이력은 영구 보존
 * - 중복 수집 방지의 단일 출처
 */
@Entity
@Table(indexes = @Index(name = "idx_crawled_url", columnList = "url", unique = true))
@Getter
@NoArgsConstructor
public class CrawledUrl {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 1000, nullable = false, unique = true)
    private String url;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public CrawledUrl(String url) {
        this.url = url;
        this.createdAt = LocalDateTime.now();
    }
}
