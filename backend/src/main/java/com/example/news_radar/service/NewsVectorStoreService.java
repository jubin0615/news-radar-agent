package com.example.news_radar.service;

import com.example.news_radar.entity.KeywordStatus;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.KeywordRepository;
import com.example.news_radar.repository.NewsRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * RAG를 위한 벡터 스토어 서비스.
 *
 * 역할 분리 정책:
 *   - RDB(H2): 수집된 모든 뉴스를 영구 보관 (기록·감사용)
 *   - Vector DB(SimpleVectorStore): 아래 3가지 조건을 모두 만족하는 뉴스만 인덱싱
 *       1. 현재 ACTIVE 상태인 키워드에 속한 뉴스
 *       2. 최근 7일 이내 수집된 뉴스 (시의성 확보)
 *       3. 중요도 점수 40점 초과 (LOW 등급 제외)
 *
 * 청킹 전략:
 *   - TokenTextSplitter 사용 (토큰 기반, 의미 단위 경계 보존)
 *
 * I/O 최적화:
 *   - 단건 addOrUpdate 시 메모리에만 적재 (dirty flag)
 *   - 30초 주기 스케줄러가 dirty 상태일 때만 파일 저장 (배치 persist)
 *   - 재빌드 시에는 즉시 저장
 *
 * 클렌징 스케줄:
 *   - 서버 기동 시(@PostConstruct): 최초 재빌드
 *   - 매일 새벽 3시(@Scheduled): 자동 재빌드 (오래된 기사 자동 제거)
 *   - 키워드 상태 변경·삭제 시(KeywordService 호출): 즉시 재빌드
 */
@Slf4j
@Service
public class NewsVectorStoreService {

    private static final int LOW_GRADE_MAX_SCORE = 39;
    private static final int VECTOR_STORE_DAYS = 7;

    private final EmbeddingModel embeddingModel;
    private final NewsRepository newsRepository;
    private final KeywordRepository keywordRepository;
    private final String vectorStorePath;
    private final TokenTextSplitter tokenTextSplitter;

    /** 메모리 변경 후 아직 파일에 저장되지 않았음을 표시 */
    private final AtomicBoolean dirty = new AtomicBoolean(false);

    private SimpleVectorStore vectorStore;

    public NewsVectorStoreService(
            EmbeddingModel embeddingModel,
            NewsRepository newsRepository,
            KeywordRepository keywordRepository,
            @Value("${app.rag.vector-store-path:./data/vector-store.json}") String vectorStorePath
    ) {
        this.embeddingModel = embeddingModel;
        this.newsRepository = newsRepository;
        this.keywordRepository = keywordRepository;
        this.vectorStorePath = vectorStorePath;
        this.vectorStore = SimpleVectorStore.builder(embeddingModel).build();

        // TokenTextSplitter: 800 토큰 청크, 최소 350자, 5자 미만 청크 폐기
        this.tokenTextSplitter = new TokenTextSplitter(800, 350, 5, 10000, true);
    }

    // 서버 기동 시 최초 재빌드
    @PostConstruct
    public void initVectorStore() {
        log.info("[RAG] 서버 기동: 벡터 스토어 초기화 시작 (활성 키워드 + 최근 {}일 기준)", VECTOR_STORE_DAYS);
        rebuildForActiveKeywords();
    }

    // 매일 새벽 3시 자동 클렌징 (오래된 기사 제거 + 최신 유지)
    @Scheduled(cron = "0 0 3 * * *")
    public void scheduledRebuild() {
        log.info("[RAG] 일별 벡터 스토어 클렌징 시작");
        rebuildForActiveKeywords();
    }

    /**
     * 30초 주기로 dirty 상태인 벡터 스토어를 파일에 저장합니다.
     * 단건 addOrUpdate가 빈번할 때 파일 I/O를 배치로 묶어 성능을 최적화합니다.
     */
    @Scheduled(fixedDelay = 30_000)
    public void flushIfDirty() {
        if (dirty.compareAndSet(true, false)) {
            persistToFile();
            log.debug("[RAG] 배치 저장 완료 (dirty flush)");
        }
    }

    /**
     * 벡터 스토어 재빌드.
     * ACTIVE 키워드 + 최근 7일 + 중요도 40점 초과 뉴스만 인덱싱합니다.
     * 키워드 상태 변경·삭제·스케줄러에 의해 호출됩니다.
     */
    public synchronized void rebuildForActiveKeywords() {
        List<String> activeKeywordNames = keywordRepository.findByStatus(KeywordStatus.ACTIVE)
                .stream()
                .map(k -> k.getName())
                .toList();

        if (activeKeywordNames.isEmpty()) {
            vectorStore = SimpleVectorStore.builder(embeddingModel).build();
            persistToFile();
            log.info("[RAG] 활성 키워드 없음 — 벡터 스토어를 비웠습니다.");
            return;
        }

        LocalDateTime since = LocalDateTime.now().minusDays(VECTOR_STORE_DAYS);
        List<News> candidates = newsRepository.findForVectorStore(
                activeKeywordNames, LOW_GRADE_MAX_SCORE, since);

        vectorStore = SimpleVectorStore.builder(embeddingModel).build();

        if (candidates.isEmpty()) {
            persistToFile();
            log.info("[RAG] 재빌드 완료 — 인덱싱할 기사 없음 (활성 키워드: {}개, 기간: 최근 {}일)",
                    activeKeywordNames.size(), VECTOR_STORE_DAYS);
            return;
        }

        List<Document> docs = candidates.stream()
                .flatMap(news -> newsToDocuments(news).stream())
                .toList();
        vectorStore.add(docs);
        persistToFile(); // 재빌드는 즉시 저장
        log.info("[RAG] 재빌드 완료 — articles={}, chunks={}, activeKeywords={}, since={}",
                candidates.size(), docs.size(), activeKeywordNames.size(), since.toLocalDate());
    }

    /**
     * 뉴스 저장 직후 벡터 스토어에 추가 (실시간 인덱싱).
     * 메모리에만 적재하고, 파일 저장은 30초 주기 스케줄러에 위임합니다.
     * 조건 불만족 시(비활성 키워드, 오래된 기사, 낮은 점수) 스킵합니다.
     */
    public void addOrUpdate(News news) {
        if (!isEligibleForVectorStore(news)) {
            log.debug("[RAG] 인덱싱 제외: id={}, score={}", news.getId(), news.getImportanceScore());
            return;
        }
        try {
            List<Document> chunks = newsToDocuments(news);
            vectorStore.add(chunks);
            dirty.set(true); // 파일 저장은 flushIfDirty 스케줄러에 위임
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

    // 애플리케이션 종료 시 미저장 데이터 flush
    @PreDestroy
    public void onShutdown() {
        if (dirty.compareAndSet(true, false)) {
            persistToFile();
            log.info("[RAG] 종료 시 미저장 벡터 스토어 flush 완료");
        }
    }

    // ==================== 내부 헬퍼 ====================

    /**
     * 실시간 addOrUpdate 시 인덱싱 여부 판단.
     * (중요도 + 수집 시각 기준, 키워드 상태는 크롤러가 이미 보장)
     */
    private boolean isEligibleForVectorStore(News news) {
        if (news == null) return false;
        Integer score = news.getImportanceScore();
        if (score == null || score <= LOW_GRADE_MAX_SCORE) return false;
        if (news.getCollectedAt() == null) return false;
        return news.getCollectedAt().isAfter(LocalDateTime.now().minusDays(VECTOR_STORE_DAYS));
    }

    /**
     * 뉴스를 TokenTextSplitter로 청킹하여 Document 리스트로 변환합니다.
     * - content(본문)가 있으면: TokenTextSplitter로 토큰 기반 분할 (의미 단위 경계 보존)
     * - content가 없으면: 제목+요약+AI분석을 단일 Document로 생성
     * 각 청크 metadata에 newsId, title, url, chunkIndex 등을 포함합니다.
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

        String content = news.getContent();
        if (content == null || content.isBlank()) {
            // 본문이 없으면 기존 방식(제목+요약+AI분석)으로 단일 Document 생성
            String fallbackText = buildFallbackText(news);
            Map<String, Object> meta = new HashMap<>(baseMetadata);
            meta.put("chunkIndex", 0);
            return List.of(new Document(news.getId() + "_0", fallbackText, meta));
        }

        // 제목 prefix (각 청크 앞에 제목을 붙여 문맥 보존)
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

    /** 본문이 없을 때 제목+요약+AI분석으로 대체 텍스트 생성 */
    private String buildFallbackText(News news) {
        StringBuilder sb = new StringBuilder();
        if (news.getTitle() != null) sb.append(news.getTitle()).append("\n");
        if (news.getSummary() != null) sb.append(news.getSummary()).append("\n");
        if (news.getAiReason() != null) sb.append(news.getAiReason());
        String text = sb.toString().trim();
        return text.length() > 1200 ? text.substring(0, 1200) : text;
    }

    /** 파일에 벡터 스토어를 즉시 저장 */
    private void persistToFile() {
        try {
            File storeFile = new File(vectorStorePath);
            File parent = storeFile.getParentFile();
            if (parent != null) parent.mkdirs();
            vectorStore.save(storeFile);
        } catch (Exception e) {
            log.error("[RAG] 벡터 스토어 저장 실패: {}", e.getMessage(), e);
        }
    }

    private String nvl(String value) {
        return value != null ? value : "";
    }
}
