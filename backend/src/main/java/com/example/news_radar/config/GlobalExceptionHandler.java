package com.example.news_radar.config;

import com.example.news_radar.dto.ErrorResponse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

// 전역 예외 처리기 - 모든 컨트롤러의 에러를 여기서 잡아서 표준 형식으로 응답
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 필수 파라미터 누락
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException e) {
        ErrorResponse error = new ErrorResponse(400, "필수 파라미터가 없습니다: " + e.getParameterName());
        return ResponseEntity.badRequest().body(error);
    }

    // 잘못된 입력값
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException e) {
        ErrorResponse error = new ErrorResponse(400, e.getMessage());
        return ResponseEntity.badRequest().body(error);
    }

    // 그 외 모든 예외
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception e) {
        log.error("서버 내부 오류 발생: {}", e.getMessage(), e);
        ErrorResponse error = new ErrorResponse(500, "서버 내부 오류가 발생했습니다.");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
