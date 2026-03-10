package com.example.news_radar.controller;

import com.example.news_radar.entity.AuthProvider;
import com.example.news_radar.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 인증 API
 *
 * POST /api/auth/login — 소셜 로그인 후 백엔드 JWT 발급
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * 프론트엔드(NextAuth.js)에서 소셜 인증 완료 후 호출.
     * 사용자 정보를 받아 DB 저장/조회 후 백엔드 JWT를 반환한다.
     *
     * Request body:
     * {
     *   "email": "user@example.com",
     *   "name": "User Name",
     *   "provider": "GOOGLE",       // GOOGLE | GITHUB | LOCAL
     *   "providerId": "12345"       // optional
     * }
     *
     * Response:
     * {
     *   "token": "eyJhbGciOi...",
     *   "user": { "id": 1, "email": "...", "name": "...", "role": "USER" }
     * }
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest request) {
        AuthProvider provider;
        try {
            provider = AuthProvider.valueOf(request.provider().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid provider: " + request.provider()));
        }

        AuthService.LoginResult result = authService.loginOrRegister(
                request.email(), request.name(), provider, request.providerId());

        return ResponseEntity.ok(Map.of(
                "token", result.token(),
                "user", Map.of(
                        "id", result.user().getId(),
                        "email", result.user().getEmail(),
                        "name", result.user().getName(),
                        "role", result.user().getRole().name()
                )
        ));
    }

    record LoginRequest(String email, String name, String provider, String providerId) {}
}
