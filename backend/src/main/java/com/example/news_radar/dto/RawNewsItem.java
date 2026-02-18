package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// 크롤링한 원시 뉴스 데이터 (DB 저장 전 임시 객체)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RawNewsItem {
    private String title;    // 기사 제목
    private String url;      // 기사 링크
    private String content;  // 기사 본문
}
