package com.example.news_radar.service;

import com.example.news_radar.dto.AiEvaluation;
import com.example.news_radar.dto.RawNewsItem;
import com.example.news_radar.entity.News;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.*;

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
     * headlines + radarBoard에 속한 뉴스만 전달받아 거시적 흐름을 2~3문단으로 도출합니다.
     *
     * @param topNews headlines + radarBoard 뉴스 목록
     * @return 심층 트렌드 분석 텍스트 (2~3문단)
     */
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

        try {
            String content = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();
            return (content != null && !content.isBlank()) ? content : "트렌드 인사이트 생성에 실패했습니다.";
        } catch (Exception e) {
            log.error("[TrendInsight] 생성 실패: {}", e.getMessage(), e);
            return "트렌드 인사이트 생성 중 오류가 발생했습니다.";
        }
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
     * 사용자가 등록한 단일 키워드를 LLM에게 보내, 문맥 기반의 연관 검색어 3개를 반환받습니다.
     * 예: "AI" → ["AI 에이전트 최신 동향", "자율 AI 기술", "LLM 활용 사례"]
     */
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
        try {
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
        } catch (Exception e) {
            log.error("[QueryExpansion] 확장 실패: keyword={}, error={}", keyword, e.getMessage(), e);
            return List.of();
        }
    }

    /**
     * AI 중요도 평가 (단건) — 3가지 기준(파급력/혁신성/시의성)으로 평가한 결과를 JSON으로 반환.
     * 배치 평가 실패 시 fallback으로도 사용됩니다.
     */
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
        try {
            AiEvaluation raw = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .entity(AiEvaluation.class);

            if (raw == null) {
                return new AiEvaluation(10, 7, 8, "분석 실패", "기타", "응답이 비어있습니다.");
            }

            return sanitize(raw);
        } catch (Exception e) {
            log.error("AI 중요도 평가 실패: {}", e.getMessage(), e);
            return new AiEvaluation(10, 7, 8, "분석 실패: " + e.getMessage(), "기타", "요약 생성 실패");
        }
    }

    /**
     * AI 중요도 배치 평가 — 여러 기사를 한 번의 API 호출로 동시에 평가합니다.
     *
     * 프롬프트에 각 기사를 articleIndex(0-based)와 함께 전달하고,
     * 응답 JSON 배열의 각 객체에도 "articleIndex" 필드를 포함하도록 지시합니다.
     * 이를 기준으로 기사와 평가 결과를 정확하게 매핑합니다.
     *
     * 배치 평가 실패 시, 개별 evaluateImportance()로 자동 fallback합니다.
     *
     * @param items 평가할 기사 리스트
     * @param keywords 전체 활성 키워드 리스트 (평가 컨텍스트용)
     * @return items와 동일한 크기/순서의 AiEvaluation 리스트
     */
    public List<AiEvaluation> evaluateImportanceBatch(List<RawNewsItem> items, List<String> keywords) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }

        // 단건이면 기존 단건 평가 사용
        if (items.size() == 1) {
            RawNewsItem item = items.get(0);
            return List.of(evaluateImportance(item.getTitle(), item.getContent(), keywords));
        }

        try {
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

        } catch (Exception e) {
            log.error("[BatchEval] 배치 평가 실패, 개별 평가로 fallback: {}", e.getMessage(), e);
            return fallbackToIndividual(items, keywords);
        }
    }

    // ==================== 배치 평가 내부 헬퍼 ====================

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

    /**
     * 배치 응답 JSON 파싱.
     * articleIndex 기준으로 매핑하여, 누락된 기사는 개별 fallback 처리합니다.
     */
    private List<AiEvaluation> parseBatchResponse(
            String rawResponse, List<RawNewsItem> items, List<String> keywords) {

        // JSON 배열 추출 (응답에 ```json 등의 마크다운이 섞여 있을 수 있음)
        String jsonStr = extractJsonArray(rawResponse);

        try {
            JsonNode arrayNode = objectMapper.readTree(jsonStr);
            if (!arrayNode.isArray()) {
                log.warn("[BatchEval] 응답이 JSON 배열이 아님, 개별 평가로 fallback");
                return fallbackToIndividual(items, keywords);
            }

            // articleIndex → AiEvaluation 매핑
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

            // items 순서대로 결과 조립 (누락된 항목은 개별 fallback)
            List<AiEvaluation> results = new ArrayList<>();
            for (int i = 0; i < items.size(); i++) {
                AiEvaluation eval = evalMap.get(i);
                if (eval != null) {
                    results.add(eval);
                } else {
                    log.warn("[BatchEval] articleIndex={} 누락, 개별 평가로 보충", i);
                    RawNewsItem item = items.get(i);
                    results.add(evaluateImportance(item.getTitle(), item.getContent(), keywords));
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

    /** 응답 문자열에서 JSON 배열 부분만 추출 */
    private String extractJsonArray(String raw) {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start >= 0 && end > start) {
            return raw.substring(start, end + 1);
        }
        return raw;
    }

    /** 개별 평가 fallback */
    private List<AiEvaluation> fallbackToIndividual(List<RawNewsItem> items, List<String> keywords) {
        List<AiEvaluation> results = new ArrayList<>();
        for (RawNewsItem item : items) {
            results.add(evaluateImportance(item.getTitle(), item.getContent(), keywords));
        }
        return results;
    }

    /** AiEvaluation 필드 값 정규화 */
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
