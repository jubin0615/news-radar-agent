package com.example.news_radar.service;

import com.example.news_radar.dto.AiEvaluation;
import com.example.news_radar.dto.AgentRequest;
import com.example.news_radar.dto.IntentResult;
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
     * 반환 형식: {"score": 1~10, "reason": "...", "category": "...", "summary": "..."}
     */
    public AiEvaluation evaluateImportance(String title, String content, List<String> keywords) {
        // 본문이 너무 길면 잘라서 토큰 절약
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
     * 전체 대화 히스토리를 보고 사용자의 의도(액션)를 LLM으로 분류
     * - 반환 action: "collect" | "report" | "search" | "chat"
     * - "search"일 때는 keyword 필드도 채워서 반환
     */
    public IntentResult classifyIntent(List<AgentRequest.Message> messages) {
        List<Message> springMessages = buildSpringMessages(messages, """
                너는 뉴스 레이더 AI 에이전트의 의도 분류기야.
                사용자의 대화 내용을 분석해서 반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이 순수 JSON만 출력해.

                가능한 액션:
                - "collect": 뉴스 수집 / 크롤링 요청 (예: "뉴스 수집해줘", "collect")
                - "report": 리포트 / 보고서 / 브리핑 생성 요청 (예: "오늘 리포트 보여줘", "daily report 만들어줘")
                - "search": 특정 키워드 뉴스 검색 요청 (예: "AI 뉴스 알려줘", "반도체 관련 뉴스")
                - "chat": 그 외 일반 질문 / 대화

                응답 형식:
                {"action": "collect"}
                {"action": "report"}
                {"action": "search", "keyword": "검색할 키워드"}
                {"action": "chat"}
                """);

        try {
            IntentResult result = chatClient.prompt()
                    .messages(springMessages)
                    .call()
                    .entity(IntentResult.class);
            if (result == null || result.getAction() == null) {
                return new IntentResult("chat", null);
            }
            return result;
        } catch (Exception e) {
            log.error("의도 분류 실패: {}", e.getMessage(), e);
            return new IntentResult("chat", null);
        }
    }

    /**
     * 전체 대화 컨텍스트를 반영한 챗봇 응답 생성
     * - 이전 메시지들을 모두 포함해서 맥락을 이해한 답변 반환
     */
    public String chatWithContext(List<AgentRequest.Message> messages) {
        List<Message> springMessages = buildSpringMessages(messages, """
                너는 뉴스 레이더 서비스의 AI 어시스턴트야.
                IT 기술 뉴스 분석 전문가로서 사용자와 자연스럽게 대화해.
                이전 대화 맥락을 항상 반영해서 일관성 있게 답변해.
                뉴스 수집, 뉴스 검색, 리포트 생성 기능을 안내할 수 있어.
                """);

        try {
            String response = chatClient.prompt()
                    .messages(springMessages)
                    .call()
                    .content();
            return response != null ? response : "응답을 생성하지 못했습니다.";
        } catch (Exception e) {
            log.error("챗봇 응답 생성 실패: {}", e.getMessage(), e);
            return "응답 생성 중 오류가 발생했습니다: " + e.getMessage();
        }
    }

    // AgentRequest.Message 목록을 Spring AI Message 목록으로 변환 (시스템 프롬프트 포함)
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
}
