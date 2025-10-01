-- ================================
-- FANS 프로젝트 데이터베이스 구조 (개선 버전)
-- PostgreSQL 15+ 권장
-- 최종 수정: 2025-09-20
-- ================================

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 텍스트 검색용

-- 기존 테이블 삭제 (개발 환경용)
DROP TABLE IF EXISTS news_keywords CASCADE;
DROP TABLE IF EXISTS bias_analysis CASCADE;
DROP TABLE IF EXISTS ai_recommendations CASCADE;
DROP TABLE IF EXISTS article_stats CASCADE;
DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS user_actions CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS news_articles CASCADE;
DROP TABLE IF EXISTS keywords CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS sources CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS market_summary CASCADE;

-- ================================
-- 1. 기본 마스터 테이블
-- ================================

-- 사용자 테이블
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    user_name VARCHAR(100),
    tel VARCHAR(20),
    profile_image VARCHAR(500),
    active BOOLEAN DEFAULT true,
    provider VARCHAR(20) DEFAULT 'local', -- local/kakao/naver
    social_token VARCHAR(500),
    previous_pw VARCHAR(255),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 언론사 마스터 (OID 기반 14개 타겟 언론사)
CREATE TABLE sources (
    id INTEGER PRIMARY KEY, -- OID를 직접 사용
    name VARCHAR(100) NOT NULL UNIQUE,
    logo_url VARCHAR(500)
);

-- 카테고리 마스터 (간소화)
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- 키워드 마스터
CREATE TABLE keywords (
    id BIGSERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL UNIQUE,
    frequency INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 2. 뉴스 관련 테이블
-- ================================

-- 뉴스 기사 메인 테이블 (간소화)
CREATE TABLE news_articles (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    ai_summary TEXT, -- AI 요약만 저장
    url VARCHAR(1000) UNIQUE,
    image_url VARCHAR(1000),

    -- 정규화된 FK
    source_id INTEGER REFERENCES sources(id) ON UPDATE CASCADE,
    category_id BIGINT REFERENCES categories(id) ON UPDATE CASCADE,

    -- 기자 정보
    journalist VARCHAR(100),

    -- 시간 정보
    pub_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 전문 검색용 벡터
    search_vector tsvector
);

-- 뉴스-키워드 관계
CREATE TABLE news_keywords (
    news_id BIGINT REFERENCES news_articles(id) ON DELETE CASCADE,
    keyword_id BIGINT REFERENCES keywords(id) ON DELETE CASCADE,
    relevance DOUBLE PRECISION DEFAULT 1.0,
    PRIMARY KEY (news_id, keyword_id)
);

-- ================================
-- 3. 사용자 활동 관련
-- ================================

-- 통합 사용자 행동 로그 (AI 추천용)
CREATE TABLE user_actions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    article_id BIGINT REFERENCES news_articles(id) ON DELETE CASCADE,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('VIEW', 'LIKE', 'DISLIKE', 'BOOKMARK')),
    reading_duration INTEGER, -- 읽은 시간(초)
    reading_percentage INTEGER CHECK (reading_percentage >= 0 AND reading_percentage <= 100), -- 읽은 비율(%)
    weight DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 중복 방지 (VIEW는 여러 번 가능하므로 제외)
    CONSTRAINT uk_user_article_action UNIQUE (user_id, article_id, action_type)
);

-- 북마크 (호환성 유지)
CREATE TABLE bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    news_id BIGINT REFERENCES news_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uk_user_bookmark UNIQUE (user_id, news_id)
);

-- 댓글
CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    article_id BIGINT REFERENCES news_articles(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 4. 통계 및 집계 (성능 최적화)
-- ================================

-- 기사 통계 (카운터 분리)
CREATE TABLE article_stats (
    article_id BIGINT PRIMARY KEY REFERENCES news_articles(id) ON DELETE CASCADE,
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    dislike_count BIGINT DEFAULT 0,
    bookmark_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 5. AI 분석 관련
-- ================================

-- AI 추천 시스템
CREATE TABLE ai_recommendations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    article_id BIGINT REFERENCES news_articles(id) ON DELETE CASCADE,
    recommendation_score DECIMAL(4,2) CHECK (recommendation_score >= 0 AND recommendation_score <= 99.99),
    recommendation_reason JSONB, -- {"category_match": 0.8, "keyword_match": 0.6}
    model_version VARCHAR(20),
    was_clicked BOOLEAN DEFAULT false,
    was_read BOOLEAN DEFAULT false,
    feedback_score INTEGER CHECK (feedback_score IN (-1, 0, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 사용자별 기사당 최신 추천만 유지
    CONSTRAINT uk_user_article_recommendation UNIQUE (user_id, article_id)
);

-- 편향성 분석 (통합)
CREATE TABLE bias_analysis (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,

    -- 편향성 분석 데이터 (AI 자동 분석)
    bias_score NUMERIC(3,2),
    political_leaning VARCHAR(50),
    confidence NUMERIC(3,2),

    -- 전체 분석 데이터 (JSON)
    analysis_data JSONB,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 사용자 선호도 (AI 학습용)
CREATE TABLE user_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_categories JSONB, -- {"정치": 0.8, "경제": 0.6}
    preferred_keywords JSONB,    -- {"AI": 0.9, "블록체인": 0.7}
    preferred_sources JSONB,     -- {"조선일보": 0.3, "한겨레": 0.8}

    -- 선택적 인구통계
    age INTEGER CHECK (age >= 0 AND age <= 150),
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other', 'unknown')),
    location VARCHAR(100),

    -- 읽기 패턴
    avg_reading_time INTEGER,
    preferred_time_slots JSONB, -- {"morning": 0.8, "evening": 0.6}

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 6. 인덱스 생성
-- ================================

-- 사용자 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);
CREATE INDEX idx_users_provider ON users(provider);

-- 뉴스 인덱스
CREATE INDEX idx_news_source_id ON news_articles(source_id);
CREATE INDEX idx_news_category_id ON news_articles(category_id);
CREATE INDEX idx_news_pub_date ON news_articles(pub_date DESC);
CREATE INDEX idx_news_created_at ON news_articles(created_at DESC);
CREATE INDEX idx_news_search_vector ON news_articles USING GIN(search_vector);
CREATE INDEX idx_news_journalist ON news_articles(journalist) WHERE journalist IS NOT NULL;

-- 사용자 행동 인덱스
CREATE INDEX idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX idx_user_actions_article_id ON user_actions(article_id);
CREATE INDEX idx_user_actions_type ON user_actions(action_type);
CREATE INDEX idx_user_actions_created ON user_actions(created_at DESC);
CREATE INDEX idx_user_actions_user_time ON user_actions(user_id, created_at DESC);

-- AI 추천 인덱스
CREATE INDEX idx_recommendations_user ON ai_recommendations(user_id);
CREATE INDEX idx_recommendations_clicked ON ai_recommendations(was_clicked) WHERE was_clicked = true;
CREATE INDEX idx_recommendations_created ON ai_recommendations(created_at DESC);

-- 편향성 분석 인덱스
CREATE INDEX idx_bias_article ON bias_analysis(article_id);

-- 키워드 인덱스
CREATE INDEX idx_keywords_frequency ON keywords(frequency DESC);

-- 북마크 인덱스
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_news ON bookmarks(news_id);

-- comments 인덱스
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_article ON comments(article_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_created ON comments(created_at DESC);

-- ================================
-- 7. 트리거 및 함수
-- ================================

-- updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_news_updated
    BEFORE UPDATE ON news_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_stats_updated
    BEFORE UPDATE ON article_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_preferences_updated
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- search_vector 자동 업데이트 (한글 지원)
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.ai_summary, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.content, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_search_vector
    BEFORE INSERT OR UPDATE OF title, ai_summary, content ON news_articles
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- article_stats 자동 업데이트 (user_actions 기반)
CREATE OR REPLACE FUNCTION update_article_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- article_stats 레코드가 없으면 생성
        INSERT INTO article_stats (article_id)
        VALUES (NEW.article_id)
        ON CONFLICT (article_id) DO NOTHING;

        -- action_type에 따라 카운트 업데이트
        UPDATE article_stats
        SET
            view_count = CASE
                WHEN NEW.action_type = 'VIEW' THEN view_count + 1
                ELSE view_count
            END,
            like_count = CASE
                WHEN NEW.action_type = 'LIKE' THEN like_count + 1
                ELSE like_count
            END,
            dislike_count = CASE
                WHEN NEW.action_type = 'DISLIKE' THEN dislike_count + 1
                ELSE dislike_count
            END,
            bookmark_count = CASE
                WHEN NEW.action_type = 'BOOKMARK' THEN bookmark_count + 1
                ELSE bookmark_count
            END,
            updated_at = NOW()
        WHERE article_id = NEW.article_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE article_stats
        SET
            like_count = CASE
                WHEN OLD.action_type = 'LIKE' THEN GREATEST(like_count - 1, 0)
                ELSE like_count
            END,
            dislike_count = CASE
                WHEN OLD.action_type = 'DISLIKE' THEN GREATEST(dislike_count - 1, 0)
                ELSE dislike_count
            END,
            bookmark_count = CASE
                WHEN OLD.action_type = 'BOOKMARK' THEN GREATEST(bookmark_count - 1, 0)
                ELSE bookmark_count
            END,
            updated_at = NOW()
        WHERE article_id = OLD.article_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stats_from_actions
    AFTER INSERT OR DELETE ON user_actions
    FOR EACH ROW EXECUTE FUNCTION update_article_stats();

-- 북마크 테이블과 user_actions 동기화
CREATE OR REPLACE FUNCTION sync_bookmark_action()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- 북마크 추가 시 user_actions에도 추가
        INSERT INTO user_actions (user_id, article_id, action_type)
        VALUES (NEW.user_id, NEW.news_id, 'BOOKMARK')
        ON CONFLICT (user_id, article_id, action_type) DO NOTHING;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- 북마크 삭제 시 user_actions에서도 삭제
        DELETE FROM user_actions
        WHERE user_id = OLD.user_id
        AND article_id = OLD.news_id
        AND action_type = 'BOOKMARK';
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bookmark_sync
    AFTER INSERT OR DELETE ON bookmarks
    FOR EACH ROW EXECUTE FUNCTION sync_bookmark_action();

-- ================================
-- 8. 증시 데이터 테이블
-- ================================

-- 증시 요약 정보 테이블
CREATE TABLE market_summary (
    id BIGSERIAL PRIMARY KEY,
    market_type VARCHAR(50) NOT NULL, -- 지수/환율/상품 등
    name VARCHAR(100) NOT NULL,       -- KOSPI, KOSDAQ, USD/KRW 등
    current_value DECIMAL(12,2),      -- 현재값
    change_value DECIMAL(10,2),       -- 변동값
    change_percent DECIMAL(5,2),      -- 변동률(%)
    volume BIGINT,                    -- 거래량
    trading_value DECIMAL(15,2),      -- 거래대금
    high_value DECIMAL(12,2),         -- 고가
    low_value DECIMAL(12,2),          -- 저가
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(market_type, name)
);

-- 증시 데이터 인덱스
CREATE INDEX idx_market_summary_type ON market_summary(market_type);
CREATE INDEX idx_market_summary_updated ON market_summary(updated_at DESC);

-- ================================
-- 9. 뷰 생성 (편의성)
-- ================================

-- 뉴스 상세 뷰 (조인 간소화)
CREATE VIEW v_news_detail AS
SELECT
    n.id,
    n.title,
    n.content,
    n.ai_summary,
    n.url,
    n.image_url,
    n.journalist,
    n.pub_date,
    n.created_at,
    s.name as source_name,
    c.name as category_name,
    COALESCE(st.view_count, 0) as view_count,
    COALESCE(st.like_count, 0) as like_count,
    COALESCE(st.dislike_count, 0) as dislike_count,
    COALESCE(st.bookmark_count, 0) as bookmark_count
FROM news_articles n
LEFT JOIN sources s ON n.source_id = s.id
LEFT JOIN categories c ON n.category_id = c.id
LEFT JOIN article_stats st ON n.id = st.article_id;

-- 인기 뉴스 뷰 (7일 기준)
CREATE VIEW v_trending_news AS
SELECT
    n.id,
    n.title,
    LEFT(n.ai_summary, 100) as short_summary,
    n.image_url,
    n.pub_date,
    s.name as source_name,
    c.name as category_name,
    COALESCE(st.view_count, 0) as view_count,
    COALESCE(st.like_count, 0) as like_count,
    (COALESCE(st.like_count, 0) * 0.7 + COALESCE(st.bookmark_count, 0) * 0.3) as popularity_score
FROM news_articles n
LEFT JOIN sources s ON n.source_id = s.id
LEFT JOIN categories c ON n.category_id = c.id
LEFT JOIN article_stats st ON n.id = st.article_id
WHERE n.pub_date > NOW() - INTERVAL '7 days'
ORDER BY popularity_score DESC
LIMIT 100;

-- 사용자 활동 요약 뷰
CREATE VIEW v_user_activity_summary AS
SELECT
    u.id as user_id,
    u.username,
    COUNT(DISTINCT CASE WHEN ua.action_type = 'VIEW' THEN ua.article_id END) as viewed_articles,
    COUNT(DISTINCT CASE WHEN ua.action_type = 'LIKE' THEN ua.article_id END) as liked_articles,
    COUNT(DISTINCT CASE WHEN ua.action_type = 'BOOKMARK' THEN ua.article_id END) as bookmarked_articles,
    AVG(ua.reading_duration) as avg_reading_duration,
    MAX(ua.created_at) as last_activity
FROM users u
LEFT JOIN user_actions ua ON u.id = ua.user_id
GROUP BY u.id, u.username;

-- ================================
-- 9. 초기 데이터 (선택)
-- ================================

-- 기본 카테고리
INSERT INTO categories (name) VALUES
    ('정치'), ('경제'), ('사회'), ('생활/문화'),
    ('IT/과학'), ('세계'), ('스포츠'), ('연예')
ON CONFLICT (name) DO NOTHING;

-- 14개 타겟 언론사 (OID 기반) + 기타
INSERT INTO sources (id, name) VALUES
    (001, '연합뉴스'),
    (020, '동아일보'),
    (021, '문화일보'),
    (022, '세계일보'),
    (023, '조선일보'),
    (025, '중앙일보'),
    (028, '한겨레'),
    (032, '경향신문'),
    (055, '한국일보'),
    (056, '매일경제'),
    (214, '한국경제'),
    (421, '머니투데이'),
    (437, 'YTN'),
    (448, 'JTBC'),
    (449, '기타')
ON CONFLICT (id) DO NOTHING;

-- 초기 증시 샘플 데이터 (실제 API 연동 전까지 사용)
INSERT INTO market_summary (market_type, name, current_value, change_value, change_percent, volume) VALUES
    ('지수', 'KOSPI', 2672.18, 15.44, 0.58, 521234000),
    ('지수', 'KOSDAQ', 775.82, 3.24, 0.42, 892145000),
    ('지수', 'KOSPI200', 355.76, 2.13, 0.60, NULL),
    ('환율', 'USD/KRW', 1334.50, -2.30, -0.17, NULL),
    ('환율', 'EUR/KRW', 1485.23, 3.45, 0.23, NULL),
    ('환율', 'JPY/KRW', 893.22, -1.56, -0.17, NULL),
    ('지수', 'S&P 500', 5702.55, 23.11, 0.41, 3845670000),
    ('지수', 'NASDAQ', 18119.59, 115.94, 0.64, 4523120000),
    ('지수', 'DOW', 42313.00, 137.89, 0.33, 3012450000)
ON CONFLICT (market_type, name) DO UPDATE SET
    current_value = EXCLUDED.current_value,
    change_value = EXCLUDED.change_value,
    change_percent = EXCLUDED.change_percent,
    volume = EXCLUDED.volume,
    updated_at = NOW();

-- ================================
-- 완료 메시지
-- ================================
DO $$
BEGIN
    RAISE NOTICE '✅ FANS 데이터베이스 구조 생성 완료!';
    RAISE NOTICE '📊 테이블 14개, 인덱스 22개, 트리거 8개, 뷰 3개 생성됨';
    RAISE NOTICE '🚀 다음 단계: TypeORM 엔티티 생성 및 API 구현';
END $$;