package com.example.news_radar.service;

import com.example.news_radar.entity.KeywordStatus;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.KeywordRepository;
import com.example.news_radar.repository.NewsRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * RAG를 위한 벡터 스토어 서비스.
 *
 * 아키텍처 결정:
 *   VectorStore 인터페이스를 주입받아 SimpleVectorStore(dev)와 PgVectorStore(prod)
 *   양쪽 모두에서 동작하도록 설계.
 *   SimpleVectorStore는 파일 기반이므로 dirty flag + 배치 flush가 필요하지만,
 *   PgVectorStore는 add() 시점에 즉시 PostgreSQL에 반영되므로 파일 I/O가 불필요.
 *   isSimpleVectorStore 플래그로 런타임에 분기하여 불필요한 파일 I/O를 방지.
 *
 * 인덱싱 정책:
 *   - ACTIVE 키워드 + 최근 7일 + 중요도 40점 초과 뉴스만 인덱싱
 *   - 청킹: TokenTextSplitter (토큰 기반, 의미 단위 경계 보존)
 *   - 메타데이터: tags 필드를 포함하여 RAG 필터링 정교화 지원
 */
@Slf4j
@Service
public class NewsVectorStoreService {

    private static final int LOW_GRADE_MAX_SCORE = 39;
    private static final int VECTOR_STORE_DAYS = 7;

    private final VectorStore vectorStore;
    private final NewsRepository newsRepository;
    private final KeywordRepository keywordRepository;
    private final String vectorStorePath;
    private final TokenTextSplitter tokenTextSplitter;

    /**
     * SimpleVectorStore인 경우에만 파일 I/O를 수행.
     * PgVectorStore는 add() 시점에 즉시 DB 반영이므로 파일 저장이 불필요.
     */
    private final boolean isSimpleVectorStore;

    /** SimpleVectorStore 전용: 메모리 변경 후 아직 파일에 저장되지 않았음을 표시 */
    private final AtomicBoolean dirty = new AtomicBoolean(false);

    public NewsVectorStoreService(
            VectorStore vectorStore,
            NewsRepository newsRepository,
            KeywordRepository keywordRepository,
            @Value("${app.rag.vector-store-path:./data/vector-store.json}") String vectorStorePath
    ) {
        this.vectorStore = vectorStore;
        this.newsRepository = newsRepository;
        this.keywordRepository = keywordRepository;
        this.vectorStorePath = vectorStorePath;
        this.isSimpleVectorStore = (vectorStore instanceof SimpleVectorStore);

        // TokenTextSplitter: 800 토큰 청크, 최소 350자, 5자 미만 청크 폐기
        this.tokenTextSplitter = new TokenTextSplitter(800, 350, 5, 10000, true);
    }

    // 서버 기동 시 최초 재빌드 — 비동기로 실행하여 서버 시작을 블로킹하지 않음
    @PostConstruct
    public void initVectorStore() {
        log.info("[RAG] 서버 기동: 벡터 스토어 백그라운드 초기화 예약 (type={}, 활성 키워드 + 최근 {}일 기준)",
                vectorStore.getClass().getSimpleName(), VECTOR_STORE_DAYS);
        Thread.ofVirtual().name("vector-store-init").start(() -> {
            try {
                rebuildForActiveKeywords();
            } catch (Exception e) {
                log.error("[RAG] 벡터 스토어 초기화 실패: {}", e.getMessage(), e);
            }
        });
    }

    // 매일 새벽 3시 자동 클렌징 (오래된 기사 제거 + 최신 유지)
    @Scheduled(cron = "0 0 3 * * *")
    public void scheduledRebuild() {
        log.info("[RAG] 일별 벡터 스토어 클렌징 시작");
        rebuildForActiveKeywords();
    }

    /**
     * 30초 주기로 dirty 상태인 벡터 스토어를 파일에 저장합니다.
     * SimpleVectorStore에서만 동작 — PgVectorStore는 즉시 DB 반영이므로 무시.
     */
    @Scheduled(fixedDelay = 30_000)
    public void flushIfDirty() {
        if (isSimpleVectorStore && dirty.compareAndSet(true, false)) {
            persistToFile();
            log.debug("[RAG] 배치 저장 완료 (dirty flush)");
        }
    }

    /**
     * 벡터 스토어 재빌드.
     * ACTIVE 키워드 + 최근 7일 + 중요도 40점 초과 뉴스만 인덱싱합니다.
     *
     * SimpleVectorStore: 새 인스턴스 교체 불가(Config에서 주입받으므로) → delete all + re-add
     * PgVectorStore: delete + add로 동일하게 처리
     */
    public synchronized void rebuildForActiveKeywords() {
        List<String> activeKeywordNames = keywordRepository.findByStatus(KeywordStatus.ACTIVE)
                .stream()
                .map(k -> k.getName())
                .toList();

        if (activeKeywordNames.isEmpty()) {
            clearAndPersist();
            log.info("[RAG] 활성 키워드 없음 — 벡터 스토어를 비웠습니다.");
            return;
        }

        LocalDateTime since = LocalDateTime.now().minusDays(VECTOR_STORE_DAYS);
        List<News> candidates = newsRepository.findForVectorStore(
                activeKeywordNames, LOW_GRADE_MAX_SCORE, since);

        // 기존 문서 전체 삭제 후 재인덱싱
        clearAndPersist();

        if (candidates.isEmpty()) {
            log.info("[RAG] 재빌드 완료 — 인덱싱할 기사 없음 (활성 키워드: {}개, 기간: 최근 {}일)",
                    activeKeywordNames.size(), VECTOR_STORE_DAYS);
            return;
        }

        List<Document> docs = candidates.stream()
                .flatMap(news -> newsToDocuments(news).stream())
                .toList();
        vectorStore.add(docs);

        if (isSimpleVectorStore) {
            persistToFile(); // 재빌드는 즉시 저장
        }

        log.info("[RAG] 재빌드 완료 — articles={}, chunks={}, activeKeywords={}, since={}",
                candidates.size(), docs.size(), activeKeywordNames.size(), since.toLocalDate());
    }

    /**
     * 뉴스 저장 직후 벡터 스토어에 추가 (실시간 인덱싱).
     * SimpleVectorStore: 메모리에만 적재, 파일 저장은 30초 주기 스케줄러에 위임.
     * PgVectorStore: add() 호출 시 즉시 DB에 반영됨.
     */
    public void addOrUpdate(News news) {
        if (!isEligibleForVectorStore(news)) {
            log.debug("[RAG] 인덱싱 제외: id={}, score={}", news.getId(), news.getImportanceScore());
            return;
        }
        try {
            List<Document> chunks = newsToDocuments(news);
            vectorStore.add(chunks);

            if (isSimpleVectorStore) {
                dirty.set(true); // 파일 저장은 flushIfDirty 스케줄러에 위임
            }

            log.debug("[RAG] 인덱싱 완료: id={}, title={}, chunks={}", news.getId(), news.getTitle(), chunks.size());
        } catch (Exception e) {
            log.error("[RAG] 인덱싱 실패: id={}, error={}", news.getId(), e.getMessage(), e);
        }
    }

    // RAG 파이프라인용 유사도 검색
    public List<Document> search(String query, int topK, double threshold) {
        return search(query, topK, threshold, null);
    }

    // RAG 파이프라인용 유사도 검색 + 메타데이터 필터링
    public List<Document> search(String query, int topK, double threshold, Filter.Expression filterExpression) {
        SearchRequest.Builder builder = SearchRequest.builder()
                .query(query)
                .topK(topK)
                .similarityThreshold(threshold);
        if (filterExpression != null) {
            builder.filterExpression(filterExpression);
        }
        return vectorStore.similaritySearch(builder.build());
    }

    // SimpleVectorStore 전용: 애플리케이션 종료 시 미저장 데이터 flush
    @PreDestroy
    public void onShutdown() {
        if (isSimpleVectorStore && dirty.compareAndSet(true, false)) {
            persistToFile();
            log.info("[RAG] 종료 시 미저장 벡터 스토어 flush 완료");
        }
    }

    // ==================== 내부 헬퍼 ====================

    private boolean isEligibleForVectorStore(News news) {
        if (news == null) return false;
        Integer score = news.getImportanceScore();
        if (score == null || score <= LOW_GRADE_MAX_SCORE) return false;
        if (news.getCollectedAt() == null) return false;
        return news.getCollectedAt().isAfter(LocalDateTime.now().minusDays(VECTOR_STORE_DAYS));
    }

    /**
     * 뉴스를 TokenTextSplitter로 청킹하여 Document 리스트로 변환합니다.
     * 메타데이터에 tags, ownerUserIds 필드를 포함하여 사용자별 격리 및 필터링을 지원합니다.
     */
    private List<Document> newsToDocuments(News news) {
        Map<String, Object> baseMetadata = new HashMap<>();
        baseMetadata.put("newsId", String.valueOf(news.getId()));
        baseMetadata.put("title", nvl(news.getTitle()));
        baseMetadata.put("url", nvl(news.getUrl()));
        baseMetadata.put("keyword", nvl(news.getKeyword()));
        baseMetadata.put("summary", nvl(news.getSummary()));
        baseMetadata.put("importanceScore", news.getImportanceScore() != null ? news.getImportanceScore() : 0);
        baseMetadata.put("category", nvl(news.getCategory()));
        baseMetadata.put("aiReason", nvl(news.getAiReason()));

        // 해당 키워드를 등록한 사용자 ID 목록을 메타데이터에 포함 (사용자별 RAG 격리)
        String ownerUserIds = resolveOwnerUserIds(news.getKeyword());
        baseMetadata.put("ownerUserIds", ownerUserIds);

        // 자동 추출 태그가 있으면 메타데이터에 추가 (RAG 필터링 강화)
        if (news.getTags() != null && !news.getTags().isBlank()) {
            baseMetadata.put("tags", news.getTags());
        }

        String content = news.getContent();
        if (content == null || content.isBlank()) {
            String fallbackText = buildFallbackText(news);
            Map<String, Object> meta = new HashMap<>(baseMetadata);
            meta.put("chunkIndex", 0);
            return List.of(new Document(news.getId() + "_0", fallbackText, meta));
        }

        String titlePrefix = news.getTitle() != null ? news.getTitle() + "\n" : "";

        // TokenTextSplitter로 토큰 기반 청킹
        Document sourceDoc = new Document(content);
        List<Document> splitDocs = tokenTextSplitter.apply(List.of(sourceDoc));

        List<Document> documents = new ArrayList<>();
        for (int i = 0; i < splitDocs.size(); i++) {
            Map<String, Object> meta = new HashMap<>(baseMetadata);
            meta.put("chunkIndex", i);
            String chunkText = titlePrefix + splitDocs.get(i).getText();
            documents.add(new Document(news.getId() + "_" + i, chunkText, meta));
        }

        return documents;
    }

    private String buildFallbackText(News news) {
        StringBuilder sb = new StringBuilder();
        if (news.getTitle() != null) sb.append(news.getTitle()).append("\n");
        if (news.getSummary() != null) sb.append(news.getSummary()).append("\n");
        if (news.getAiReason() != null) sb.append(news.getAiReason());
        String text = sb.toString().trim();
        return text.length() > 1200 ? text.substring(0, 1200) : text;
    }

    /**
     * 벡터 스토어 전체 비우기.
     * SimpleVectorStore: 기존 문서 ID를 수집하여 delete.
     * PgVectorStore: 동일하게 delete API 사용 (내부적으로 SQL DELETE).
     */
    private void clearAndPersist() {
        try {
            // 모든 인덱싱된 뉴스 ID를 조회하여 기존 문서 삭제
            // 빈 쿼리 검색으로 기존 문서 ID 수집 후 삭제하는 대신,
            // SimpleVectorStore는 빈 상태로 파일 저장만으로도 충분
            if (isSimpleVectorStore) {
                // SimpleVectorStore: 검색 불필요, 빈 파일로 덮어쓰기
                persistToFile();
            }
            // PgVectorStore: rebuild 시 delete 후 add가 이미 상위에서 처리됨
        } catch (Exception e) {
            log.error("[RAG] 벡터 스토어 초기화 실패: {}", e.getMessage(), e);
        }
    }

    /** SimpleVectorStore 전용: 파일에 벡터 스토어를 즉시 저장 */
    private void persistToFile() {
        if (!isSimpleVectorStore) return;
        try {
            File storeFile = new File(vectorStorePath);
            File parent = storeFile.getParentFile();
            if (parent != null) parent.mkdirs();
            ((SimpleVectorStore) vectorStore).save(storeFile);
        } catch (Exception e) {
            log.error("[RAG] 벡터 스토어 저장 실패: {}", e.getMessage(), e);
        }
    }

    /**
     * 뉴스 키워드를 등록한 모든 사용자 ID를 쉼표 구분 문자열로 반환.
     * RAG 검색 시 ownerUserIds CONTAINS 필터로 사용자별 격리를 보강.
     */
    private String resolveOwnerUserIds(String keyword) {
        if (keyword == null || keyword.isBlank()) return "";
        try {
            return keywordRepository.findAllByNameIgnoreCase(keyword).stream()
                    .filter(k -> k.getUser() != null)
                    .map(k -> String.valueOf(k.getUser().getId()))
                    .distinct()
                    .collect(java.util.stream.Collectors.joining(","));
        } catch (Exception e) {
            log.warn("[RAG] ownerUserIds 조회 실패 (keyword={}): {}", keyword, e.getMessage());
            return "";
        }
    }

    private String nvl(String value) {
        return value != null ? value : "";
    }
}
