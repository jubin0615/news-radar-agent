package com.example.news_radar.config;

import com.example.news_radar.security.JwtAuthenticationEntryPoint;
import com.example.news_radar.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * JWT 인증 기반 보안 설정.
 *
 * - CSRF / Form Login / HTTP Basic 비활성화
 * - 세션 STATELESS (JWT 사용)
 * - /api/auth/**, H2 콘솔 → 인증 없이 접근 허용
 * - 그 외 /api/** → 인증 필요
 * - JwtAuthenticationFilter를 UsernamePasswordAuthenticationFilter 앞에 등록
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String[] allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // 인증 API — 누구나 접근 가능
                .requestMatchers("/api/auth/**").permitAll()
                // 시스템 초기화/상태 — 인증된 사용자만 (사용자별 키워드 격리)
                .requestMatchers("/api/system/**").authenticated()
                // H2 콘솔 (개발 전용)
                .requestMatchers("/h2-console/**").permitAll()
                // 그 외 API — 인증 필요
                .requestMatchers("/api/**").authenticated()
                // 나머지 (정적 리소스 등) — 허용
                .anyRequest().permitAll()
            )
            // 인증 실패 시 JSON 401 응답
            .exceptionHandling(ex -> ex.authenticationEntryPoint(jwtAuthenticationEntryPoint))
            // H2 콘솔 iframe 허용 (개발 전용)
            .headers(headers -> headers.frameOptions(fo -> fo.sameOrigin()))
            // JWT 필터 등록
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
