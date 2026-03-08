package com.example.news_radar.repository;

import com.example.news_radar.entity.AuthProvider;
import com.example.news_radar.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByProviderAndProviderId(AuthProvider provider, String providerId);
}
