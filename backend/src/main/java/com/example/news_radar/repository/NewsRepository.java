package com.example.news_radar.repository;

import com.example.news_radar.entity.News;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 뉴스 전용 리포지토리 - 필터링·정렬 쿼리 메서드 모음
 */
public interface NewsRepository extends JpaRepository<News, Long> {

    // URL 중복 체크 (같은 기사 재수집 방지)
    boolean existsByUrl(String url);

    // 키워드 + 기간 조회
    @Query("SELECT n FROM News n WHERE n.keyword = :keyword AND n.collectedAt BETWEEN :start AND :end")
    List<News> findByKeywordAndPeriod(String keyword, LocalDateTime start, LocalDateTime end);

    // 중요도 N점 이상, 높은 순 정렬
    @Query("SELECT n FROM News n WHERE n.importanceScore >= :minScore ORDER BY n.importanceScore DESC")
    List<News> findByMinScore(int minScore);

    // 키워드로 조회 (최신순)
    @Query("SELECT n FROM News n WHERE n.keyword = :keyword ORDER BY n.collectedAt DESC")
    List<News> findByKeywordLatest(String keyword);

    // 키워드로 제목·본문·키워드 필드 검색 (LIKE, 최신순) — 폴백용
    @Query("SELECT n FROM News n WHERE " +
           "LOWER(n.keyword) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(n.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(n.content) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "ORDER BY n.importanceScore DESC NULLS LAST")
    List<News> searchByKeyword(String keyword);

    // 중요도 순 전체 조회
    @Query("SELECT n FROM News n ORDER BY n.importanceScore DESC")
    List<News> findAllByScore();

    // 날짜 범위로 조회 (일간 리포트용)
    @Query("SELECT n FROM News n WHERE n.collectedAt BETWEEN :start AND :end ORDER BY n.importanceScore DESC NULLS LAST")
    List<News> findByCollectedAtBetween(LocalDateTime start, LocalDateTime end);

    long countByCollectedAtBetween(LocalDateTime start, LocalDateTime end);

    Optional<News> findTopByOrderByCollectedAtDesc();
}
