package com.example.news_radar.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

// 에러 응답 표준 형식
@Data
@AllArgsConstructor
public class ErrorResponse {
    private int code;           // HTTP 상태 코드
    private String message;     // 에러 메시지
    private LocalDateTime timestamp;

    public ErrorResponse(int code, String message) {
        this.code = code;
        this.message = message;
        this.timestamp = LocalDateTime.now();
    }
}
