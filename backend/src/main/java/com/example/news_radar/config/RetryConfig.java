package com.example.news_radar.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;

/**
 * Spring Retry 활성화 설정.
 *
 * 아키텍처 결정:
 *   @EnableRetry를 별도 Config 클래스에 분리하여 Retry 정책을 한 곳에서 관리.
 *   개별 서비스 메서드에 @Retryable을 선언하여 세밀한 재시도 전략 적용.
 *
 *   재시도 대상: OpenAI API 429 Rate Limit, 502/503 일시 장애
 *   재시도 제외: 파싱 오류, 인증 실패 등 비일시적(Non-Transient) 오류
 */
@Configuration
@EnableRetry
public class RetryConfig {
}
