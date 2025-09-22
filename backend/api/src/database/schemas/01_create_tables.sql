-- ======================================================
-- FANS Database Schema Creation Script
-- ======================================================
-- Created: 2025-09-22
-- Purpose: Initialize FANS database with all required tables
-- ======================================================

-- 1. 카테고리 테이블
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. 소스 테이블
CREATE TABLE IF NOT EXISTS sources (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    url VARCHAR(500),
    logo_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    user_name VARCHAR(100),
    name VARCHAR(100),
    tel VARCHAR(20),
    phone VARCHAR(20),
    email_verified BOOLEAN DEFAULT FALSE,
    profile_image VARCHAR(500),
    active BOOLEAN DEFAULT TRUE,
    provider VARCHAR(20) DEFAULT 'local',
    social_token VARCHAR(500),
    previous_pw VARCHAR(255),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. 뉴스 기사 테이블
CREATE TABLE IF NOT EXISTS news_articles (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    ai_summary TEXT,
    url VARCHAR(1000) UNIQUE,
    image_url VARCHAR(1000),
    source_id BIGINT NOT NULL REFERENCES sources(id),
    category_id BIGINT NOT NULL REFERENCES categories(id),
    journalist VARCHAR(100),
    pub_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    search_vector TSVECTOR
);

-- 5. 키워드 테이블
CREATE TABLE IF NOT EXISTS keywords (
    id BIGSERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL UNIQUE,
    frequency INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. 뉴스-키워드 연결 테이블
CREATE TABLE IF NOT EXISTS news_keywords (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    relevance DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, keyword_id)
);

-- 7. 사용자 행동 테이블
CREATE TABLE IF NOT EXISTS user_actions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. 북마크 테이블
CREATE TABLE IF NOT EXISTS bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, article_id)
);

-- 9. 기사 통계 테이블
CREATE TABLE IF NOT EXISTS article_stats (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE UNIQUE,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. AI 추천 테이블
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    score DECIMAL(3,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. 편향 분석 테이블
CREATE TABLE IF NOT EXISTS bias_analysis (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    bias_score DECIMAL(3,2),
    political_leaning VARCHAR(50),
    confidence DECIMAL(3,2),
    analysis_data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. 사용자 선호도 테이블
CREATE TABLE IF NOT EXISTS user_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    preferred_categories JSONB,
    preferred_sources JSONB,
    notification_settings JSONB,
    reading_time_preference VARCHAR(20),
    language VARCHAR(10) DEFAULT 'ko',
    age INTEGER,
    gender VARCHAR(10),
    location VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================
-- 인덱스 생성
-- ======================================================

-- 뉴스 기사 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_news_articles_pub_date ON news_articles(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_source ON news_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_search_vector ON news_articles USING gin(search_vector);

-- 사용자 행동 분석을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_article_id ON user_actions(article_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC);

-- 북마크 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_article_id ON bookmarks(article_id);

-- AI 추천을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_score ON ai_recommendations(score DESC);

-- ======================================================
-- 트리거 생성 (updated_at 자동 업데이트)
-- ======================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 모든 테이블에 updated_at 트리거 적용
DO $$
DECLARE
    table_name text;
    table_names text[] := ARRAY[
        'categories', 'sources', 'users', 'news_articles', 'keywords',
        'user_actions', 'bookmarks', 'article_stats', 'ai_recommendations',
        'bias_analysis', 'user_preferences'
    ];
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_%s_updated_at ON %s;
            CREATE TRIGGER trigger_update_%s_updated_at
                BEFORE UPDATE ON %s
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', table_name, table_name, table_name, table_name);
    END LOOP;
END $$;

-- ======================================================
-- 검색 벡터 업데이트 트리거
-- ======================================================

CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('korean', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.ai_summary, ''));
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_search_vector ON news_articles;
CREATE TRIGGER trigger_update_search_vector
    BEFORE INSERT OR UPDATE ON news_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

-- 13. 시장 요약 테이블
CREATE TABLE IF NOT EXISTS market_summary (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    change DECIMAL(10,2) NOT NULL,
    change_percent DECIMAL(5,2) NOT NULL,
    market VARCHAR(50),
    currency VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_summary_symbol ON market_summary(symbol);
CREATE INDEX IF NOT EXISTS idx_market_summary_market ON market_summary(market);

COMMENT ON DATABASE fans_db IS 'FANS - Korean News Aggregation and Analysis Platform';