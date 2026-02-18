package com.example.news_radar.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// 검색 키워드 엔티티 (딥러닝, LLM 등 관심 키워드를 관리)
@Entity
@Getter @Setter
@NoArgsConstructor
public class Keyword {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 키워드 이름 (예: "딥러닝", "LLM")
    @Column(unique = true)
    private String name;

    // 활성화 여부 (false면 수집 대상에서 제외)
    private boolean enabled = true;

    private LocalDateTime createdAt;

    public Keyword(String name) {
        this.name = name;
        this.createdAt = LocalDateTime.now();
    }
}
