package com.example.news_radar.service;

import com.example.news_radar.entity.Keyword;
import com.example.news_radar.entity.KeywordStatus;
import com.example.news_radar.repository.KeywordRepository;
import com.example.news_radar.repository.NewsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class KeywordService {

    private final KeywordRepository keywordRepository;
    private final NewsRepository newsRepository;
    private final NewsVectorStoreService newsVectorStoreService;

    // 전체 키워드 조회
    @Transactional(readOnly=true)
    public List<Keyword> getAllKeywords() {
        return keywordRepository.findAll();
    }

    // 키워드 등록
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
     * 키워드 영구 삭제 (하드 삭제).
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
     * 키워드 상태 전환.
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

    private String normalize(String name) {
        if (name == null) return "";
        return name.trim().toLowerCase();
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
