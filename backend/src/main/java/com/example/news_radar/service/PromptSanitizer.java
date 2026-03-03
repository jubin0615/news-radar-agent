package com.example.news_radar.service;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 프롬프트 인젝션(Prompt Injection) 방어 유틸리티.
 *
 * 외부에서 가져온 텍스트(크롤링한 뉴스 제목·본문 등)를 AI 프롬프트에 삽입하기 전에
 * 악의적인 지시문 패턴을 제거하여 모델 오동작을 방지한다.
 *
 * 방어 계층:
 *   1. 시스템/사용자 메시지 분리 (ChatClient .system() + .user() 사용) — 구조적 방어
 *   2. 텍스트 새니타이징 (이 클래스) — 콘텐츠 레벨 방어
 *   3. 시스템 프롬프트에 "데이터 전용" 경계 명시 — 지시적 방어
 */
public final class PromptSanitizer {

    private PromptSanitizer() {}

    /**
     * 프롬프트 인젝션에 흔히 사용되는 패턴 목록.
     * 한국어 및 영어 변형을 모두 포함한다.
     */
    private static final List<Pattern> INJECTION_PATTERNS = List.of(
            // 영문 패턴
            Pattern.compile("(?i)ignore\\s+(all\\s+)?previous\\s+instructions?"),
            Pattern.compile("(?i)ignore\\s+(all\\s+)?above\\s+instructions?"),
            Pattern.compile("(?i)disregard\\s+(all\\s+)?previous"),
            Pattern.compile("(?i)forget\\s+(all\\s+)?previous"),
            Pattern.compile("(?i)you\\s+are\\s+now\\s+a"),
            Pattern.compile("(?i)act\\s+as\\s+(if\\s+you\\s+are|a)"),
            Pattern.compile("(?i)new\\s+instructions?\\s*:"),
            Pattern.compile("(?i)system\\s*:\\s*"),
            Pattern.compile("(?i)\\[\\s*system\\s*\\]"),
            Pattern.compile("(?i)override\\s+(previous|system)"),
            Pattern.compile("(?i)do\\s+not\\s+follow\\s+(the\\s+)?(previous|above)"),
            // 한국어 패턴
            Pattern.compile("이전\\s*지시를?\\s*(무시|잊어|취소)"),
            Pattern.compile("위의?\\s*지시를?\\s*(무시|잊어|취소)"),
            Pattern.compile("모든\\s*지시를?\\s*(무시|잊어|취소)"),
            Pattern.compile("시스템\\s*프롬프트를?\\s*(무시|변경|취소)"),
            Pattern.compile("새로운\\s*지시\\s*:"),
            Pattern.compile("너는?\\s*이제부터"),
            Pattern.compile("역할을?\\s*(바꿔|변경)")
    );

    /**
     * 외부 텍스트를 새니타이징하여 프롬프트 인젝션 패턴을 제거한다.
     *
     * @param input 외부에서 가져온 원본 텍스트 (뉴스 제목, 본문 등)
     * @return 새니타이징된 텍스트. null 입력 시 빈 문자열 반환.
     */
    public static String sanitize(String input) {
        if (input == null) return "";
        String result = input;
        for (Pattern pattern : INJECTION_PATTERNS) {
            result = pattern.matcher(result).replaceAll("[FILTERED]");
        }
        return result;
    }

    /**
     * 텍스트를 지정된 최대 길이로 자르고 새니타이징한다.
     *
     * @param input     원본 텍스트
     * @param maxLength 최대 허용 문자 수
     * @return 잘리고 새니타이징된 텍스트
     */
    public static String sanitizeAndTruncate(String input, int maxLength) {
        if (input == null) return "";
        String truncated = input.length() > maxLength ? input.substring(0, maxLength) : input;
        return sanitize(truncated);
    }
}
