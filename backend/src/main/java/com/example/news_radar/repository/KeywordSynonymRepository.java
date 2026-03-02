package com.example.news_radar.repository;

import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.KeywordSynonym;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KeywordSynonymRepository extends JpaRepository<KeywordSynonym, Long> {

    List<KeywordSynonym> findByKeyword(Keyword keyword);

    void deleteByKeyword(Keyword keyword);
}
