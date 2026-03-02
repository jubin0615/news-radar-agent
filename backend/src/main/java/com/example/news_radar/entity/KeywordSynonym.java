package com.example.news_radar.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 동적으로 생성된 키워드 동의어 캐시 엔티티.
 *
 * LLM(OpenAI)으로 생성한 동의어를 DB에 캐싱하여
 * 동일 키워드에 대한 반복 API 호출을 방지한다.
 * Keyword 엔티티와 N:1 관계.
 */
@Entity
@Getter @Setter
@NoArgsConstructor
public class KeywordSynonym {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "keyword_id", nullable = false)
    private Keyword keyword;

    @Column(nullable = false)
    private String synonym;

    public KeywordSynonym(Keyword keyword, String synonym) {
        this.keyword = keyword;
        this.synonym = synonym;
    }
}
