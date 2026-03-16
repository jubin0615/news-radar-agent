package com.example.news_radar.service;

import com.example.news_radar.dto.RagResponse;
import com.example.news_radar.entity.News;
import com.example.news_radar.repository.NewsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.document.Document;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * RAG (Retrieval-Augmented Generation) 파이프라인 서비스
 *
 * 흐름: 질문 임베딩 → 유사 뉴스 검색 → 컨텍스트 주입 → 채팅 모델(app.ai.model.chat) 생성 → 답변 반환
 *
 * 프롬프트는 src/main/resources/prompts/*.st 파일에서 로드합니다.
 */
@Slf4j
@Service
public class RagService {

    private static final int    TOP_K                    = 5;
    private static final double THRESHOLD                = 0.30;
    private static final int    MIN_IMPORTANCE_SCORE     = 60;

    /** 트렌드 브리핑: HIGH 등급 이상 (importanceScore >= 70) */
    private static final int    TREND_MIN_IMPORTANCE     = 70;
    private static final int    TREND_TOP_N              = 5;

    private final NewsVectorStoreService vectorStoreService;
    private final NewsRepository         newsRepository;
    private final ChatClient             chatClient;
    private final Resource               askPromptResource;
    private final Resource               trendBriefingPromptResource;

    private final Resource               askUserPromptResource;
    private final Resource               trendBriefingUserPromptResource;

    public RagService(
            NewsVectorStoreService vectorStoreService,
            NewsRepository newsRepository,
            ChatClient.Builder chatClientBuilder,
            @Value("${app.ai.model.chat}") String chatModel,
            @Value("classpath:prompts/rag-ask.st") Resource askPromptResource,
            @Value("classpath:prompts/rag-ask-user.st") Resource askUserPromptResource,
            @Value("classpath:prompts/rag-trend-briefing.st") Resource trendBriefingPromptResource,
            @Value("classpath:prompts/rag-trend-briefing-user.st") Resource trendBriefingUserPromptResource
    ) {
        this.vectorStoreService               = vectorStoreService;
        this.newsRepository                   = newsRepository;
        this.chatClient                       = chatClientBuilder
                .defaultOptions(OpenAiChatOptions.builder().model(chatModel).build())
                .build();
        this.askPromptResource                = askPromptResource;
        this.askUserPromptResource            = askUserPromptResource;
        this.trendBriefingPromptResource      = trendBriefingPromptResource;
        this.trendBriefingUserPromptResource  = trendBriefingUserPromptResource;
    }

    /**
     * 사용자 키워드 + userId 기반 RAG 질의 — Vector DB 메타데이터 이중 필터로 격리
     *
     * 필터 조건:
     *   importanceScore >= 60
     *   AND keyword IN (사용자 키워드 목록)
     *   AND ownerUserIds CONTAINS userId
     * → 벡터 검색 단계에서 타 사용자의 뉴스를 원천 차단 (이중 안전장치)
     */
    public RagResponse ask(String question, List<String> userKeywords, Long userId) {
        if (userKeywords == null || userKeywords.isEmpty()) {
            return new RagResponse(
                "등록된 키워드가 없습니다. 키워드를 먼저 추가해 주세요.",
                List.of()
            );
        }

        // Vector DB 레벨 1차 필터: keyword IN + importanceScore >= 60
        FilterExpressionBuilder b = new FilterExpressionBuilder();
        Filter.Expression filter = b.and(
                b.gte("importanceScore", MIN_IMPORTANCE_SCORE),
                b.in("keyword", (Object[]) userKeywords.toArray(new String[0]))
        ).build();

        List<Document> retrieved = vectorStoreService.search(question, TOP_K, THRESHOLD, filter);

        // 2차 안전 필터: ownerUserIds 메타데이터에 userId 포함 여부 검증
        String userIdStr = String.valueOf(userId);
        List<Document> verified = retrieved.stream()
                .filter(doc -> {
                    String owners = meta(doc, "ownerUserIds");
                    return owners.isEmpty() || owners.contains(userIdStr);
                })
                .toList();

        log.info("[RAG] 질문='{}' userId={} 키워드={} 검색={}건 검증={}건",
                question, userId, userKeywords, retrieved.size(), verified.size());

        if (verified.isEmpty()) {
            return new RagResponse(
                "현재 질문과 관련된 뉴스 기사를 찾지 못했습니다.\n" +
                "뉴스를 먼저 수집하거나, 다른 키워드로 질문해 보세요.",
                List.of()
            );
        }

        String context = buildContext(verified);

        PromptTemplate systemTemplate = new PromptTemplate(askPromptResource);
        String systemPrompt = systemTemplate.render(Map.of());

        PromptTemplate userTemplate = new PromptTemplate(askUserPromptResource);
        String userMessage = userTemplate.render(Map.of(
                "context", context,
                "question", PromptSanitizer.sanitize(question)
        ));

        String answer;
        try {
            answer = chatClient.prompt()
                    .system(systemPrompt)
                    .user(userMessage)
                    .call()
                    .content();
            if (answer == null || answer.isBlank()) {
                answer = "답변 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.";
            }
        } catch (Exception e) {
            log.error("[RAG] 답변 생성 실패: {}", e.getMessage(), e);
            answer = "AI 답변 생성 중 오류가 발생했습니다: " + e.getMessage();
        }

        List<RagResponse.RagSourceItem> sources = verified.stream()
                .map(this::toSourceItem)
                .collect(Collectors.toList());

        return new RagResponse(answer, sources);
    }

    /**
     * 사용자 키워드 기반 트렌드 브리핑
     */
    public RagResponse trendBriefing(List<String> userKeywords) {
        if (userKeywords == null || userKeywords.isEmpty()) {
            return new RagResponse(
                "등록된 키워드가 없습니다. 키워드를 먼저 추가해 주세요.",
                List.of()
            );
        }

        List<News> trendNews = newsRepository.findTrendNewsByKeywords(
                userKeywords, TREND_MIN_IMPORTANCE, PageRequest.of(0, TREND_TOP_N));

        log.info("[트렌드 브리핑] 사용자 키워드 기반 HIGH 이상 뉴스 {}건 조회", trendNews.size());

        if (trendNews.isEmpty()) {
            return new RagResponse(
                "현재 중요도 HIGH 이상의 트렌드 뉴스가 없습니다.\n" +
                "뉴스를 먼저 수집해 주세요.",
                List.of()
            );
        }

        String context = buildTrendContext(trendNews);

        PromptTemplate systemTemplate = new PromptTemplate(trendBriefingPromptResource);
        String systemPrompt = systemTemplate.render(Map.of());

        PromptTemplate userTemplate = new PromptTemplate(trendBriefingUserPromptResource);
        String userMessage = userTemplate.render(Map.of("context", context));

        String answer;
        try {
            answer = chatClient.prompt()
                    .system(systemPrompt)
                    .user(userMessage)
                    .call()
                    .content();
            if (answer == null || answer.isBlank()) {
                answer = "트렌드 브리핑 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.";
            }
        } catch (Exception e) {
            log.error("[트렌드 브리핑] 답변 생성 실패: {}", e.getMessage(), e);
            answer = "AI 트렌드 브리핑 생성 중 오류가 발생했습니다: " + e.getMessage();
        }

        List<RagResponse.RagSourceItem> sources = trendNews.stream()
                .map(this::newsToSourceItem)
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

    /** News 엔티티 목록을 번호 붙인 트렌드 컨텍스트 블록으로 변환 */
    private String buildTrendContext(List<News> newsList) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < newsList.size(); i++) {
            News news = newsList.get(i);
            sb.append("[").append(i + 1).append("] ");
            sb.append("제목: ").append(news.getTitle()).append("\n");
            sb.append("키워드: ").append(news.getKeyword()).append("\n");
            sb.append("카테고리: ").append(news.getCategory()).append("\n");
            sb.append("요약: ").append(news.getSummary()).append("\n");
            sb.append("AI 분석: ").append(news.getAiReason()).append("\n");
            sb.append("중요도: ").append(news.getImportanceScore()).append("점 (")
              .append(ImportanceEvaluator.getGrade(news.getImportanceScore())).append(")\n");
            sb.append("시의성 점수: ").append(news.getTimelinessScore()).append("/15\n\n");
        }
        return sb.toString().trim();
    }

    /** News 엔티티에서 RagSourceItem 생성 */
    private RagResponse.RagSourceItem newsToSourceItem(News news) {
        int score = news.getImportanceScore() != null ? news.getImportanceScore() : 0;
        String grade = score > 0 ? ImportanceEvaluator.getGrade(score) : "N/A";
        return new RagResponse.RagSourceItem(
                news.getId(),
                news.getTitle(),
                news.getUrl(),
                news.getKeyword(),
                news.getSummary(),
                score,
                grade,
                news.getCategory(),
                null
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
