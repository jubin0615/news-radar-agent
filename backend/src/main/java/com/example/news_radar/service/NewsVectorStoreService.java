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
 * Vector store service for RAG.
 *
 * Policy:
 * - Keep every article in DB.
 * - Exclude LOW-importance articles from vector indexing.
 */
@Slf4j
@Service
public class NewsVectorStoreService {

    private static final int LOW_GRADE_MAX_SCORE = 39;

    private final EmbeddingModel embeddingModel;
    private final NewsRepository newsRepository;
    private final String vectorStorePath;

    private SimpleVectorStore vectorStore;

    public NewsVectorStoreService(
            EmbeddingModel embeddingModel,
            NewsRepository newsRepository,
            @Value("${app.rag.vector-store-path:./data/vector-store.json}") String vectorStorePath
    ) {
        this.embeddingModel = embeddingModel;
        this.newsRepository = newsRepository;
        this.vectorStorePath = vectorStorePath;
        this.vectorStore = SimpleVectorStore.builder(embeddingModel).build();
    }

    /**
     * Rebuild from DB at startup to enforce current indexing policy.
     */
    @PostConstruct
    public void initVectorStore() {
        log.info("[RAG] Rebuilding vector store from DB (excluding LOW importance news).");
        rebuildFromDatabase();
    }

    /**
     * Re-index DB articles into a fresh vector store.
     */
    private void rebuildFromDatabase() {
        vectorStore = SimpleVectorStore.builder(embeddingModel).build();

        List<Document> docs = newsRepository.findAll().stream()
                .filter(this::isIncludedInVectorStore)
                .map(this::newsToDocument)
                .toList();

        if (docs.isEmpty()) {
            persist();
            log.info("[RAG] No indexable news found after LOW filter.");
            return;
        }

        vectorStore.add(docs);
        persist();
        log.info("[RAG] Vector store rebuild completed. indexed={}", docs.size());
    }

    /**
     * Add/update one article in vector store after DB save.
     *
     * @param news persisted news entity
     */
    public void addOrUpdate(News news) {
        if (!isIncludedInVectorStore(news)) {
            log.debug("[RAG] Skip LOW importance news. id={}, score={}", news.getId(), news.getImportanceScore());
            return;
        }

        try {
            Document doc = newsToDocument(news);
            vectorStore.add(List.of(doc));
            persist();
            log.debug("[RAG] Indexed. id={}, title={}", news.getId(), news.getTitle());
        } catch (Exception e) {
            log.error("[RAG] Indexing failed. id={}, error={}", news.getId(), e.getMessage(), e);
        }
    }

    /**
     * Similarity search for RAG pipeline.
     */
    public List<Document> search(String query, int topK, double threshold) {
        SearchRequest request = SearchRequest.builder()
                .query(query)
                .topK(topK)
                .similarityThreshold(threshold)
                .build();
        return vectorStore.similaritySearch(request);
    }

    private Document newsToDocument(News news) {
        String text = buildEmbeddingText(news);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("newsId", String.valueOf(news.getId()));
        metadata.put("title", nvl(news.getTitle()));
        metadata.put("url", nvl(news.getUrl()));
        metadata.put("keyword", nvl(news.getKeyword()));
        metadata.put("summary", nvl(news.getSummary()));
        metadata.put("importanceScore", news.getImportanceScore() != null ? news.getImportanceScore() : 0);
        metadata.put("category", nvl(news.getCategory()));
        metadata.put("aiReason", nvl(news.getAiReason()));

        return new Document(String.valueOf(news.getId()), text, metadata);
    }

    private String buildEmbeddingText(News news) {
        StringBuilder sb = new StringBuilder();
        if (news.getTitle() != null) sb.append(news.getTitle()).append("\n");
        if (news.getSummary() != null) sb.append(news.getSummary()).append("\n");
        if (news.getAiReason() != null) sb.append(news.getAiReason());
        String text = sb.toString().trim();
        return text.length() > 1200 ? text.substring(0, 1200) : text;
    }

    private void persist() {
        try {
            File storeFile = new File(vectorStorePath);
            File parent = storeFile.getParentFile();
            if (parent != null) {
                parent.mkdirs();
            }
            vectorStore.save(storeFile);
        } catch (Exception e) {
            log.error("[RAG] Failed to persist vector store: {}", e.getMessage(), e);
        }
    }

    private String nvl(String value) {
        return value != null ? value : "";
    }

    private boolean isIncludedInVectorStore(News news) {
        if (news == null) {
            return false;
        }
        Integer score = news.getImportanceScore();
        return score != null && score > LOW_GRADE_MAX_SCORE;
    }
}
