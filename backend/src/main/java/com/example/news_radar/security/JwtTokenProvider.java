package com.example.news_radar.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT 토큰 생성·검증·파싱 유틸리티.
 *
 * 토큰 페이로드(claims):
 *   sub  — 사용자 ID (Long → String)
 *   email — 사용자 이메일
 *   role  — 사용자 권한 (USER / ADMIN)
 */
@Slf4j
@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long expirationMs;

    public JwtTokenProvider(
            @Value("${app.jwt.secret:default-secret-key-for-development-only-change-in-production-please}") String secret,
            @Value("${app.jwt.expiration-ms:86400000}") long expirationMs) {
        // HMAC-SHA256 최소 32바이트 키 보장
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
    }

    /** 액세스 토큰 생성 */
    public String generateToken(Long userId, String email, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("email", email)
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    /** 토큰에서 사용자 ID 추출 */
    public Long getUserId(String token) {
        return Long.parseLong(getClaims(token).getSubject());
    }

    /** 토큰에서 이메일 추출 */
    public String getEmail(String token) {
        return getClaims(token).get("email", String.class);
    }

    /** 토큰에서 역할 추출 */
    public String getRole(String token) {
        return getClaims(token).get("role", String.class);
    }

    /** 토큰 유효성 검증 */
    public boolean validateToken(String token) {
        try {
            getClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("JWT 만료: {}", e.getMessage());
        } catch (JwtException e) {
            log.warn("JWT 검증 실패: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.warn("JWT 토큰이 비어있거나 형식이 잘못됨: {}", e.getMessage());
        }
        return false;
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
