package com.example.news_radar.repository;

import com.example.news_radar.entity.CrawledUrl;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Set;

/**
 * 크롤링 URL 히스토리 리포지토리
 * - 중복 수집 방지를 위한 URL 존재 여부 검사
 * - News 엔티티와 분리하여 하드 삭제 후에도 URL 이력 보존
 */
public interface CrawledUrlRepository extends JpaRepository<CrawledUrl, Long> {

    /** URL 존재 여부 확인 (중복 수집 방지) */
    boolean existsByUrl(String url);

    /** 전체 URL Set 조회 — Early Exit용 (크롤링 전 DB 중복 필터링) */
    @Query("SELECT c.url FROM CrawledUrl c")
    Set<String> findAllUrls();
}
