-- ================================
-- 사용자 활동 로깅 테이블
-- ================================

-- 사용자 행동 로그 (조회, 좋아요, 북마크, 공유)
CREATE TABLE IF NOT EXISTS user_activity_log (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id INT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('view', 'like', 'dislike', 'bookmark', 'share', 'click')),
    reading_time_seconds INT DEFAULT 0,
    device_type VARCHAR(50),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity ON user_activity_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_article_activity ON user_activity_log(article_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity_log(activity_type);

-- 기사 신뢰도 점수
CREATE TABLE IF NOT EXISTS article_credibility (
    article_id INT PRIMARY KEY REFERENCES news_articles(id) ON DELETE CASCADE,
    credibility_score DECIMAL(3,2) DEFAULT 0.50 CHECK (credibility_score >= 0 AND credibility_score <= 1),
    source_reliability_score DECIMAL(3,2) DEFAULT 0.50,
    cross_verification_count INT DEFAULT 0,
    fake_news_probability DECIMAL(3,2) DEFAULT 0.00,
    user_report_count INT DEFAULT 0,
    fact_check_status VARCHAR(20) DEFAULT 'unverified' CHECK (fact_check_status IN ('verified', 'disputed', 'unverified', 'false')),
    verification_sources TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credibility_score ON article_credibility(credibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_fact_check_status ON article_credibility(fact_check_status);

-- 기사 감성 분석 결과
CREATE TABLE IF NOT EXISTS article_sentiment (
    article_id INT PRIMARY KEY REFERENCES news_articles(id) ON DELETE CASCADE,
    positive_score DECIMAL(3,2) DEFAULT 0.33 CHECK (positive_score >= 0 AND positive_score <= 1),
    negative_score DECIMAL(3,2) DEFAULT 0.33 CHECK (negative_score >= 0 AND negative_score <= 1),
    neutral_score DECIMAL(3,2) DEFAULT 0.34 CHECK (neutral_score >= 0 AND neutral_score <= 1),
    overall_sentiment VARCHAR(20) DEFAULT 'neutral' CHECK (overall_sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    sentiment_magnitude DECIMAL(3,2) DEFAULT 0.00,
    key_phrases TEXT,
    analyzed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overall_sentiment ON article_sentiment(overall_sentiment);

-- 기사 임베딩 (벡터 유사도 계산용)
CREATE TABLE IF NOT EXISTS article_embeddings (
    article_id INT PRIMARY KEY REFERENCES news_articles(id) ON DELETE CASCADE,
    title_embedding BYTEA,
    content_embedding BYTEA,
    combined_embedding BYTEA,
    embedding_model VARCHAR(100) DEFAULT 'word2vec',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 추천 성능 메트릭
CREATE TABLE IF NOT EXISTS recommendation_metrics (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    article_id INT REFERENCES news_articles(id) ON DELETE CASCADE,
    recommendation_score DECIMAL(5,4),
    was_clicked BOOLEAN DEFAULT FALSE,
    was_liked BOOLEAN DEFAULT FALSE,
    reading_time_seconds INT DEFAULT 0,
    recommended_at TIMESTAMP DEFAULT NOW(),
    clicked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rec_performance ON recommendation_metrics(user_id, was_clicked);
CREATE INDEX IF NOT EXISTS idx_rec_article ON recommendation_metrics(article_id, was_clicked);

-- ================================
-- 인덱스 추가 (성능 최적화)
-- ================================

-- 기존 news_articles 테이블에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_source ON news_articles(source_id);

-- ================================
-- 뷰 생성 (편의성)
-- ================================

-- 사용자별 활동 요약
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT
    user_id,
    COUNT(*) as total_activities,
    COUNT(DISTINCT article_id) as unique_articles_viewed,
    COUNT(CASE WHEN activity_type = 'view' THEN 1 END) as view_count,
    COUNT(CASE WHEN activity_type = 'like' THEN 1 END) as like_count,
    COUNT(CASE WHEN activity_type = 'bookmark' THEN 1 END) as bookmark_count,
    AVG(reading_time_seconds) as avg_reading_time,
    MAX(created_at) as last_activity_at
FROM user_activity_log
GROUP BY user_id;

-- 기사별 인기도 점수
CREATE OR REPLACE VIEW article_popularity AS
SELECT
    a.id as article_id,
    a.title,
    COUNT(DISTINCT ual.user_id) as unique_viewers,
    COUNT(CASE WHEN ual.activity_type = 'view' THEN 1 END) as view_count,
    COUNT(CASE WHEN ual.activity_type = 'like' THEN 1 END) as like_count,
    COUNT(CASE WHEN ual.activity_type = 'bookmark' THEN 1 END) as bookmark_count,
    COUNT(CASE WHEN ual.activity_type = 'share' THEN 1 END) as share_count,
    (COUNT(CASE WHEN ual.activity_type = 'like' THEN 1 END) * 2.0 +
     COUNT(CASE WHEN ual.activity_type = 'bookmark' THEN 1 END) * 3.0 +
     COUNT(CASE WHEN ual.activity_type = 'share' THEN 1 END) * 4.0 +
     COUNT(DISTINCT ual.user_id) * 1.0) as popularity_score
FROM news_articles a
LEFT JOIN user_activity_log ual ON a.id = ual.article_id
GROUP BY a.id, a.title;

-- ================================
-- 트리거 (자동 업데이트)
-- ================================

-- 사용자 프로필 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_profile_embedding()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_profile_embeddings
    SET
        total_interactions = total_interactions + 1,
        last_updated = NOW()
    WHERE user_id = NEW.user_id;

    IF NOT FOUND THEN
        INSERT INTO user_profile_embeddings (user_id, total_interactions)
        VALUES (NEW.user_id, 1);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_profile ON user_activity_log;
CREATE TRIGGER trigger_update_user_profile
AFTER INSERT ON user_activity_log
FOR EACH ROW
EXECUTE FUNCTION update_user_profile_embedding();

-- 코멘트
COMMENT ON TABLE user_activity_log IS '사용자 행동 로그 - 추천 시스템의 기반 데이터';
COMMENT ON TABLE user_recommendations IS '사용자별 추천 결과 캐시';
COMMENT ON TABLE article_credibility IS '기사 신뢰도 및 팩트체크 정보';
COMMENT ON TABLE article_sentiment IS '기사 감성 분석 결과';
