package com.example.news_radar.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.io.File;

/**
 * 벡터 스토어 설정.
 *
 * 아키텍처 결정:
 *   프로필 기반 빈 분리 전략을 사용하여 동일한 VectorStore 인터페이스 뒤에
 *   개발용(SimpleVectorStore)과 운영용(PgVectorStore)을 교체 가능하게 함.
 *   PgVectorStore는 spring-ai-starter-vector-store-pgvector의 AutoConfiguration이
 *   DataSource + EmbeddingModel만 있으면 자동으로 빈을 생성하므로,
 *   여기서는 SimpleVectorStore만 명시적으로 등록하고 pgvector 프로필에서는 제외.
 *
 * 프로필 전환:
 *   - 기본(dev): SimpleVectorStore (파일 기반, H2와 조합)
 *   - pgvector:  PgVectorStore (PostgreSQL + pgvector 확장, AutoConfig 활용)
 */
@Slf4j
@Configuration
public class VectorStoreConfig {

    /**
     * 개발/기본 프로필: SimpleVectorStore (메모리+파일 영속화)
     *
     * pgvector 프로필이 아닐 때만 활성화.
     * 기존 파일이 있으면 로드하여 서버 재시작 후에도 데이터 유지.
     */
    @Bean
    @Profile("!pgvector")
    public VectorStore simpleVectorStore(
            EmbeddingModel embeddingModel,
            @Value("${app.rag.vector-store-path:./data/vector-store.json}") String vectorStorePath
    ) {
        SimpleVectorStore store = SimpleVectorStore.builder(embeddingModel).build();

        File storeFile = new File(vectorStorePath);
        if (storeFile.exists()) {
            store.load(storeFile);
            log.info("[VectorStore] SimpleVectorStore 파일 로드 완료: {}", vectorStorePath);
        } else {
            log.info("[VectorStore] SimpleVectorStore 신규 생성 (파일 없음)");
        }

        return store;
    }

    /*
     * 운영 프로필(pgvector): PgVectorStore 빈은 별도 등록 불필요.
     *
     * spring-ai-starter-vector-store-pgvector가 AutoConfiguration으로
     * DataSource + EmbeddingModel 빈을 감지하여 PgVectorStore를 자동 생성함.
     *
     * 필요한 설정 (application-pgvector.properties):
     *   spring.datasource.url=jdbc:postgresql://localhost:5432/newsradar
     *   spring.datasource.username=newsradar
     *   spring.datasource.password=${DB_PASSWORD}
     *   spring.ai.vectorstore.pgvector.index-type=HNSW
     *   spring.ai.vectorstore.pgvector.distance-type=COSINE_DISTANCE
     *   spring.ai.vectorstore.pgvector.dimensions=1536
     *   spring.ai.vectorstore.pgvector.initialize-schema=true
     */
}
