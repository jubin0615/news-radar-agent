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

    // ═══════════════════════════════════════════════
    // 기존 메서드 — 내부 서비스(크롤러, 시스템 초기화 등)에서 사용
    // ═══════════════════════════════════════════════

    // 전체 키워드 조회 (내부용 — 크롤러, 시스템 상태 확인 등)
    @Transactional(readOnly=true)
    public List<Keyword> getAllKeywords() {
        return keywordRepository.findAll();
    }

    // 키워드 등록 (내부용 — 시스템 초기화 등, 사용자 없이 등록)
    @Transactional
    public Optional<Keyword> addKeyword(String name) {
        String normalized = normalize(name);
        if (normalized.isBlank()) {
            return Optional.empty();
        }
        if (keywordRepository.existsByNameIgnoreCase(normalized)) {
            log.warn("키워드 등록 중복: {}", normalized);
            return Optional.empty();
        }

        // 새로 등록된 키워드는 기본적으로 ACTIVE 상태로 저장됨
        Keyword newKeyword = keywordRepository.save(new Keyword(normalized));
        return Optional.of(newKeyword);
    }

    /**
     * 키워드 영구 삭제 (하드 삭제). — 내부용
     * 연결된 뉴스를 소프트 삭제 후 키워드 레코드를 제거하고 벡터 스토어를 재빌드합니다.
     */
    @Transactional
    public boolean deleteKeyword(Long id) {
        Optional<Keyword> target = keywordRepository.findById(id);
        if (target.isEmpty()) {
            return false;
        }
        Keyword keyword = target.get();
        int deactivated = newsRepository.deactivateByKeyword(keyword.getName());
        keywordRepository.deleteById(id);

        log.info("키워드 삭제 완료: id={}, name={}, deactivatedNews={}", id, keyword.getName(), deactivated);

        triggerVectorStoreRebuildAsync();
        return true;
    }

    /**
     * 키워드 상태 전환. — 내부용
     *
     * 전환 규칙:
     *   → PAUSED   : 수집 중단, 기존 뉴스는 RDB에 보존 (소프트 삭제 없음)
     *   → ARCHIVED : 수집 중단 + 기존 뉴스 소프트 삭제
     *   → ACTIVE   : 수집 재개 (뉴스 상태 변경 없음, 다음 수집 사이클에 반영)
     *
     * ACTIVE에서 벗어날 때: 벡터 스토어 재빌드 (해당 키워드 기사 제거)
     * ACTIVE로 복귀할 때: 다음 수집 또는 수동 재빌드 시 자동 반영
     */
    @Transactional
    public Optional<Keyword> setStatus(Long id, KeywordStatus newStatus) {
        return keywordRepository.findById(id).map(keyword -> {
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

            // ACTIVE로 복귀 시: 소프트 삭제된 뉴스가 있으면 다시 활성화
            // (ARCHIVED → ACTIVE는 물론, PAUSED → ACTIVE에서도 안전하게 처리)
            if (newStatus == KeywordStatus.ACTIVE && oldStatus != KeywordStatus.ACTIVE) {
                int reactivated = newsRepository.reactivateByKeyword(saved.getName());
                if (reactivated > 0) {
                    log.info("키워드 재활성화: id={}, name={}, reactivatedNews={}", id, saved.getName(), reactivated);
                }
            }

            log.info("키워드 상태 변경: id={}, name={}, {} → {}", id, saved.getName(), oldStatus, newStatus);
            
            // ACTIVE 상태가 변경되었을 때 (ACTIVE로 오거나, ACTIVE에서 벗어날 때 둘 다) 재빌드 트리거
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
