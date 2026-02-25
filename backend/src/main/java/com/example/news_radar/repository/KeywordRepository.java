package com.example.news_radar.repository;

import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.KeywordStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KeywordRepository extends JpaRepository<Keyword, Long> {

    // 특정 상태의 키워드 조회 (크롤러·벡터 스토어 재빌드에 사용)
    List<Keyword> findByStatus(KeywordStatus status);

    // 대소문자 무시 중복 확인
    boolean existsByNameIgnoreCase(String name);

    // 이름으로 조회 (대소문자 무시)
    Optional<Keyword> findByNameIgnoreCase(String name);
}
