package com.example.news_radar.service;

import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.KeywordStatus;
import com.example.news_radar.entity.KeywordSynonym;
import com.example.news_radar.entity.User;
import com.example.news_radar.repository.KeywordRepository;
import com.example.news_radar.repository.KeywordSynonymRepository;
import com.example.news_radar.repository.NewsRepository;
import com.example.news_radar.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class KeywordService {

    private final KeywordRepository keywordRepository;
    private final KeywordSynonymRepository keywordSynonymRepository;
    private final NewsRepository newsRepository;
    private final UserRepository userRepository;
    private final NewsVectorStoreService newsVectorStoreService;
    private final KeywordSynonymRegistry synonymRegistry;
    private final OpenAiService openAiService;

    // ─── 사용자별 키워드 조회 ───
    @Transactional(readOnly = true)
    public List<Keyword> getKeywordsByUser(Long userId) {
        return keywordRepository.findByUserId(userId);
    }

    /** 사용자별 키워드 이름 목록 조회 — 컨트롤러 공용 헬퍼 */
    @Transactional(readOnly = true)
    public List<String> getKeywordNamesByUser(Long userId) {
        return keywordRepository.findByUserId(userId).stream()
                .map(Keyword::getName)
                .toList();
    }

    // ─── 사용자별 키워드 등록 ───
    @Transactional
    public Optional<Keyword> addKeyword(String name, Long userId) {
        String normalized = normalize(name);
        if (normalized.isBlank()) {
            return Optional.empty();
        }
        // 같은 사용자 내에서 중복 체크
        if (keywordRepository.existsByNameIgnoreCaseAndUserId(normalized, userId)) {
            log.warn("키워드 등록 중복: user={}, keyword={}", userId, normalized);
            return Optional.empty();
        }
        User user = userRepository.findById(userId).orElseThrow(
                () -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + userId));
        Keyword newKeyword = keywordRepository.save(new Keyword(normalized, user));
        return Optional.of(newKeyword);
    }

    // ─── 사용자별 키워드 삭제 ───
    @Transactional
    public boolean deleteKeyword(Long id, Long userId) {
        Optional<Keyword> target = keywordRepository.findByIdAndUserId(id, userId);
        if (target.isEmpty()) {
            return false;
        }
        Keyword keyword = target.get();
        int deactivated = newsRepository.deactivateByKeyword(keyword.getName());
        keywordSynonymRepository.deleteByKeyword(keyword);
        keywordRepository.deleteById(id);
        log.info("키워드 삭제 완료: userId={}, id={}, name={}, deactivatedNews={}", userId, id, keyword.getName(), deactivated);
        triggerVectorStoreRebuildAsync();
        return true;
    }

    // ─── 사용자별 상태 변경 ───
    @Transactional
    public Optional<Keyword> setStatus(Long id, KeywordStatus newStatus, Long userId) {
        return keywordRepository.findByIdAndUserId(id, userId).map(keyword -> {
            KeywordStatus oldStatus = keyword.getStatus();

            if (oldStatus == newStatus) {
                log.debug("키워드 상태 변경 없음: id={}, status={}", id, newStatus);
                return keyword;
            }

            keyword.setStatus(newStatus);
            Keyword saved = keywordRepository.save(keyword);

            if (newStatus == KeywordStatus.ARCHIVED) {
                int deactivated = newsRepository.deactivateByKeyword(saved.getName());
                log.info("키워드 아카이브: id={}, name={}, deactivatedNews={}", id, saved.getName(), deactivated);
            }

            if (newStatus == KeywordStatus.ACTIVE && oldStatus != KeywordStatus.ACTIVE) {
                int reactivated = newsRepository.reactivateByKeyword(saved.getName());
                if (reactivated > 0) {
                    log.info("키워드 재활성화: id={}, name={}, reactivatedNews={}", id, saved.getName(), reactivated);
                }
            }

            log.info("키워드 상태 변경: id={}, name={}, {} → {}", id, saved.getName(), oldStatus, newStatus);

            if (oldStatus == KeywordStatus.ACTIVE || newStatus == KeywordStatus.ACTIVE) {
                triggerVectorStoreRebuildAsync();
            }

            return saved;
        });
    }

    /**
     * 하이브리드 동의어 조회 (3단계 Fallback).
     *
     * 1단계: 정적 사전(KeywordSynonymRegistry) — 하드코딩된 동의어가 있으면 즉시 반환
     * 2단계: DB 캐시(KeywordSynonym 테이블) — 이전에 LLM으로 생성·캐싱된 동의어 반환
     * 3단계: LLM 호출(OpenAiService) — 신규 키워드에 대해 동의어 생성 후 DB 캐싱
     *
     * @param canonical 대표 키워드 (정규화 완료 상태)
     * @return 대표 키워드를 포함한 검색 변형어 리스트
     */
    @Transactional
    public List<String> getSearchVariants(String canonical) {
        // 1단계: 정적 사전 조회
        List<String> staticVariants = synonymRegistry.getSearchVariants(canonical);
        if (staticVariants.size() > 1) {
            log.debug("[동의어] 정적 사전 히트: keyword={}, variants={}", canonical, staticVariants);
            return staticVariants;
        }

        // 2단계: DB 캐시 조회
        Optional<Keyword> keywordOpt = keywordRepository.findByNameIgnoreCase(canonical);
        if (keywordOpt.isPresent()) {
            List<KeywordSynonym> cached = keywordSynonymRepository.findByKeyword(keywordOpt.get());
            if (!cached.isEmpty()) {
                List<String> variants = new ArrayList<>();
                variants.add(canonical);
                cached.forEach(s -> variants.add(s.getSynonym()));
                log.debug("[동의어] DB 캐시 히트: keyword={}, variants={}", canonical, variants);
                return variants;
            }
        }

        // 3단계: LLM 호출 → DB 캐싱
        List<String> generated = openAiService.generateSynonyms(canonical);
        if (!generated.isEmpty() && keywordOpt.isPresent()) {
            Keyword keyword = keywordOpt.get();
            for (String syn : generated) {
                keywordSynonymRepository.save(new KeywordSynonym(keyword, syn));
            }
            log.info("[동의어] LLM 생성 및 DB 캐싱 완료: keyword={}, synonyms={}", canonical, generated);
        }

        List<String> variants = new ArrayList<>();
        variants.add(canonical);
        variants.addAll(generated);
        return variants;
    }

    private String normalize(String name) {
        return synonymRegistry.toCanonical(name);
    }

    /**
     * 벡터 스토어 재빌드를 비동기로 실행하여 API 응답을 블로킹하지 않도록 한다.
     */
    private void triggerVectorStoreRebuildAsync() {
        CompletableFuture.runAsync(() -> {
            try {
                newsVectorStoreService.rebuildForActiveKeywords();
            } catch (Exception e) {
                log.error("벡터 스토어 재빌드 트리거 실패", e);
            }
        });
    }
}
