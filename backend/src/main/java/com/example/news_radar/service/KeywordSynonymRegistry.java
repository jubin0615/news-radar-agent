package com.example.news_radar.service;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 키워드 동의어 사전.
 *
 * <p>정규화 키(공백 제거 + 소문자) → 대표 키워드 매핑과,
 * 대표 키워드 → 검색 변형어 목록을 관리한다.</p>
 *
 * <ul>
 *   <li>{@link #toCanonical(String)} — 입력 키워드를 대표 키워드로 변환</li>
 *   <li>{@link #getSearchVariants(String)} — 대표 키워드에 대한 모든 검색 변형어 반환</li>
 * </ul>
 */
@Component
public class KeywordSynonymRegistry {

    /** 정규화 키 → 대표 키워드 */
    private final Map<String, String> synonymToCanonical;

    /** 대표 키워드 → 검색용 변형어 목록 (원본 표기 보존) */
    private final Map<String, List<String>> canonicalToVariants;

    public KeywordSynonymRegistry() {
        Map<String, String> syn = new LinkedHashMap<>();
        Map<String, List<String>> var = new LinkedHashMap<>();

        // ── 동의어 그룹 등록 ──────────────────────────────────
        registerGroup(syn, var, "openai",
                "오픈ai", "오픈에이아이", "오픈 ai", "open ai");

        registerGroup(syn, var, "chatgpt",
                "챗gpt", "챗지피티", "chat gpt", "챗 gpt");

        registerGroup(syn, var, "deepseek",
                "딥시크", "딥 시크", "deep seek");

        registerGroup(syn, var, "nvidia",
                "엔비디아");

        registerGroup(syn, var, "tesla",
                "테슬라");

        registerGroup(syn, var, "anthropic",
                "앤트로픽", "앤쓰로픽", "앤쏘로픽");

        registerGroup(syn, var, "google",
                "구글");

        registerGroup(syn, var, "microsoft",
                "마이크로소프트", "ms");

        registerGroup(syn, var, "apple",
                "애플");

        registerGroup(syn, var, "samsung",
                "삼성", "삼성전자");

        registerGroup(syn, var, "meta",
                "메타");

        // ── 불변 Map으로 전환 ─────────────────────────────────
        this.synonymToCanonical = Collections.unmodifiableMap(syn);
        this.canonicalToVariants = Collections.unmodifiableMap(var);
    }

    /**
     * 입력 키워드를 대표 키워드(canonical)로 변환한다.
     * 동의어 사전에 없으면 정규화된 원본을 그대로 반환한다.
     *
     * @param raw 사용자 입력 키워드 (null 허용)
     * @return 대표 키워드 (소문자, 공백 제거)
     */
    public String toCanonical(String raw) {
        String normalized = normalize(raw);
        return synonymToCanonical.getOrDefault(normalized, normalized);
    }

    /**
     * 대표 키워드에 대한 네이버 검색용 변형어 목록을 반환한다.
     * 동의어가 등록되어 있지 않으면 대표 키워드만 담긴 단일 리스트를 반환한다.
     *
     * @param canonical 대표 키워드
     * @return 변형어 리스트 (대표 키워드 포함)
     */
    public List<String> getSearchVariants(String canonical) {
        return canonicalToVariants.getOrDefault(canonical, List.of(canonical));
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────

    /** 공백 제거 + 소문자 변환 */
    private static String normalize(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("\\s+", "").toLowerCase();
    }

    /**
     * 동의어 그룹을 등록한다.
     *
     * @param syn      정규화 키 → canonical 맵 (쓰기용)
     * @param var      canonical → variants 맵 (쓰기용)
     * @param canonical 대표 키워드 (이미 정규화 상태여야 함)
     * @param synonyms  변형/한글 동의어들 (원본 표기)
     */
    private static void registerGroup(Map<String, String> syn,
                                      Map<String, List<String>> var,
                                      String canonical,
                                      String... synonyms) {
        // canonical 자체도 자기 자신으로 매핑
        syn.put(canonical, canonical);

        List<String> variants = new ArrayList<>();
        variants.add(canonical); // 대표 키워드를 첫 번째로

        for (String s : synonyms) {
            String key = normalize(s);
            syn.put(key, canonical);
            variants.add(s); // 원본 표기 보존 (네이버 검색용)
        }

        var.put(canonical, Collections.unmodifiableList(variants));
    }
}
