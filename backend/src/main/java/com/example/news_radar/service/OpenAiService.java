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
     * AI 중요도 평가 — 3가지 기준(파급력/혁신성/시의성)으로 평가한 결과를 JSON으로 반환
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

            int impact     = Math.max(0, Math.min(20, raw.impact()));
            int innovation = Math.max(0, Math.min(15, raw.innovation()));
            int timeliness = Math.max(0, Math.min(15, raw.timeliness()));
            String reason   = (raw.reason()   == null || raw.reason().isBlank())   ? "분석 근거 없음" : raw.reason();
            String category = (raw.category() == null || raw.category().isBlank()) ? "기타"         : raw.category();
            String summary  = (raw.summary()  == null || raw.summary().isBlank())  ? "요약 없음"    : raw.summary();

            return new AiEvaluation(impact, innovation, timeliness, reason, category, summary);
        } catch (Exception e) {
            log.error("AI 중요도 평가 실패: {}", e.getMessage(), e);
            return new AiEvaluation(10, 7, 8, "분석 실패: " + e.getMessage(), "기타", "요약 생성 실패");
        }
    }
}
