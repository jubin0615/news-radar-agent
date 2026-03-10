package com.example.news_radar.service;

import com.example.news_radar.entity.AuthProvider;
import com.example.news_radar.entity.Role;
import com.example.news_radar.entity.User;
import com.example.news_radar.repository.UserRepository;
import com.example.news_radar.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜 로그인 후 백엔드 인증 처리.
 *
 * 프론트엔드(NextAuth.js)에서 OAuth 인증을 완료한 뒤,
 * 사용자 정보(email, name, provider)를 전달받아
 * DB에 저장(또는 기존 사용자 조회)하고 백엔드 전용 JWT를 발급한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * 소셜 로그인 콜백 처리.
     *
     * @return 백엔드 JWT 토큰
     */
    @Transactional
    public LoginResult loginOrRegister(String email, String name,
                                       AuthProvider provider, String providerId) {
        User user = userRepository.findByEmail(email)
                .map(existing -> {
                    // 기존 사용자: 프로바이더 정보 갱신 (다른 소셜로 같은 이메일 로그인 시)
                    if (existing.getProvider() != provider) {
                        existing.setProvider(provider);
                        existing.setProviderId(providerId);
                    }
                    if (name != null && !name.equals(existing.getName())) {
                        existing.setName(name);
                    }
                    return userRepository.save(existing);
                })
                .orElseGet(() -> {
                    // 신규 사용자 등록
                    User newUser = new User(email, name, provider, providerId, Role.USER);
                    User saved = userRepository.save(newUser);
                    log.info("신규 사용자 등록: id={}, email={}, provider={}", saved.getId(), email, provider);
                    return saved;
                });

        String token = jwtTokenProvider.generateToken(
                user.getId(), user.getEmail(), user.getRole().name());

        return new LoginResult(token, user);
    }

    public record LoginResult(String token, User user) {}
}
