package com.example.news_radar.service;

import com.example.news_radar.dto.AiEvaluation;
import com.example.news_radar.dto.RawNewsItem;
import com.example.news_radar.entity.News;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.*;

/**
 * OpenAI API 연동 서비스.
 *
 * 아키텍처 결정 — Resilience 전략:
 *   @Retryable을 배치 평가(evaluateImportanceBatch)와 핵심 단건 평가에 적용하여
 *   OpenAI 429 Rate Limit, 5xx 서버 오류 시 지수 백오프(1s→2s→4s)로 최대 3회 재시도.
 *
 *   재시도 대상 예외:
 *   - WebClientResponseException: HTTP 레벨 오류 (429, 502, 503)
 *   - RuntimeException: Spring AI가 래핑하는 다양한 일시적 오류
 *
 *   @Recover로 최종 실패 시 안전한 기본값을 반환하여 파이프라인이 중단되지 않도록 보장.
 *   내부 호출(fallbackToIndividual → evaluateImportance)은 AOP 프록시를 거치지 않으므로
 *   @Retryable이 적용되지 않지만, 내부의 try-catch가 동일한 안전망 역할을 수행함.
 */
@Slf4j
@Service
public class OpenAiService {

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OpenAiService(ChatClient.Builder chatClientBuilder) {
        this.chatClient = chatClientBuilder.build();
    }

    /**
     * Connecting the Dots — 주요 뉴스들 사이의 숨겨진 연관성·트렌드 인사이트 생성.
     */
    @Retryable(
            retryFor = { WebClientResponseException.class, RuntimeException.class },
            noRetryFor = { IllegalArgumentException.class },
            maxAttempts = 3,
            backoff = @Backoff(delay = 1000, multiplier = 2.0, maxDelay = 8000)
    )
    public String generateTrendInsight(List<News> topNews) {
        if (topNews == null || topNews.isEmpty()) {
            return "분석할 뉴스가 없습니다.";
        }

        StringBuilder newsBlock = new StringBuilder();
        for (int i = 0; i < topNews.size(); i++) {
            News news = topNews.get(i);
            newsBlock.append("[").append(i + 1).append("] ")
                    .append(news.getTitle()).append("\n");
            if (news.getSummary() != null && !news.getSummary().isBlank()) {
                newsBlock.append("요약: ").append(news.getSummary()).append("\n");
            }
            if (news.getCategory() != null && !news.getCategory().isBlank()) {
                newsBlock.append("카테고리: ").append(news.getCategory()).append("\n");
            }
            newsBlock.append("\n");
        }

        String prompt = """
                너는 IT 기술 트렌드를 분석하는 시니어 애널리스트야.
                아래 제공된 주요 뉴스들을 분석하여, 개별 뉴스의 요약이 아닌
                **이 뉴스들 사이의 숨겨진 연관성, 공통된 기술 트렌드, 또는 산업의 변화 흐름(Connecting the Dots)**을
                2~3문단의 심층 글로 작성해 줘.

                규칙:
                - 각 기사의 내용을 단순히 나열하지 마.
                - 여러 기사를 관통하는 거시적 흐름이나 패러다임 전환을 찾아내.
                - 독자가 "아, 이런 큰 그림이 있었구나"라고 느낄 수 있는 인사이트를 담아.
                - 한국어로 작성해.

                [주요 뉴스 목록]
                %s
                """.formatted(newsBlock.toString());

        String content = chatClient.prompt()
                .user(prompt)
                .call()
                .content();
        return (content != null && !content.isBlank()) ? content : "트렌드 인사이트 생성에 실패했습니다.";
    }

    @Recover
    public String recoverTrendInsight(Exception e, List<News> topNews) {
        log.error("[TrendInsight] 최종 실패 (재시도 소진): {}", e.getMessage(), e);
        return "트렌드 인사이트 생성 중 오류가 발생했습니다.";
    }

    // 한 줄 요약 기능 (ai-test 엔드포인트용)
    public String getSummary(String newsTitle) {
        String prompt = "다음 뉴스 제목을 보고, 이 뉴스가 IT 개발자에게 왜 중요한지 한 줄로 요약해서 설명해줘: " + newsTitle;
        String content = chatClient.prompt()
                .user(prompt)
                .call()
                .content();
        return content != null ? content : "요약 실패: 응답이 비어있습니다.";
    }

    /**
     * 검색어 확장 (Query Expansion).
     * 실패 시 빈 리스트 반환 (원본 키워드만 사용).
     */
    @Retryable(
            retryFor = { WebClientResponseException.class, RuntimeException.class },
            noRetryFor = { IllegalArgumentException.class },
            maxAttempts = 2,
            backoff = @Backoff(delay = 500, multiplier = 2.0)
    )
    public List<String> expandKeyword(String keyword) {
        String prompt = """
                너는 IT/기술 뉴스 검색 전문가야.
                아래 키워드와 관련된 최신 기술 뉴스를 더 잘 찾을 수 있도록,
                문맥적으로 연관된 검색어 3개를 만들어줘.

                규칙:
                - 원본 키워드의 의미를 확장하되, 너무 동떨어지지 않게 해.
                - 한국어 검색에 적합한 형태로 작성해.
                - 콤마(,)로 구분된 3개의 검색어만 출력해. 다른 텍스트는 절대 포함하지 마.

                키워드: %s
                """.formatted(keyword);

        String response = chatClient.prompt()
                .user(prompt)
                .call()
                .content();
        if (response == null || response.isBlank()) {
            log.warn("[QueryExpansion] 확장 실패 (빈 응답), 원본 키워드만 사용: {}", keyword);
            return List.of();
        }
        List<String> expanded = Arrays.stream(response.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        log.info("[QueryExpansion] '{}' → {}", keyword, expanded);
        return expanded;
    }

    @Recover
    public List<String> recoverExpandKeyword(Exception e, String keyword) {
        log.error("[QueryExpansion] 최종 실패 (재시도 소진): keyword={}, error={}", keyword, e.getMessage());
        return List.of();
    }

    /**
     * 키워드의 검색용 동의어를 LLM으로 생성한다.
     * 한글/영문/약자/띄어쓰기 변형 등 네이버 뉴스 검색에 유용한 변형어 3~5개를 반환.
     * 실패 시 빈 리스트를 반환하여 파이프라인을 중단시키지 않는다.
     */
    @Retryable(
            retryFor = { WebClientResponseException.class, RuntimeException.class },
            noRetryFor = { IllegalArgumentException.class },
            maxAttempts = 2,
            backoff = @Backoff(delay = 500, multiplier = 2.0)
    )
    public List<String> generateSynonyms(String keyword) {
        String prompt = """
                너는 한국어 뉴스 검색 최적화 전문가야.
                아래 키워드로 네이버 뉴스를 검색할 때, 누락 없이 기사를 찾기 위해
                사용할 수 있는 동의어/변형어를 3~5개 만들어줘.

                규칙:
                - 한글 표기, 영문 표기, 약자, 띄어쓰기 변형 등을 포함해.
                - 원본 키워드 자체는 포함하지 마.
                - 콤마(,)로 구분된 단어만 출력해. 다른 텍스트는 절대 포함하지 마.

                키워드: %s
                """.formatted(keyword);

        String response = chatClient.prompt()
                .user(prompt)
                .call()
                .content();

        if (response == null || response.isBlank()) {
            log.warn("[SynonymGen] 동의어 생성 실패 (빈 응답): keyword={}", keyword);
            return List.of();
        }

        List<String> synonyms = Arrays.stream(response.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        log.info("[SynonymGen] '{}' → {}", keyword, synonyms);
        return synonyms;
    }

    @Recover
    public List<String> recoverGenerateSynonyms(Exception e, String keyword) {
        log.error("[SynonymGen] 최종 실패 (재시도 소진): keyword={}, error={}", keyword, e.getMessage());
        return List.of();
    }

    /**
     * AI 중요도 평가 (단건).
     *
     * @Retryable: 429/5xx 오류 시 지수 백오프 1s→2s→4s, 최대 3회 재시도.
     * @Recover: 최종 실패 시 보수적 기본 점수 반환 (파이프라인 중단 방지).
     */
    @Retryable(
            retryFor = { WebClientResponseException.class, RuntimeException.class },
            noRetryFor = { IllegalArgumentException.class },
            maxAttempts = 3,
            backoff = @Backoff(delay = 1000, multiplier = 2.0, maxDelay = 8000)
    )
    public AiEvaluation evaluateImportance(String title, String content, List<String> keywords) {
        String trimmedContent = (content != null && content.length() > 1500)
                ? content.substring(0, 1500) : (content != null ? content : "");

        String prompt = """
                너는 기술 뉴스 분석 AI 에이전트야.
                아래 뉴스를 분석하고, 반드시 아래 JSON 형식으로만 응답해.
                다른 텍스트 없이 순수 JSON만 출력해.

                [뉴스 제목]
                %s

                [뉴스 본문 일부]
                %s

                [관심 키워드]
                %s

                [평가 기준]
                - impact(파급력): 이 뉴스가 IT 생태계/산업에 미치는 영향력 (0~20점)
                - innovation(혁신성): 기술적 참신함과 새로운 관점 제시 여부 (0~15점)
                - timeliness(시의성): 현재 트렌드와의 관련성 및 시의적절함 (0~15점)

                [응답 형식]
                {"impact": 0~20 사이 정수, "innovation": 0~15 사이 정수, "timeliness": 0~15 사이 정수, "reason": "이 뉴스가 중요한 이유 1~2문장", "category": "주요 기술 카테고리 하나", "summary": "핵심 내용 3줄 요약"}
                """.formatted(title, trimmedContent, String.join(", ", keywords));

        AiEvaluation raw = chatClient.prompt()
                .user(prompt)
                .call()
                .entity(AiEvaluation.class);

        if (raw == null) {
            return new AiEvaluation(10, 7, 8, "분석 실패", "기타", "응답이 비어있습니다.");
        }

        return sanitize(raw);
    }

    /**
     * evaluateImportance 최종 실패 시 fallback.
     * 보수적 중간 점수를 반환하여 파이프라인이 계속 진행되도록 함.
     */
    @Recover
    public AiEvaluation recoverEvaluateImportance(Exception e, String title, String content, List<String> keywords) {
        log.error("[AI평가] 최종 실패 (재시도 소진): title='{}', error={}", title, e.getMessage());
        return new AiEvaluation(10, 7, 8, "분석 실패: " + e.getMessage(), "기타", "요약 생성 실패");
    }

    /**
     * AI 중요도 배치 평가.
     *
     * @Retryable: 배치 전체에 대해 재시도. 429/5xx 시 지수 백오프 적용.
     * @Recover: 최종 실패 시 개별 평가 fallback으로 전환.
     */
    @Retryable(
            retryFor = { WebClientResponseException.class, RuntimeException.class },
            noRetryFor = { IllegalArgumentException.class },
            maxAttempts = 3,
            backoff = @Backoff(delay = 2000, multiplier = 2.0, maxDelay = 16000)
    )
    public List<AiEvaluation> evaluateImportanceBatch(List<RawNewsItem> items, List<String> keywords) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }

        // 단건이면 기존 단건 평가 사용
        if (items.size() == 1) {
            RawNewsItem item = items.get(0);
            return List.of(evaluateImportanceSafe(item.getTitle(), item.getContent(), keywords));
        }

        String prompt = buildBatchPrompt(items, keywords);
        String rawResponse = chatClient.prompt()
                .user(prompt)
                .call()
                .content();

        if (rawResponse == null || rawResponse.isBlank()) {
            log.warn("[BatchEval] 빈 응답, 개별 평가로 fallback ({}건)", items.size());
            return fallbackToIndividual(items, keywords);
        }

        return parseBatchResponse(rawResponse, items, keywords);
    }

    /**
     * evaluateImportanceBatch 최종 실패 시 fallback.
     * 개별 평가로 전환하여 부분적으로라도 결과를 확보함.
     */
    @Recover
    public List<AiEvaluation> recoverEvaluateImportanceBatch(
            Exception e, List<RawNewsItem> items, List<String> keywords) {
        log.error("[BatchEval] 최종 실패 (재시도 소진), 개별 평가로 fallback: {}", e.getMessage());
        return fallbackToIndividual(items, keywords);
    }

    // ==================== 배치 평가 내부 헬퍼 ====================

    /**
     * 내부 호출용 단건 평가 (try-catch 포함).
     * AOP 프록시를 거치지 않는 내부 호출이므로 @Retryable 미적용.
     * 대신 자체 try-catch로 안전하게 처리.
     */
    private AiEvaluation evaluateImportanceSafe(String title, String content, List<String> keywords) {
        try {
            return evaluateImportance(title, content, keywords);
        } catch (Exception e) {
            log.error("AI 중요도 평가 실패 (내부 호출): {}", e.getMessage(), e);
            return new AiEvaluation(10, 7, 8, "분석 실패: " + e.getMessage(), "기타", "요약 생성 실패");
        }
    }

    private String buildBatchPrompt(List<RawNewsItem> items, List<String> keywords) {
        StringBuilder articlesBlock = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            RawNewsItem item = items.get(i);
            String trimmedContent = (item.getContent() != null && item.getContent().length() > 800)
                    ? item.getContent().substring(0, 800) : (item.getContent() != null ? item.getContent() : "");

            articlesBlock.append("--- 기사 articleIndex=").append(i).append(" ---\n");
            articlesBlock.append("제목: ").append(item.getTitle()).append("\n");
            articlesBlock.append("본문 일부: ").append(trimmedContent).append("\n\n");
        }

        return """
                너는 기술 뉴스 분석 AI 에이전트야.
                아래에 %d개의 뉴스 기사가 있어. 각 기사를 분석하고,
                반드시 JSON 배열 형태로만 응답해. 다른 텍스트 없이 순수 JSON 배열만 출력해.

                [관심 키워드]
                %s

                [기사 목록]
                %s

                [평가 기준]
                - impact(파급력): 이 뉴스가 IT 생태계/산업에 미치는 영향력 (0~20점)
                - innovation(혁신성): 기술적 참신함과 새로운 관점 제시 여부 (0~15점)
                - timeliness(시의성): 현재 트렌드와의 관련성 및 시의적절함 (0~15점)

                [필수 응답 규칙]
                1. 반드시 JSON 배열 형식으로 응답해: [{...}, {...}, ...]
                2. 배열의 각 객체에는 반드시 "articleIndex" 필드를 포함해. 이 값은 위 기사 목록에서 부여한 articleIndex 번호(정수)와 정확히 일치해야 한다.
                3. 기사 %d개 모두에 대해 빠짐없이 평가해.

                [각 객체의 형식]
                {"articleIndex": 정수, "impact": 0~20, "innovation": 0~15, "timeliness": 0~15, "reason": "중요한 이유 1~2문장", "category": "기술 카테고리 하나", "summary": "핵심 내용 3줄 요약"}
                """.formatted(
                items.size(),
                String.join(", ", keywords),
                articlesBlock.toString(),
                items.size()
        );
    }

    private List<AiEvaluation> parseBatchResponse(
            String rawResponse, List<RawNewsItem> items, List<String> keywords) {

        String jsonStr = extractJsonArray(rawResponse);

        try {
            JsonNode arrayNode = objectMapper.readTree(jsonStr);
            if (!arrayNode.isArray()) {
                log.warn("[BatchEval] 응답이 JSON 배열이 아님, 개별 평가로 fallback");
                return fallbackToIndividual(items, keywords);
            }

            Map<Integer, AiEvaluation> evalMap = new HashMap<>();
            for (JsonNode node : arrayNode) {
                try {
                    int articleIndex = node.has("articleIndex") ? node.get("articleIndex").asInt(-1) : -1;
                    if (articleIndex < 0 || articleIndex >= items.size()) continue;

                    int impact = clamp(node.path("impact").asInt(10), 0, 20);
                    int innovation = clamp(node.path("innovation").asInt(7), 0, 15);
                    int timeliness = clamp(node.path("timeliness").asInt(8), 0, 15);
                    String reason = nodeText(node, "reason", "분석 근거 없음");
                    String category = nodeText(node, "category", "기타");
                    String summary = nodeText(node, "summary", "요약 없음");

                    evalMap.put(articleIndex, new AiEvaluation(impact, innovation, timeliness, reason, category, summary));
                } catch (Exception e) {
                    log.warn("[BatchEval] 개별 항목 파싱 실패: {}", e.getMessage());
                }
            }

            List<AiEvaluation> results = new ArrayList<>();
            for (int i = 0; i < items.size(); i++) {
                AiEvaluation eval = evalMap.get(i);
                if (eval != null) {
                    results.add(eval);
                } else {
                    log.warn("[BatchEval] articleIndex={} 누락, 개별 평가로 보충", i);
                    RawNewsItem item = items.get(i);
                    results.add(evaluateImportanceSafe(item.getTitle(), item.getContent(), keywords));
                }
            }

            log.info("[BatchEval] 배치 평가 완료: 요청={}건, 배치성공={}건, 개별보충={}건",
                    items.size(), evalMap.size(), items.size() - evalMap.size());
            return results;

        } catch (Exception e) {
            log.error("[BatchEval] JSON 파싱 실패, 개별 평가로 fallback: {}", e.getMessage(), e);
            return fallbackToIndividual(items, keywords);
        }
    }

    private String extractJsonArray(String raw) {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start >= 0 && end > start) {
            return raw.substring(start, end + 1);
        }
        return raw;
    }

    private List<AiEvaluation> fallbackToIndividual(List<RawNewsItem> items, List<String> keywords) {
        List<AiEvaluation> results = new ArrayList<>();
        for (RawNewsItem item : items) {
            results.add(evaluateImportanceSafe(item.getTitle(), item.getContent(), keywords));
        }
        return results;
    }

    private AiEvaluation sanitize(AiEvaluation raw) {
        int impact     = Math.max(0, Math.min(20, raw.impact()));
        int innovation = Math.max(0, Math.min(15, raw.innovation()));
        int timeliness = Math.max(0, Math.min(15, raw.timeliness()));
        String reason   = (raw.reason()   == null || raw.reason().isBlank())   ? "분석 근거 없음" : raw.reason();
        String category = (raw.category() == null || raw.category().isBlank()) ? "기타"         : raw.category();
        String summary  = (raw.summary()  == null || raw.summary().isBlank())  ? "요약 없음"    : raw.summary();
        return new AiEvaluation(impact, innovation, timeliness, reason, category, summary);
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private String nodeText(JsonNode parent, String field, String defaultValue) {
        JsonNode node = parent.get(field);
        if (node == null || node.isNull() || node.asText().isBlank()) return defaultValue;
        return node.asText();
    }
}
