package com.example.news_radar.repository;

import com.example.news_radar.entity.News;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 뉴스 전용 리포지토리 - 필터링·정렬 쿼리 메서드 모음
 * isActive = true 인 뉴스만 조회 (Soft Delete 적용)
 */
public interface NewsRepository extends JpaRepository<News, Long> {

    // URL 중복 체크 — 활성 뉴스 기준 (소프트 삭제된 기사는 재수집 허용)
    boolean existsByUrlAndIsActiveTrue(String url);

    // 키워드의 기존 뉴스를 비활성화 (소프트 삭제) — 재수집 시 호출
    @Modifying
    @Transactional
    @Query("UPDATE News n SET n.isActive = false WHERE n.keyword = :keyword AND n.isActive = true")
    int deactivateByKeyword(String keyword);

    // 키워드 + 기간 조회 (활성만)
    @Query("SELECT n FROM News n WHERE n.keyword = :keyword AND n.isActive = true AND n.collectedAt BETWEEN :start AND :end")
    List<News> findByKeywordAndPeriod(String keyword, LocalDateTime start, LocalDateTime end);

    // 중요도 N점 이상, 높은 순 정렬 (활성만)
    @Query("SELECT n FROM News n WHERE n.isActive = true AND n.importanceScore >= :minScore ORDER BY n.importanceScore DESC")
    List<News> findByMinScore(int minScore);

    // 키워드로 조회 (최신순, 활성만)
    @Query("SELECT n FROM News n WHERE n.keyword = :keyword AND n.isActive = true ORDER BY n.collectedAt DESC")
    List<News> findByKeywordLatest(String keyword);

    // 키워드로 제목·본문·키워드 필드 검색 (LIKE, 최신순, 활성만) — 폴백용
    @Query("SELECT n FROM News n WHERE n.isActive = true AND (" +
           "LOWER(n.keyword) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(n.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(n.content) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY n.importanceScore DESC NULLS LAST")
    List<News> searchByKeyword(String keyword);

    // 중요도 순 전체 조회 (활성만)
    @Query("SELECT n FROM News n WHERE n.isActive = true ORDER BY n.importanceScore DESC")
    List<News> findAllByScore();

    // 날짜 범위로 조회 (일간 리포트용, 활성만)
    @Query("SELECT n FROM News n WHERE n.isActive = true AND n.collectedAt BETWEEN :start AND :end ORDER BY n.importanceScore DESC NULLS LAST")
    List<News> findByCollectedAtBetween(LocalDateTime start, LocalDateTime end);

    // 날짜 범위 내 활성 뉴스 건수
    @Query("SELECT COUNT(n) FROM News n WHERE n.isActive = true AND n.collectedAt BETWEEN :start AND :end")
    long countActiveByCollectedAtBetween(LocalDateTime start, LocalDateTime end);

    // 전체 활성 뉴스 건수
    long countByIsActiveTrue();

    // 가장 최근 수집된 활성 뉴스 (마지막 수집 시각 조회용)
    Optional<News> findTopByIsActiveTrueOrderByCollectedAtDesc();
}
