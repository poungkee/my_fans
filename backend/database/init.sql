-- ================================
-- FANS 데이터베이스 테이블 생성 스크립트
-- PostgreSQL 기준
-- ================================

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 기존 테이블 삭제 (개발 환경용)
-- 주의: 운영 환경에서는 사용하지 마세요!
/*
DROP TABLE IF EXISTS news_keywords CASCADE;
DROP TABLE IF EXISTS article_bias_scores CASCADE;
DROP TABLE IF EXISTS media_bias_scores CASCADE;
DROP TABLE IF EXISTS journalist_bias_scores CASCADE;
DROP TABLE IF EXISTS journalist_expertise CASCADE;
DROP TABLE IF EXISTS user_recommendations CASCADE;
DROP TABLE IF EXISTS user_reactions CASCADE;
DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS news_articles CASCADE;
DROP TABLE IF EXISTS journalists CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS keywords CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS media_sources CASCADE;
DROP TABLE IF EXISTS users CASCADE;
*/

-- ================================
-- 1. 핵심 마스터 테이블 생성
-- ================================

-- 사용자 테이블
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    profile_image VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    provider VARCHAR(20) DEFAULT 'local',
    social_token VARCHAR(500),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 카테고리 테이블 (자기참조)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color_code VARCHAR(7),
    icon VARCHAR(50),
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_specialized BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 언론사 테이블
CREATE TABLE media_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(200) NOT NULL UNIQUE,
    logo_url VARCHAR(500),
    founded_year INTEGER,
    headquarters VARCHAR(100),
    description TEXT,
    credibility_score DECIMAL(3,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 키워드 테이블
CREATE TABLE keywords (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL UNIQUE,
    frequency INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 2. 사용자 관련 테이블
-- ================================

-- 사용자 선호도 테이블 (1:1 관계)
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER,
    gender VARCHAR(10),
    location VARCHAR(100),
    preferred_categories JSON,
    preferred_media_sources JSON,
    reading_time_preference VARCHAR(20),
    summary_length_preference VARCHAR(20),
    political_inclination VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 3. 뉴스 관련 테이블
-- ================================

-- 기자 테이블
CREATE TABLE journalists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    media_source_id INTEGER NOT NULL REFERENCES media_sources(id) ON DELETE CASCADE,
    department VARCHAR(50),
    position VARCHAR(50),
    career_years INTEGER,
    article_count INTEGER DEFAULT 0,
    avg_article_rating DECIMAL(3,2),
    credibility_score DECIMAL(3,2),
    profile_image VARCHAR(500),
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 뉴스 기사 테이블 (메인 테이블)
CREATE TABLE news_articles (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    summary TEXT,
    ai_summary TEXT,
    short_ai_summary VARCHAR(100),
    url VARCHAR(1000) UNIQUE,
    origin_url VARCHAR(1000),
    image_url VARCHAR(1000),
    video_url VARCHAR(1000),
    media_source_id INTEGER NOT NULL REFERENCES media_sources(id) ON DELETE RESTRICT,
    journalist_id INTEGER REFERENCES journalists(id) ON DELETE SET NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    pub_date TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    dislike_count INTEGER DEFAULT 0,
    scrap_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    importance_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 4. 사용자 행동 추적 테이블
-- ================================

-- 사용자 반응 테이블 (AI 학습용)
CREATE TABLE user_reactions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    news_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL,
    reading_duration INTEGER, -- 읽은 시간(초)
    reading_percentage INTEGER, -- 읽은 비율(%)
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 복합 유니크 제약조건: 동일한 사용자가 같은 기사에 같은 반응은 한 번만
    CONSTRAINT uk_user_news_reaction UNIQUE (user_id, news_id, reaction_type)
);

-- 사용자 추천 테이블 (AI 추천 시스템)
CREATE TABLE user_recommendations (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    news_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    recommendation_score DECIMAL(4,2),
    recommendation_reason JSON,
    model_version VARCHAR(20),
    was_clicked BOOLEAN DEFAULT false,
    was_read BOOLEAN DEFAULT false,
    feedback_score INTEGER, -- -1, 0, 1
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 북마크 테이블 (기존 호환성)
CREATE TABLE bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    news_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 복합 유니크 제약조건: 동일한 사용자가 같은 기사를 중복 북마크 불가
    CONSTRAINT uk_user_bookmark UNIQUE (user_id, news_id)
);

-- ================================
-- 5. 다대다 관계 테이블
-- ================================

-- 뉴스-키워드 관계 테이블
CREATE TABLE news_keywords (
    news_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    relevance DOUBLE PRECISION DEFAULT 1.0,

    -- 복합 기본키
    PRIMARY KEY (news_id, keyword_id)
);

-- ================================
-- 6. 분석 테이블들
-- ================================

-- 기자 전문성 테이블
CREATE TABLE journalist_expertise (
    id SERIAL PRIMARY KEY,
    journalist_id INTEGER NOT NULL REFERENCES journalists(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    expertise_score DECIMAL(3,2), -- 0.00 ~ 10.00
    article_count INTEGER DEFAULT 0,
    avg_rating DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 복합 유니크 제약조건: 기자별 카테고리당 하나의 전문성 점수
    CONSTRAINT uk_journalist_category UNIQUE (journalist_id, category_id)
);

-- 기자 편향성 점수 테이블
CREATE TABLE journalist_bias_scores (
    id SERIAL PRIMARY KEY,
    journalist_id INTEGER NOT NULL REFERENCES journalists(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    bias_type VARCHAR(20) NOT NULL, -- 'political', 'economic', 'social'
    bias_score DECIMAL(4,2), -- -10.00 ~ +10.00
    confidence_level DECIMAL(3,2), -- 0.00 ~ 1.00
    sample_size INTEGER,
    last_calculated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 복합 유니크 제약조건
    CONSTRAINT uk_journalist_category_bias UNIQUE (journalist_id, category_id, bias_type)
);

-- 언론사 편향성 점수 테이블
CREATE TABLE media_bias_scores (
    id SERIAL PRIMARY KEY,
    media_source_id INTEGER NOT NULL REFERENCES media_sources(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    bias_type VARCHAR(20) NOT NULL, -- 'political', 'economic', 'social'
    bias_score DECIMAL(4,2), -- -10.00 ~ +10.00
    confidence_level DECIMAL(3,2), -- 0.00 ~ 1.00
    sample_size INTEGER,
    last_calculated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 복합 유니크 제약조건
    CONSTRAINT uk_media_category_bias UNIQUE (media_source_id, category_id, bias_type)
);

-- 기사별 편향성 점수 테이블
CREATE TABLE article_bias_scores (
    id BIGSERIAL PRIMARY KEY,
    news_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    bias_type VARCHAR(20) NOT NULL, -- 'political', 'economic', 'social'
    bias_score DECIMAL(4,2), -- -10.00 ~ +10.00
    confidence_level DECIMAL(3,2), -- 0.00 ~ 1.00
    analysis_method VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 복합 유니크 제약조건: 기사당 편향 유형별로 하나씩
    CONSTRAINT uk_article_bias_type UNIQUE (news_id, bias_type)
);

-- ================================
-- 인덱스 생성
-- ================================

-- 사용자 테이블 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_provider ON users(provider);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 카테고리 인덱스
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active);

-- 언론사 인덱스
CREATE INDEX idx_media_sources_domain ON media_sources(domain);
CREATE INDEX idx_media_sources_active ON media_sources(is_active);

-- 뉴스 기사 인덱스
CREATE INDEX idx_news_articles_media_source_id ON news_articles(media_source_id);
CREATE INDEX idx_news_articles_journalist_id ON news_articles(journalist_id);
CREATE INDEX idx_news_articles_category_id ON news_articles(category_id);
CREATE INDEX idx_news_articles_pub_date ON news_articles(pub_date);
CREATE INDEX idx_news_articles_created_at ON news_articles(created_at);
CREATE INDEX idx_news_articles_title ON news_articles USING gin(to_tsvector('english', title));
CREATE INDEX idx_news_articles_content ON news_articles USING gin(to_tsvector('english', content));

-- 기자 인덱스
CREATE INDEX idx_journalists_media_source_id ON journalists(media_source_id);
CREATE INDEX idx_journalists_name ON journalists(name);

-- 사용자 반응 인덱스
CREATE INDEX idx_user_reactions_user_id ON user_reactions(user_id);
CREATE INDEX idx_user_reactions_news_id ON user_reactions(news_id);
CREATE INDEX idx_user_reactions_type ON user_reactions(reaction_type);
CREATE INDEX idx_user_reactions_created_at ON user_reactions(created_at);

-- 추천 시스템 인덱스
CREATE INDEX idx_user_recommendations_user_id ON user_recommendations(user_id);
CREATE INDEX idx_user_recommendations_news_id ON user_recommendations(news_id);
CREATE INDEX idx_user_recommendations_clicked ON user_recommendations(was_clicked);
CREATE INDEX idx_user_recommendations_created_at ON user_recommendations(created_at);

-- 북마크 인덱스
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_news_id ON bookmarks(news_id);

-- 키워드 인덱스
CREATE INDEX idx_keywords_keyword ON keywords(keyword);
CREATE INDEX idx_keywords_frequency ON keywords(frequency);

-- 분석 테이블 인덱스
CREATE INDEX idx_journalist_expertise_journalist_id ON journalist_expertise(journalist_id);
CREATE INDEX idx_journalist_expertise_category_id ON journalist_expertise(category_id);
CREATE INDEX idx_journalist_expertise_score ON journalist_expertise(expertise_score);

CREATE INDEX idx_journalist_bias_journalist_id ON journalist_bias_scores(journalist_id);
CREATE INDEX idx_journalist_bias_category_id ON journalist_bias_scores(category_id);
CREATE INDEX idx_journalist_bias_type ON journalist_bias_scores(bias_type);

CREATE INDEX idx_media_bias_media_id ON media_bias_scores(media_source_id);
CREATE INDEX idx_media_bias_category_id ON media_bias_scores(category_id);
CREATE INDEX idx_media_bias_type ON media_bias_scores(bias_type);

CREATE INDEX idx_article_bias_news_id ON article_bias_scores(news_id);
CREATE INDEX idx_article_bias_type ON article_bias_scores(bias_type);

-- ================================
-- 트리거 및 함수 생성
-- ================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_sources_updated_at BEFORE UPDATE ON media_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journalists_updated_at BEFORE UPDATE ON journalists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_articles_updated_at BEFORE UPDATE ON news_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journalist_expertise_updated_at BEFORE UPDATE ON journalist_expertise
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journalist_bias_updated_at BEFORE UPDATE ON journalist_bias_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_bias_updated_at BEFORE UPDATE ON media_bias_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- 체크 제약조건
-- ================================

-- 점수 범위 제약조건
ALTER TABLE journalist_expertise ADD CONSTRAINT chk_expertise_score
    CHECK (expertise_score >= 0.00 AND expertise_score <= 10.00);

ALTER TABLE journalist_bias_scores ADD CONSTRAINT chk_journalist_bias_score
    CHECK (bias_score >= -10.00 AND bias_score <= 10.00);

ALTER TABLE media_bias_scores ADD CONSTRAINT chk_media_bias_score
    CHECK (bias_score >= -10.00 AND bias_score <= 10.00);

ALTER TABLE article_bias_scores ADD CONSTRAINT chk_article_bias_score
    CHECK (bias_score >= -10.00 AND bias_score <= 10.00);

ALTER TABLE journalist_bias_scores ADD CONSTRAINT chk_journalist_confidence
    CHECK (confidence_level >= 0.00 AND confidence_level <= 1.00);

ALTER TABLE media_bias_scores ADD CONSTRAINT chk_media_confidence
    CHECK (confidence_level >= 0.00 AND confidence_level <= 1.00);

ALTER TABLE article_bias_scores ADD CONSTRAINT chk_article_confidence
    CHECK (confidence_level >= 0.00 AND confidence_level <= 1.00);

-- 반응 타입 제약조건
ALTER TABLE user_reactions ADD CONSTRAINT chk_reaction_type
    CHECK (reaction_type IN ('view', 'like', 'dislike', 'scrap', 'share', 'comment'));

-- 편향 타입 제약조건
ALTER TABLE journalist_bias_scores ADD CONSTRAINT chk_journalist_bias_type
    CHECK (bias_type IN ('political', 'economic', 'social'));

ALTER TABLE media_bias_scores ADD CONSTRAINT chk_media_bias_type
    CHECK (bias_type IN ('political', 'economic', 'social'));

ALTER TABLE article_bias_scores ADD CONSTRAINT chk_article_bias_type
    CHECK (bias_type IN ('political', 'economic', 'social'));

-- 피드백 점수 제약조건
ALTER TABLE user_recommendations ADD CONSTRAINT chk_feedback_score
    CHECK (feedback_score IN (-1, 0, 1));

-- 읽기 비율 제약조건
ALTER TABLE user_reactions ADD CONSTRAINT chk_reading_percentage
    CHECK (reading_percentage >= 0 AND reading_percentage <= 100);

-- ================================
-- 코멘트 추가
-- ================================

COMMENT ON TABLE users IS '사용자 기본 정보 테이블';
COMMENT ON TABLE categories IS '뉴스 카테고리 테이블 (계층구조 지원)';
COMMENT ON TABLE media_sources IS '언론사 정보 테이블';
COMMENT ON TABLE user_preferences IS '사용자 선호도 및 개인화 설정';
COMMENT ON TABLE journalists IS '기자 정보 테이블';
COMMENT ON TABLE news_articles IS '뉴스 기사 메인 테이블';
COMMENT ON TABLE user_reactions IS '사용자 행동 추적 (AI 학습용)';
COMMENT ON TABLE user_recommendations IS 'AI 추천 시스템 로그';
COMMENT ON TABLE journalist_expertise IS '기자별 전문 분야 점수';
COMMENT ON TABLE journalist_bias_scores IS '기자별 편향성 분석';
COMMENT ON TABLE media_bias_scores IS '언론사별 편향성 분석';
COMMENT ON TABLE article_bias_scores IS '개별 기사 편향성 분석';

-- ================================
-- 기본 데이터 삽입
-- ================================

-- 카테고리 기본 데이터
INSERT INTO categories (id, name, slug, description, color_code, icon, created_at) VALUES
(1, '정치', 'politics', '정치 관련 뉴스', '#FF6B6B', 'politics', NOW()),
(2, '경제', 'economy', '경제 관련 뉴스', '#4ECDC4', 'economy', NOW()),
(3, '사회', 'society', '사회 관련 뉴스', '#45B7D1', 'society', NOW()),
(4, '연예', 'entertainment', '연예 관련 뉴스', '#FF9FF3', 'entertainment', NOW()),
(5, '생활/문화', 'culture', '생활 및 문화 관련 뉴스', '#FECA57', 'culture', NOW()),
(6, 'IT/과학', 'tech', 'IT 및 과학 관련 뉴스', '#5F27CD', 'tech', NOW()),
(7, '세계', 'international', '세계 관련 뉴스', '#96CEB4', 'international', NOW()),
(8, '스포츠', 'sports', '스포츠 관련 뉴스', '#54A0FF', 'sports', NOW());

-- 미디어 소스 기본 데이터
INSERT INTO media_sources (id, name, domain, logo_url, description, created_at, updated_at) VALUES
(1, '네이버뉴스', 'news.naver.com', NULL, '네이버 뉴스 플랫폼', NOW(), NOW()),
(2, '조선일보', 'chosun.com', NULL, '조선일보', NOW(), NOW()),
(3, '중앙일보', 'joongang.co.kr', NULL, '중앙일보', NOW(), NOW()),
(4, '동아일보', 'donga.com', NULL, '동아일보', NOW(), NOW()),
(5, '한겨레', 'hani.co.kr', NULL, '한겨레신문', NOW(), NOW()),
(6, '경향신문', 'khan.co.kr', NULL, '경향신문', NOW(), NOW()),
(7, 'KBS', 'news.kbs.co.kr', NULL, 'KBS 뉴스', NOW(), NOW()),
(8, 'MBC', 'imnews.imbc.com', NULL, 'MBC 뉴스', NOW(), NOW()),
(9, 'SBS', 'news.sbs.co.kr', NULL, 'SBS 뉴스', NOW(), NOW()),
(10, 'YTN', 'ytn.co.kr', NULL, 'YTN 뉴스', NOW(), NOW());

-- 스크립트 실행 완료 메시지
SELECT 'FANS 데이터베이스 테이블 생성 및 기본 데이터 삽입이 완료되었습니다!' AS message;