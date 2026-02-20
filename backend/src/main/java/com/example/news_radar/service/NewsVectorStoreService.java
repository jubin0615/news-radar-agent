package com.example.news_radar.service;

import com.example.news_radar.entity.News;
import com.example.news_radar.repository.NewsRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 뉴스 기사를 벡터 임베딩으로 관리하는 서비스
 *
 * - @PostConstruct: 앱 기동 시 vector-store.json 로드 (없으면 H2 전체 임베딩 후 생성)
 * - addOrUpdate(): 뉴스 저장 직후 호출 → 실시간 인덱싱
 * - search(): RAG 파이프라인에서 유사 뉴스 검색
 */
@Slf4j
@Service
public class NewsVectorStoreService {

    private final EmbeddingModel  embeddingModel;
    private final NewsRepository  newsRepository;
    private final SimpleVectorStore vectorStore;
    private final String          vectorStorePath;

    public NewsVectorStoreService(
            EmbeddingModel embeddingModel,
            NewsRepository newsRepository,
            @Value("${app.rag.vector-store-path:./data/vector-store.json}") String vectorStorePath
    ) {
        this.embeddingModel  = embeddingModel;
        this.newsRepository  = newsRepository;
        this.vectorStorePath = vectorStorePath;
        this.vectorStore     = SimpleVectorStore.builder(embeddingModel).build();
    }

    // ── 앱 기동 시 벡터 스토어 초기화 ─────────────────────────────────────────

    @PostConstruct
    public void initVectorStore() {
        File storeFile = new File(vectorStorePath);
        if (storeFile.exists()) {
            log.info("[RAG] 기존 벡터 스토어 로드: {}", vectorStorePath);
            try {
                vectorStore.load(storeFile);
                log.info("[RAG] 벡터 스토어 로드 완료");
            } catch (Exception e) {
                log.warn("[RAG] 벡터 스토어 로드 실패 (재생성 시도): {}", e.getMessage());
                rebuildFromDatabase();
            }
        } else {
            log.info("[RAG] 저장된 벡터 스토어가 없습니다. H2 데이터로 초기 임베딩을 생성합니다...");
            rebuildFromDatabase();
        }
    }

    /** H2 전체 뉴스를 임베딩해서 벡터 스토어 재구성 */
    private void rebuildFromDatabase() {
        List<News> allNews = newsRepository.findAll();
        if (allNews.isEmpty()) {
            log.info("[RAG] DB에 뉴스가 없습니다. 수집 후 자동 인덱싱됩니다.");
            return;
        }
        List<Document> docs = allNews.stream()
                .map(this::newsToDocument)
                .toList();
        vectorStore.add(docs);
        persist();
        log.info("[RAG] 초기 임베딩 완료. articles={}", docs.size());
    }

    // ── 신규 기사 인덱싱 (NewsService.save() 직후 호출) ──────────────────────

    /**
     * 뉴스 기사를 벡터 스토어에 추가하고 파일에 영속화합니다.
     * @param news id가 할당된 저장 완료 엔티티
     */
    public void addOrUpdate(News news) {
        try {
            Document doc = newsToDocument(news);
            vectorStore.add(List.of(doc));
            persist();
            log.debug("[RAG] 임베딩 완료: id={}, title={}", news.getId(), news.getTitle());
        } catch (Exception e) {
            log.error("[RAG] 임베딩 실패: id={}, error={}", news.getId(), e.getMessage(), e);
        }
    }

    // ── 유사 뉴스 검색 ─────────────────────────────────────────────────────────

    /**
     * 자연어 쿼리와 가장 유사한 뉴스 Document 목록 반환
     *
     * @param query     사용자 질문
     * @param topK      최대 반환 건수 (권장: 5)
     * @param threshold 최소 코사인 유사도 (권장: 0.5)
     */
    public List<Document> search(String query, int topK, double threshold) {
        SearchRequest request = SearchRequest.builder()
                .query(query)
                .topK(topK)
                .similarityThreshold(threshold)
                .build();
        return vectorStore.similaritySearch(request);
    }

    // ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

    /** News 엔티티 → Spring AI Document 변환 */
    private Document newsToDocument(News news) {
        String text = buildEmbeddingText(news);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("newsId",          String.valueOf(news.getId()));
        metadata.put("title",           nvl(news.getTitle()));
        metadata.put("url",             nvl(news.getUrl()));
        metadata.put("keyword",         nvl(news.getKeyword()));
        metadata.put("summary",         nvl(news.getSummary()));
        metadata.put("importanceScore", news.getImportanceScore() != null ? news.getImportanceScore() : 0);
        metadata.put("category",        nvl(news.getCategory()));
        metadata.put("aiReason",        nvl(news.getAiReason()));

        // DB id를 Document id로 사용 (중복 방지)
        return new Document(String.valueOf(news.getId()), text, metadata);
    }

    /**
     * 임베딩할 텍스트 생성 (제목 + 요약 + AI 분석)
     * text-embedding-3-small 토큰 한도(8191)에 충분히 여유 있는 1200자로 제한
     */
    private String buildEmbeddingText(News news) {
        StringBuilder sb = new StringBuilder();
        if (news.getTitle()    != null) sb.append(news.getTitle()).append("\n");
        if (news.getSummary()  != null) sb.append(news.getSummary()).append("\n");
        if (news.getAiReason() != null) sb.append(news.getAiReason());
        String text = sb.toString().trim();
        return text.length() > 1200 ? text.substring(0, 1200) : text;
    }

    /** 벡터 스토어를 JSON 파일에 저장 */
    private void persist() {
        try {
            File storeFile = new File(vectorStorePath);
            storeFile.getParentFile().mkdirs();
            vectorStore.save(storeFile);
        } catch (Exception e) {
            log.error("[RAG] 벡터 스토어 저장 실패: {}", e.getMessage(), e);
        }
    }

    private String nvl(String value) {
        return value != null ? value : "";
    }
}
