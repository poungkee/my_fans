-- Raw News Articles Table (크롤링 원본 저장)
-- 이 테이블은 크롤링된 원본 기사를 저장하며, Spark 분류 전의 데이터를 담습니다.

-- 1. raw_news_articles 테이블 생성
CREATE TABLE IF NOT EXISTS raw_news_articles (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    url VARCHAR(1000) UNIQUE,
    image_url VARCHAR(1000),
    journalist VARCHAR(100),
    pub_date TIMESTAMP WITH TIME ZONE,

    -- 원본 데이터 (텍스트 형태로 저장)
    original_source VARCHAR(200),  -- 크롤링한 원본 언론사명 (분류 전)
    original_category VARCHAR(100), -- 크롤링한 원본 카테고리명 (분류 전)

    -- 처리 상태
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,

    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_raw_news_processed ON raw_news_articles(processed);
CREATE INDEX IF NOT EXISTS idx_raw_news_created_at ON raw_news_articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_news_url ON raw_news_articles(url);

-- 3. 트리거 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_raw_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_raw_news_updated
    BEFORE UPDATE ON raw_news_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_raw_news_updated_at();

-- 4. 코멘트 추가
COMMENT ON TABLE raw_news_articles IS '크롤링 원본 기사 저장 테이블 (Spark 분류 전)';
COMMENT ON COLUMN raw_news_articles.original_source IS '크롤링한 원본 언론사명 (텍스트)';
COMMENT ON COLUMN raw_news_articles.original_category IS '크롤링한 원본 카테고리명 (텍스트)';
COMMENT ON COLUMN raw_news_articles.processed IS 'Spark 분류 완료 여부';
COMMENT ON COLUMN raw_news_articles.processed_at IS 'Spark 분류 완료 시간';
COMMENT ON COLUMN raw_news_articles.processing_error IS '분류 실패 시 에러 메시지';
