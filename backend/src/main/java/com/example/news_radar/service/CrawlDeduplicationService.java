package com.example.news_radar.service;

import com.example.news_radar.repository.CrawledUrlRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 글로벌 크롤링 중복 방지 서비스.
 *
 * 아키텍처 결정:
 *   키워드 A와 B에서 동일한 기사 URL이 발견될 때, 값비싼 본문 크롤링과 LLM 평가가
 *   중복 실행되는 것을 방지한다.
 *
 *   3계층 방어 전략:
 *   1. DB 계층 (CrawledUrl): 서버 재시작 이후에도 영구 보존되는 URL 히스토리.
 *      이전 수집 사이클에서 이미 처리된 URL을 걸러냄.
 *   2. 세션 계층 (ConcurrentHashMap): 현재 수집 사이클 내에서 여러 키워드가
 *      동시에 같은 URL을 발견했을 때 in-memory로 즉시 중복 차단.
 *      ConcurrentHashMap.add()의 원자적 연산으로 동시성 이슈 해결.
 *   3. DB Unique 제약 (CrawledUrl.url): 최종 안전장치. 레이스 컨디션으로
 *      1~2 계층을 통과한 극히 드문 경우에도 DB에서 차단.
 *
 *   Redis 대안:
 *     현재 시스템이 단일 인스턴스이므로 ConcurrentHashMap으로 충분.
 *     멀티 인스턴스 수평 확장 시 Redis SET(SADD + TTL)로 교체하면 됨.
 *     인터페이스가 동일하게 유지되도록 설계하여 교체 비용 최소화.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CrawlDeduplicationService {

    private final CrawledUrlRepository crawledUrlRepository;

    /**
     * 현재 수집 사이클의 in-flight URL 세트.
     * 수집 시작 시 초기화, 종료 시 클리어.
     */
    private final Set<String> inFlightUrls = ConcurrentHashMap.newKeySet();

    /**
     * 수집 사이클 시작 시 호출.
     * DB에서 전체 URL을 로드하여 in-flight 세트를 초기화한다.
     *
     * DB URL을 미리 로드하는 이유:
     *   키워드별로 매번 existsByUrl()를 호출하면 N×M회의 DB 쿼리가 발생.
     *   한 번에 전체 로드 후 메모리에서 O(1) 체크하는 것이 훨씬 효율적.
     */
    public void beginSession() {
        inFlightUrls.clear();
        Set<String> knownUrls = crawledUrlRepository.findAllUrls();
        inFlightUrls.addAll(knownUrls);
        log.info("[Dedup] 세션 시작. DB URL {}건 로드", knownUrls.size());
    }

    /**
     * 수집 사이클 종료 시 호출.
     * 메모리 해제.
     */
    public void endSession() {
        int sessionSize = inFlightUrls.size();
        inFlightUrls.clear();
        log.info("[Dedup] 세션 종료. 세션 내 URL 총 {}건 처리", sessionSize);
    }

    /**
     * URL 중복 여부를 원자적으로 체크하고, 신규 URL이면 예약(mark)한다.
     *
     * ConcurrentHashMap.add()는 내부적으로 putIfAbsent()를 사용하므로,
     * 여러 스레드가 동시에 같은 URL을 체크해도 정확히 하나만 true를 반환받음.
     *
     * @param url 체크할 기사 URL
     * @return true: 신규 URL (처리 가능), false: 이미 존재하는 URL (스킵)
     */
    public boolean tryReserve(String url) {
        if (url == null || url.isBlank()) return false;
        return inFlightUrls.add(url); // 원자적: 이미 존재하면 false 반환
    }

    /**
     * URL이 이미 처리되었는지(DB 또는 세션 내) 체크만 수행.
     * 예약(mark)하지 않으므로 읽기 전용 체크에 사용.
     */
    public boolean isKnown(String url) {
        return url != null && inFlightUrls.contains(url);
    }

    /**
     * 현재 세션에 로드된 URL Set을 반환 (크롤러의 Early Exit용).
     * 방어적 복사 없이 unmodifiable view를 반환하여 성능 유지.
     */
    public Set<String> getKnownUrls() {
        return java.util.Collections.unmodifiableSet(inFlightUrls);
    }
}
