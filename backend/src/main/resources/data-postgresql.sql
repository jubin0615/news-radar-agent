-- 기본 키워드 시드 데이터는 온보딩 화면(POST /api/system/initialize)에서 사용자가 직접 등록합니다.
-- 이 파일은 PostgreSQL (pgvector 프로필) 전용입니다. H2는 data.sql을 사용합니다.

-- News → CrawledUrl 초기 마이그레이션 (기존 URL 히스토리를 경량 테이블로 복사)
INSERT INTO crawled_url (url, created_at)
SELECT n.url, COALESCE(n.collected_at, CURRENT_TIMESTAMP)
FROM news n
WHERE n.url IS NOT NULL
ON CONFLICT (url) DO NOTHING;

-- ========================================
-- Multi-user migration: 시스템 사용자 시드
-- ========================================

-- 시스템 사용자 삽입 (멱등: 이미 존재하면 무시)
INSERT INTO app_user (id, email, name, provider, role, created_at)
VALUES (1, 'system@newsradar.local', 'System', 'LOCAL', 'ADMIN', CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;

-- 기존 키워드 중 user_id가 NULL인 것을 시스템 사용자에 할당
UPDATE keyword SET user_id = 1 WHERE user_id IS NULL;

-- ========================================
-- Multi-user migration: 키워드 유니크 제약 변경
-- name 단독 유니크 → (name, user_id) 복합 유니크
-- 여러 사용자가 같은 키워드를 등록할 수 있도록 허용
-- ========================================
DO $$
DECLARE
    r RECORD;
BEGIN
    -- keyword 테이블의 name 컬럼만 포함하는 단독 유니크 제약 모두 제거
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'keyword'::regclass
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND a.attname = 'name'
    LOOP
        EXECUTE 'ALTER TABLE keyword DROP CONSTRAINT ' || r.conname;
    END LOOP;
END $$;
