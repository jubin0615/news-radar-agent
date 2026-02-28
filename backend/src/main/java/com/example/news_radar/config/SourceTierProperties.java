package com.example.news_radar.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 뉴스 출처 도메인 Tier 설정.
 * application.properties 에서 app.source-tier.major-domains / standard-domains 로 관리.
 * 기본값이 내장되어 있으므로 별도 설정 없이도 동작합니다.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.source-tier")
public class SourceTierProperties {

    /** 메이저 언론사 / 공식 기관 도메인 (20점) */
    private List<String> majorDomains = List.of(
            // 국제 주요 언론
            "reuters.com", "bloomberg.com", "nytimes.com", "wsj.com",
            "ft.com", "bbc.com", "apnews.com",
            // 글로벌 IT 메이저
            "techcrunch.com", "wired.com", "theverge.com", "arstechnica.com",
            "venturebeat.com",
            // 국내 주요 언론
            "yna.co.kr", "chosun.com", "joongang.co.kr", "joins.com",
            "donga.com", "mk.co.kr", "hankyung.com", "kbs.co.kr", "sbs.co.kr",
            "ytn.co.kr", "sedaily.com", "edaily.co.kr"
    );

    /** IT 전문 미디어 도메인 (15점) */
    private List<String> standardDomains = List.of(
            // 국제 IT 전문
            "zdnet.com", "infoq.com", "thenewstack.io", "devops.com",
            "techradar.com", "towardsdatascience.com",
            // 국내 IT 전문
            "zdnet.co.kr", "itworld.co.kr", "ciokorea.com", "boannews.com",
            "etnews.com", "ddaily.co.kr", "aitimes.com", "digitaltoday.co.kr"
    );
}
