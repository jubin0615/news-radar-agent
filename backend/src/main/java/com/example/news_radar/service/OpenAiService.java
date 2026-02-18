package com.example.news_radar.service;

import com.example.news_radar.dto.AiEvaluation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

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
}
