package com.example.news_radar.repository;

import com.example.news_radar.entity.Keyword;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

// 키워드 전용 리포지토리
public interface KeywordRepository extends JpaRepository<Keyword, Long> {

    // 활성화된 키워드만 조회
    List<Keyword> findByEnabledTrue();

    // 이름으로 키워드 존재 여부 확인
    boolean existsByName(String name);
}
