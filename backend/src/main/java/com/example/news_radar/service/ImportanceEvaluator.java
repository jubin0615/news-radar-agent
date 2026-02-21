package com.example.news_radar.service;

import com.example.news_radar.dto.AiEvaluation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 뉴스 중요도 점수 산정기 (총 100점 만점)
 *
 * 1. LLM 평가 점수      (최대 50점): 파급력(20) + 혁신성(15) + 시의성(15)
 * 2. 구조적 연관도 점수  (최대 30점): 제목 키워드(10) + 리드 키워드(5) + 임베딩 유사도(15)
 * 3. 메타데이터 신뢰도  (최대 20점): 출처 도메인 Tier별 차등 부여
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ImportanceEvaluator {

    private final EmbeddingModel embeddingModel;

    // =====================================================================
    // 1. LLM 평가 점수 (최대 50점)
    // =====================================================================

    /**
     * AI가 평가한 3가지 기준(파급력/혁신성/시의성) 합산 → 최대 50점
     */
    public int calculateLlmScore(AiEvaluation eval) {
        int impact     = clamp(eval.impact(),     0, 20);
        int innovation = clamp(eval.innovation(), 0, 15);
        int timeliness = clamp(eval.timeliness(), 0, 15);
        return impact + innovation + timeliness;
    }

    // =====================================================================
    // 2. 구조적/문맥적 연관도 점수 (최대 30점)
    // =====================================================================

    /**
     * 제목·리드 키워드 매칭 + 임베딩 유사도를 합산해 점수 산출 (최대 30점)
     * - 제목 키워드 매칭 : 최대 10점
     * - 리드 키워드 매칭 : 최대  5점
     * - 임베딩 유사도   : 최대 15점
     */
    public int calculateStructuralScore(String title, String content, List<String> keywords) {
        int titleScore     = evaluateTitleKeywordMatch(title, keywords);
        int leadScore      = evaluateLeadKeywordMatch(extractLead(content), keywords);
        int embeddingScore = evaluateEmbeddingSimilarity(content, keywords);
        return Math.min(titleScore + leadScore + embeddingScore, 30);
    }

    /**
     * 제목에 핵심 키워드 포함 여부 (최대 10점)
     * - 키워드 2개 이상 포함: 10점
     * - 키워드 1개 포함   :  5점
     * - 미포함             :  0점
     */
    private int evaluateTitleKeywordMatch(String title, List<String> keywords) {
        if (title == null || keywords == null || keywords.isEmpty()) return 0;
        long matchCount = keywords.stream()
                .filter(kw -> title.toLowerCase().contains(kw.toLowerCase()))
                .count();
        if (matchCount >= 2) return 10;
        if (matchCount == 1) return 5;
        return 0;
    }

    /**
     * 본문 첫 문단(Lead)에 핵심 키워드 포함 여부 (최대 5점)
     * - 키워드 2개 이상 포함: 5점
     * - 키워드 1개 포함   : 3점
     * - 미포함             : 0점
     */
    private int evaluateLeadKeywordMatch(String lead, List<String> keywords) {
        if (lead == null || keywords == null || keywords.isEmpty()) return 0;
        long matchCount = keywords.stream()
                .filter(kw -> lead.toLowerCase().contains(kw.toLowerCase()))
                .count();
        if (matchCount >= 2) return 5;
        if (matchCount == 1) return 3;
        return 0;
    }

    /**
     * 본문 첫 문단(Lead) 추출 — 의미 있는 최초 단락(최대 300자) 반환
     */
    private String extractLead(String content) {
        if (content == null || content.isBlank()) return "";
        for (String paragraph : content.split("\\n\\n|\\n")) {
            String trimmed = paragraph.trim();
            if (trimmed.length() > 30) {
                return trimmed.substring(0, Math.min(trimmed.length(), 300));
            }
        }
        return content.substring(0, Math.min(content.length(), 300));
    }

    /**
     * 임베딩 유사도 기반 연관도 산정 (최대 15점)
     *
     * <p>본문과 키워드를 각각 벡터로 변환한 뒤 코사인 유사도를 계산한다.
     * 유사도(-1.0 ~ 1.0)의 음수는 0으로 보정하고, 0 ~ 15점 정수로 환산해 반환한다.
     * 토큰 비용 절감을 위해 본문은 최대 1000자까지만 사용한다.
     */
    private int evaluateEmbeddingSimilarity(String content, List<String> keywords) {
        if (content == null || content.isBlank() || keywords == null || keywords.isEmpty()) return 0;

        // 토큰 제한 및 비용 절감: 본문 최대 1000자
        String trimmedContent = content.length() > 1000 ? content.substring(0, 1000) : content;

        // 키워드 리스트를 하나의 문자열로 결합
        String keywordText = String.join(" ", keywords);

        try {
            float[] contentVector = embeddingModel.embed(trimmedContent);
            float[] keywordVector = embeddingModel.embed(keywordText);

            double similarity = calculateCosineSimilarity(contentVector, keywordVector);

            // 음수 보정 후 0~15점으로 환산
            double normalized = Math.max(0.0, similarity);
            return (int) Math.round(normalized * 15);
        } catch (Exception e) {
            log.warn("임베딩 유사도 계산 실패 (0점 처리): {}", e.getMessage());
            return 0;
        }
    }

    /**
     * 두 벡터 간의 코사인 유사도 계산
     * similarity = (A · B) / (|A| × |B|)
     *
     * @return -1.0 ~ 1.0 범위의 유사도. 영벡터인 경우 0.0 반환
     */
    private double calculateCosineSimilarity(float[] vectorA, float[] vectorB) {
        double dotProduct = 0.0;
        double normA      = 0.0;
        double normB      = 0.0;

        for (int i = 0; i < vectorA.length; i++) {
            dotProduct += (double) vectorA[i] * vectorB[i];
            normA      += (double) vectorA[i] * vectorA[i];
            normB      += (double) vectorB[i] * vectorB[i];
        }

        if (normA == 0.0 || normB == 0.0) return 0.0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    // =====================================================================
    // 3. 메타데이터 신뢰도 점수 (최대 20점)
    // =====================================================================

    /**
     * 출처 URL의 도메인을 분석해 Tier별 점수 반환
     * - MAJOR(20): 공식 홈페이지 / 메이저 언론사
     * - STANDARD(15): IT 전문 미디어
     * - GENERAL(10): 일반 블로그 / 기타
     */
    public int calculateMetadataScore(String sourceUrl) {
        return detectSourceTier(sourceUrl).score;
    }

    private SourceTier detectSourceTier(String url) {
        if (url == null || url.isBlank()) return SourceTier.GENERAL;
        String domain = extractDomain(url).toLowerCase();
        if (MAJOR_DOMAINS.stream().anyMatch(domain::contains))    return SourceTier.MAJOR;
        if (STANDARD_DOMAINS.stream().anyMatch(domain::contains)) return SourceTier.STANDARD;
        return SourceTier.GENERAL;
    }

    private String extractDomain(String url) {
        String noScheme = url.replaceFirst("^https?://", "");
        int slashIdx = noScheme.indexOf('/');
        return slashIdx > 0 ? noScheme.substring(0, slashIdx) : noScheme;
    }

    // =====================================================================
    // 최종 점수 합산 및 등급 변환
    // =====================================================================

    /**
     * LLM(50) + 구조적 연관도(30) + 메타데이터 신뢰도(20) = 최대 100점
     */
    public int calculateFinalScore(int llmScore, int structuralScore, int metadataScore) {
        return Math.min(llmScore + structuralScore + metadataScore, 100);
    }

    public static String getGrade(int score) {
        if (score >= 80) return "CRITICAL";
        if (score >= 60) return "HIGH";
        if (score >= 40) return "MEDIUM";
        return "LOW";
    }

    // =====================================================================
    // Source Tier 정의
    // =====================================================================

    private enum SourceTier {
        MAJOR(20),    // 공식 홈페이지 / 메이저 언론사
        STANDARD(15), // IT 전문 미디어
        GENERAL(10);  // 일반 블로그 / 기타

        final int score;
        SourceTier(int score) { this.score = score; }
    }

    /** 메이저 언론사 / 공식 기관 도메인 (20점) */
    private static final List<String> MAJOR_DOMAINS = List.of(
            // 국제 주요 언론
            "reuters.com", "bloomberg.com", "nytimes.com", "wsj.com",
            "ft.com", "bbc.com", "apnews.com",
            // 글로벌 IT 메이저
            "techcrunch.com", "wired.com", "theverge.com", "arstechnica.com",
            "venturebeat.com",
            // 국내 주요 언론
            "yna.co.kr", "chosun.com", "joongang.co.kr", "joins.com",
            "donga.com", "mk.co.kr", "hankyung.com", "kbs.co.kr", "sbs.co.kr",
            "ytn.co.kr", "sedaily.com", "edaily.co.kr"
    );

    /** IT 전문 미디어 도메인 (15점) */
    private static final List<String> STANDARD_DOMAINS = List.of(
            // 국제 IT 전문
            "zdnet.com", "infoq.com", "thenewstack.io", "devops.com",
            "techradar.com", "towardsdatascience.com",
            // 국내 IT 전문
            "zdnet.co.kr", "itworld.co.kr", "ciokorea.com", "boannews.com",
            "etnews.com", "ddaily.co.kr", "aitimes.com", "digitaltoday.co.kr"
    );

    // =====================================================================
    // 유틸
    // =====================================================================

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
