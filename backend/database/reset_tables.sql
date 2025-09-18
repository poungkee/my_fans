-- FANS 데이터베이스 테이블 리셋 스크립트
-- 주의: 개발 환경에서만 사용하세요! 운영 환경에서는 절대 사용하지 마십시오!
-- 이 스크립트는 모든 데이터를 삭제합니다.

-- 뷰 삭제
DROP VIEW IF EXISTS recent_news CASCADE;
DROP VIEW IF EXISTS storage_usage CASCADE;

-- 트리거 삭제
DROP TRIGGER IF EXISTS update_news_search_vector ON news_articles;
DROP TRIGGER IF EXISTS update_news_modified_time ON news_articles;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_search_vector() CASCADE;
DROP FUNCTION IF EXISTS update_modified_time() CASCADE;

-- 테이블 삭제 (외래키 관계 순서대로)
DROP TABLE IF EXISTS news_keywords CASCADE;
DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS news_articles CASCADE;
DROP TABLE IF EXISTS keywords CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 추가로 언급된 확장 테이블들도 삭제 (존재할 경우)
DROP TABLE IF EXISTS article_bias_scores CASCADE;
DROP TABLE IF EXISTS media_bias_scores CASCADE;
DROP TABLE IF EXISTS journalist_bias_scores CASCADE;
DROP TABLE IF EXISTS journalist_expertise CASCADE;
DROP TABLE IF EXISTS user_recommendations CASCADE;
DROP TABLE IF EXISTS user_reactions CASCADE;
DROP TABLE IF EXISTS journalists CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS media_sources CASCADE;

-- 시퀀스 리셋 (필요한 경우)
DROP SEQUENCE IF EXISTS news_articles_id_seq CASCADE;
DROP SEQUENCE IF EXISTS keywords_id_seq CASCADE;
DROP SEQUENCE IF EXISTS users_id_seq CASCADE;
DROP SEQUENCE IF EXISTS bookmarks_id_seq CASCADE;

COMMIT;