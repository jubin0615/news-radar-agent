package com.example.news_radar.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_user")   // "user"는 H2/SQL 예약어이므로 app_user 사용
@Getter @Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AuthProvider provider;

    // OAuth 제공자의 고유 사용자 ID (LOCAL 제공자는 null)
    private String providerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Role role;

    private LocalDateTime createdAt;

    public User(String email, String name, AuthProvider provider, String providerId, Role role) {
        this.email = email;
        this.name = name;
        this.provider = provider;
        this.providerId = providerId;
        this.role = role;
        this.createdAt = LocalDateTime.now();
    }
}
