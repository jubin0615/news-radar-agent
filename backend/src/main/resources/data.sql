-- 기본 키워드 시드 데이터는 온보딩 화면(POST /api/system/initialize)에서 사용자가 직접 등록합니다.

-- News → CrawledUrl 초기 마이그레이션 (기존 URL 히스토리를 경량 테이블로 복사)
-- MERGE INTO ... KEY(URL)로 멱등성 보장 — 매 서버 기동 시 재실행해도 중복 삽입 없음
MERGE INTO CRAWLED_URL (URL, CREATED_AT) KEY(URL)
SELECT N.URL, COALESCE(N.COLLECTED_AT, CURRENT_TIMESTAMP)
FROM NEWS N
WHERE N.URL IS NOT NULL;
ON CONFLICT (url) DO NOTHING;

-- ========================================
-- Multi-user migration: 시스템 사용자 시드
-- ========================================

-- 시스템 사용자 삽입 (멱등: 이미 존재하면 무시)
MERGE INTO APP_USER (ID, EMAIL, NAME, PROVIDER, ROLE, CREATED_AT) KEY(EMAIL)
VALUES (1, 'system@newsradar.local', 'System', 'LOCAL', 'ADMIN', CURRENT_TIMESTAMP);

-- 기존 키워드 중 user_id가 NULL인 것을 시스템 사용자에 할당
UPDATE KEYWORD SET USER_ID = 1 WHERE USER_ID IS NULL;
