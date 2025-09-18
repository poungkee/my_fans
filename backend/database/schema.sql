-- FANS 뉴스 데이터베이스 스키마
-- 최대 5GB 용량 기준으로 설계

-- 1. 뉴스 기사 메인 테이블
CREATE TABLE news_articles (
    id BIGSERIAL PRIMARY KEY,

    -- 기본 정보
    title VARCHAR(500) NOT NULL,
    content TEXT,
    summary TEXT,  -- 네이버 원본 요약
    ai_summary TEXT,  -- AI 생성 요약 (전체)
    short_ai_summary VARCHAR(50),  -- AI 생성 짧은 요약 (20-30자)

    -- URL 정보
    url VARCHAR(1000),  -- 네이버 뉴스 URL
    origin_url VARCHAR(1000),  -- 원본 기사 URL

    -- 미디어 (URL만 저장)
    image_url VARCHAR(1000),
    video_url VARCHAR(1000),

    -- 메타데이터
    source VARCHAR(100),  -- 언론사
    category VARCHAR(50),  -- 카테고리
    pub_date TIMESTAMP WITH TIME ZONE,  -- 발행일
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 인덱스를 위한 필드
    search_vector tsvector,  -- 전문검색용

    UNIQUE(url)  -- 중복 방지
);

-- 2. 키워드 테이블 (정규화)
CREATE TABLE keywords (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(100) UNIQUE NOT NULL,
    frequency INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 뉴스-키워드 관계 테이블
CREATE TABLE news_keywords (
    news_id BIGINT REFERENCES news_articles(id) ON DELETE CASCADE,
    keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
    relevance FLOAT DEFAULT 1.0,  -- 관련도 점수
    PRIMARY KEY (news_id, keyword_id)
);

-- 4. 사용자 테이블 (추후 확장용)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 5. 북마크 테이블
CREATE TABLE bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    news_id BIGINT REFERENCES news_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, news_id)
);

-- 인덱스 생성 (검색 성능 최적화)
CREATE INDEX idx_news_pub_date ON news_articles(pub_date DESC);
CREATE INDEX idx_news_source ON news_articles(source);
CREATE INDEX idx_news_category ON news_articles(category);
CREATE INDEX idx_news_created_at ON news_articles(created_at DESC);

-- 전문검색 인덱스
CREATE INDEX idx_news_search_vector ON news_articles USING GIN(search_vector);
CREATE INDEX idx_news_title_gin ON news_articles USING GIN(to_tsvector('simple', title));

-- 키워드 관련 인덱스
CREATE INDEX idx_keywords_frequency ON keywords(frequency DESC);
CREATE INDEX idx_news_keywords_relevance ON news_keywords(relevance DESC);

-- 전문검색 업데이트 트리거
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('simple', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.ai_summary, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_news_search_vector
    BEFORE INSERT OR UPDATE ON news_articles
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_modified_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_news_modified_time
    BEFORE UPDATE ON news_articles
    FOR EACH ROW EXECUTE FUNCTION update_modified_time();

-- 뷰 생성: 최근 뉴스 (자주 사용할 쿼리)
CREATE VIEW recent_news AS
SELECT
    na.*,
    array_agg(k.keyword ORDER BY nk.relevance DESC) as keywords
FROM news_articles na
LEFT JOIN news_keywords nk ON na.id = nk.news_id
LEFT JOIN keywords k ON nk.keyword_id = k.id
WHERE na.pub_date >= NOW() - INTERVAL '7 days'
GROUP BY na.id
ORDER BY na.pub_date DESC;

-- 용량 모니터링용 뷰
CREATE VIEW storage_usage AS
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    avg_width,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_stats
WHERE schemaname = 'public';