package com.example.news_radar.service;

import com.example.news_radar.dto.AiEvaluation;
import com.example.news_radar.dto.AgentRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class OpenAiService {

    private final ChatClient chatClient;

    public OpenAiService(ChatClient.Builder chatClientBuilder) {
        this.chatClient = chatClientBuilder.build();
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
     * AI 중요도 평가 - 제목+본문+키워드를 분석해서 JSON으로 결과 반환
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

                [응답 형식]
                {"score": 1에서 10 사이 정수, "reason": "이 뉴스가 중요한 이유 1~2문장", "category": "주요 기술 카테고리 하나", "summary": "핵심 내용 3줄 요약"}
                """.formatted(title, trimmedContent, String.join(", ", keywords));
        try {
            AiEvaluation aiEvaluation = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .entity(AiEvaluation.class);

            if (aiEvaluation == null) {
                return new AiEvaluation(5, "분석 실패", "기타", "응답이 비어있습니다.");
            }

            int score = Math.max(1, Math.min(10, aiEvaluation.getScore()));
            String reason = (aiEvaluation.getReason() == null || aiEvaluation.getReason().isBlank())
                    ? "분석 근거 없음" : aiEvaluation.getReason();
            String category = (aiEvaluation.getCategory() == null || aiEvaluation.getCategory().isBlank())
                    ? "기타" : aiEvaluation.getCategory();
            String summary = (aiEvaluation.getSummary() == null || aiEvaluation.getSummary().isBlank())
                    ? "요약 없음" : aiEvaluation.getSummary();

            return new AiEvaluation(score, reason, category, summary);
        } catch (Exception e) {
            log.error("AI 중요도 평가 실패: {}", e.getMessage(), e);
            return new AiEvaluation(5, "분석 실패: " + e.getMessage(), "기타", "요약 생성 실패");
        }
    }

    /**
     * 에이전트 대화 - 전체 대화 컨텍스트 + 현재 시스템 상태를 반영한 자연스러운 응답 생성
     * LLM이 도구 호출이 필요하다고 판단하면 특수 JSON 형식으로 응답
     */
    public AgentLlmResponse agentChat(List<AgentRequest.Message> messages, String systemContext) {
        String systemPrompt = """
                너는 "뉴스 레이더"라는 IT 기술 뉴스 분석 서비스의 AI 에이전트야.
                사용자와 자연스럽게 대화하면서, 필요할 때 도구를 사용해 뉴스를 검색하거나 수집하거나 리포트를 생성해.

                ## 성격
                - 친절하고 전문적인 IT 뉴스 분석가
                - 사용자의 질문에 맥락을 이해하고 자연스럽게 대화
                - 필요한 경우에만 도구를 사용하고, 일반 대화에는 그냥 자연스럽게 답변

                ## 사용 가능한 도구
                도구를 사용해야 할 때는 반드시 아래 JSON 형식으로 응답해. 다른 텍스트 없이 순수 JSON만 출력해.

                1. 뉴스 검색 (DB에 이미 수집된 뉴스에서 검색)
                   {"tool": "search_news", "keyword": "검색 키워드", "message": "사용자에게 보여줄 메시지"}

                2. 뉴스 수집 (인터넷에서 새로운 뉴스를 크롤링해 DB에 저장)
                   {"tool": "collect_news", "message": "사용자에게 보여줄 메시지"}

                3. 일일 리포트 생성 (수집된 뉴스를 분석해 브리핑 리포트 생성)
                   {"tool": "generate_report", "message": "사용자에게 보여줄 메시지"}

                ## 도구 사용 판단 기준
                - "뉴스 알려줘", "뉴스 검색", "~에 대해 알려줘", "~소식", "~동향" → search_news
                - "뉴스 수집", "크롤링", "새 뉴스 가져와", "최신 뉴스 업데이트" → collect_news
                - "리포트", "보고서", "브리핑", "요약 정리" → generate_report
                - 그 외 일반 질문, 안부, 잡담 → 도구 없이 자연스럽게 대화

                ## 현재 시스템 상태
                %s

                ## 중요 규칙
                - 도구를 사용할 때는 반드시 위의 JSON 형식 하나만 출력해. 추가 설명 텍스트 없이.
                - 도구를 사용하지 않을 때는 자연스러운 한국어로 대화해.
                - 수집된 뉴스가 없는 상태에서 검색 요청이 오면, 먼저 뉴스 수집을 제안해.
                - 사용자가 뉴스에 대해 추가 질문하면 이전 대화 맥락을 참고해 답변해.
                """.formatted(systemContext);

        List<Message> springMessages = buildSpringMessages(messages, systemPrompt);

        try {
            String response = chatClient.prompt()
                    .messages(springMessages)
                    .call()
                    .content();

            if (response == null || response.isBlank()) {
                return new AgentLlmResponse(null, "응답을 생성하지 못했습니다.");
            }

            // LLM이 tool JSON으로 응답했는지 확인
            String trimmed = response.strip();
            if (trimmed.startsWith("{") && trimmed.contains("\"tool\"")) {
                try {
                    // JSON 파싱 시도
                    var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    var node = mapper.readTree(trimmed);
                    String tool = node.has("tool") ? node.get("tool").asText() : null;
                    String keyword = node.has("keyword") ? node.get("keyword").asText() : null;
                    String message = node.has("message") ? node.get("message").asText() : null;

                    if (tool != null && !tool.isBlank()) {
                        return new AgentLlmResponse(
                                new ToolCall(tool, keyword, message),
                                message != null ? message : ""
                        );
                    }
                } catch (Exception e) {
                    log.warn("Tool JSON 파싱 실패, 일반 텍스트로 처리: {}", e.getMessage());
                }
            }

            return new AgentLlmResponse(null, response);
        } catch (Exception e) {
            log.error("에이전트 대화 실패: {}", e.getMessage(), e);
            return new AgentLlmResponse(null, "죄송합니다, 응답 생성 중 오류가 발생했습니다.");
        }
    }

    // AgentRequest.Message 목록을 Spring AI Message 목록으로 변환
    private List<Message> buildSpringMessages(List<AgentRequest.Message> messages, String systemPrompt) {
        List<Message> result = new ArrayList<>();
        result.add(new SystemMessage(systemPrompt));
        if (messages != null) {
            for (AgentRequest.Message msg : messages) {
                if (msg == null || msg.getContent() == null) continue;
                if ("user".equalsIgnoreCase(msg.getRole())) {
                    result.add(new UserMessage(msg.getContent()));
                } else if ("assistant".equalsIgnoreCase(msg.getRole())) {
                    result.add(new AssistantMessage(msg.getContent()));
                }
            }
        }
        return result;
    }

    // LLM 응답 래퍼
    public record AgentLlmResponse(ToolCall toolCall, String textResponse) {
        public boolean hasToolCall() {
            return toolCall != null;
        }
    }

    // 도구 호출 정보
    public record ToolCall(String tool, String keyword, String message) {}
}
