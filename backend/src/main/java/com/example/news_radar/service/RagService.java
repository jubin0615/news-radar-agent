package com.example.news_radar.service;

import com.example.news_radar.dto.RagResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * RAG (Retrieval-Augmented Generation) 파이프라인 서비스
 *
 * 흐름: 질문 임베딩 → 유사 뉴스 검색 → 컨텍스트 주입 → GPT-4o-mini 생성 → 답변 반환
 */
@Slf4j
@Service
public class RagService {

    private static final int    TOP_K                    = 5;
    private static final double THRESHOLD                = 0.30;
    private static final int    MIN_IMPORTANCE_SCORE     = 60;

    private final NewsVectorStoreService vectorStoreService;
    private final ChatClient             chatClient;

    public RagService(
            NewsVectorStoreService vectorStoreService,
            ChatClient.Builder chatClientBuilder
    ) {
        this.vectorStoreService = vectorStoreService;
        this.chatClient         = chatClientBuilder.build();
    }

    /**
     * 사용자 질문에 대해 RAG 파이프라인으로 답변을 생성합니다.
     *
     * @param question 사용자의 자연어 질문 (한국어)
     * @return 생성된 답변 + 참고 기사 목록
     */
    public RagResponse ask(String question) {
        // 1. 벡터 검색으로 관련 뉴스 검색 (importanceScore >= 60 필터 적용)
        Filter.Expression filter = new FilterExpressionBuilder()
                .gte("importanceScore", MIN_IMPORTANCE_SCORE)
                .build();
        List<Document> retrieved = vectorStoreService.search(question, TOP_K, THRESHOLD, filter);
        log.info("[RAG] 질문='{}' 검색결과={}건", question, retrieved.size());

        if (retrieved.isEmpty()) {
            return new RagResponse(
                "현재 질문과 관련된 뉴스 기사를 찾지 못했습니다.\n" +
                "뉴스를 먼저 수집하거나, 다른 키워드로 질문해 보세요.",
                List.of()
            );
        }

        // 2. 검색된 기사를 번호가 붙은 컨텍스트 블록으로 변환
        String context = buildContext(retrieved);

        // 3. RAG 프롬프트 구성 (Explicit Citation + Hallucination 방지 강화)
        String prompt = """
                너는 IT 기술 뉴스 분석 전문가야.
                아래 [참고 기사] 섹션에 번호가 매겨진 실제 뉴스 기사들이 있어.
                반드시 아래 규칙을 엄격하게 지켜서 한국어로 답변해.

                [필수 규칙]
                1. 답변의 모든 정보는 반드시 [참고 기사]에 있는 내용에서만 가져와야 한다.
                2. 각 문장의 끝에 반드시 해당 정보의 출처인 기사 번호를 [1], [2], [3] 형식으로 표기해라.
                   한 문장에 여러 기사를 참고했다면 [1][3]처럼 병기해라.
                3. [참고 기사]에 없는 내용은 절대로 지어내거나 추측하지 마라.
                   만약 질문에 대한 정보가 참고 기사에 부족하면,
                   "제공된 기사에서는 해당 정보를 확인할 수 없습니다."라고 솔직하게 답변해라.
                4. 답변 마지막에 '---' 구분선 아래에 참고한 기사 번호와 제목을 목록으로 정리해라.

                [참고 기사]
                %s

                [사용자 질문]
                %s
                """.formatted(context, question);

        // 4. GPT-4o-mini로 답변 생성
        String answer;
        try {
            answer = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();
            if (answer == null || answer.isBlank()) {
                answer = "답변 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.";
            }
        } catch (Exception e) {
            log.error("[RAG] 답변 생성 실패: {}", e.getMessage(), e);
            answer = "AI 답변 생성 중 오류가 발생했습니다: " + e.getMessage();
        }

        // 5. Document → RagSourceItem 변환
        List<RagResponse.RagSourceItem> sources = retrieved.stream()
                .map(this::toSourceItem)
                .collect(Collectors.toList());

        return new RagResponse(answer, sources);
    }

    // ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

    /** 기사 목록을 번호 붙인 텍스트 블록으로 변환 (GPT가 번호로 인용 가능) */
    private String buildContext(List<Document> docs) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < docs.size(); i++) {
            Document doc = docs.get(i);
            sb.append("[").append(i + 1).append("] ");
            sb.append("제목: ").append(meta(doc, "title")).append("\n");
            sb.append("키워드: ").append(meta(doc, "keyword")).append("\n");
            sb.append("본문: ").append(doc.getText()).append("\n");
            sb.append("요약: ").append(meta(doc, "summary")).append("\n");
            sb.append("AI 분석: ").append(meta(doc, "aiReason")).append("\n\n");
        }
        return sb.toString().trim();
    }

    /** Document 메타데이터에서 RagSourceItem 생성 */
    private RagResponse.RagSourceItem toSourceItem(Document doc) {
        int importanceScore = parseIntMeta(doc, "importanceScore");
        String grade = importanceScore > 0
                ? ImportanceEvaluator.getGrade(importanceScore)
                : "N/A";
        return new RagResponse.RagSourceItem(
                parseLongMeta(doc, "newsId"),
                meta(doc, "title"),
                meta(doc, "url"),
                meta(doc, "keyword"),
                meta(doc, "summary"),
                importanceScore,
                grade,
                meta(doc, "category"),
                doc.getScore()
        );
    }

    private String meta(Document doc, String key) {
        Object val = doc.getMetadata().get(key);
        return val != null ? val.toString() : "";
    }

    private int parseIntMeta(Document doc, String key) {
        Object val = doc.getMetadata().get(key);
        if (val == null) return 0;
        try { return Integer.parseInt(val.toString()); } catch (Exception e) { return 0; }
    }

    private long parseLongMeta(Document doc, String key) {
        Object val = doc.getMetadata().get(key);
        if (val == null) return 0L;
        try { return Long.parseLong(val.toString()); } catch (Exception e) { return 0L; }
    }
}
