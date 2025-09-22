-- ======================================================
-- FANS Database Initial Data (Seeds)
-- ======================================================
-- Created: 2025-09-22
-- Purpose: Insert initial data for FANS application
-- ======================================================

-- 1. 기본 카테고리 데이터
INSERT INTO categories (id, name) VALUES
(1, '정치'),
(2, '경제'),
(3, '사회'),
(4, '연예'),
(5, '생활/문화'),
(6, 'IT/과학'),
(7, '세계'),
(8, '스포츠')
ON CONFLICT (name) DO NOTHING;

-- 카테고리 시퀀스 재설정
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- 2. 기본 소스 데이터
INSERT INTO sources (id, name, url, logo_url) VALUES
(1, '네이버뉴스', 'https://news.naver.com', 'https://ssl.pstatic.net/static.news/image/news/2020/logo/logo_news.png'),
(2, '연합뉴스', 'https://www.yna.co.kr', 'https://img.yonhapnews.co.kr/etc/inner/KR/2020/logo_header.png'),
(3, 'KBS', 'https://news.kbs.co.kr', 'https://img.kbs.co.kr/cms/2tv/entertainment/hello_counselor/2017/hello_counsel_main_logo.png'),
(4, 'MBC', 'https://imnews.imbc.com', 'https://static.imbc.com/main/2020/images/header/mbc_logo.png'),
(5, 'SBS', 'https://news.sbs.co.kr', 'https://static.news.sbs.co.kr/news/img/header_logo.png'),
(6, '조선일보', 'https://www.chosun.com', 'https://www.chosun.com/resizer/WQdWF_gQqCE5T6v9IWMNHRNFLOw=/120x0/cloudfront-ap-northeast-1.images.arcpublishing.com/chosun/RKGR7Q5ILFCXFOJ5QHGNLF2DXI.png'),
(7, '중앙일보', 'https://www.joongang.co.kr', 'https://pds.joongang.co.kr/news/component/htmlphoto_mmdata/202001/14/e0d94201-2fa9-4bd7-bbdf-8c4b8c89a8f6.jpg'),
(8, '동아일보', 'https://www.donga.com', 'https://dimg.donga.com/wps/THEME/mainLogo.png'),
(9, '한겨레', 'https://www.hani.co.kr', 'https://flexible.img.hani.co.kr/flexible/normal/281/175/imgdb/resize/2018/0426/00501881_20180426.JPG'),
(10, '경향신문', 'https://www.khan.co.kr', 'https://img.khan.co.kr/spko/khan_logo_1200_630.png')
ON CONFLICT (name) DO NOTHING;

-- 소스 시퀀스 재설정
SELECT setval('sources_id_seq', (SELECT MAX(id) FROM sources));

-- 3. 기본 키워드 데이터 (뉴스에서 자주 사용되는 키워드들)
INSERT INTO keywords (keyword, frequency) VALUES
('정치', 100),
('경제', 100),
('사회', 100),
('문화', 50),
('기술', 50),
('과학', 50),
('스포츠', 50),
('연예', 50),
('국제', 30),
('환경', 30),
('교육', 30),
('의료', 30),
('코로나', 20),
('정부', 20),
('국회', 20),
('대통령', 20),
('선거', 15),
('주식', 15),
('부동산', 15),
('금리', 15)
ON CONFLICT (keyword) DO NOTHING;

-- 4. 기본 관리자 사용자 (개발용)
INSERT INTO users (
    username,
    email,
    password_hash,
    name,
    provider,
    email_verified,
    active
) VALUES (
    'admin',
    'admin@fans.co.kr',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/.ESsxiB4LyTBM6jaG', -- 'admin123' hashed
    '관리자',
    'local',
    true,
    true
) ON CONFLICT (username) DO NOTHING;

-- ======================================================
-- 뷰 생성
-- ======================================================

-- 1. 뉴스 기사 통계 뷰
CREATE OR REPLACE VIEW news_with_stats AS
SELECT
    na.id,
    na.title,
    na.content,
    na.ai_summary,
    na.url,
    na.image_url,
    na.journalist,
    na.pub_date,
    na.created_at,
    na.updated_at,
    c.name as category_name,
    s.name as source_name,
    s.logo_url as source_logo,
    COALESCE(ast.view_count, 0) as view_count,
    COALESCE(ast.like_count, 0) as like_count,
    COALESCE(ast.bookmark_count, 0) as bookmark_count
FROM news_articles na
LEFT JOIN categories c ON na.category_id = c.id
LEFT JOIN sources s ON na.source_id = s.id
LEFT JOIN article_stats ast ON na.id = ast.article_id;

-- 2. 사용자 활동 요약 뷰
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT
    u.id as user_id,
    u.username,
    u.name,
    COUNT(DISTINCT ua.id) as total_actions,
    COUNT(DISTINCT b.id) as bookmark_count,
    COUNT(DISTINCT CASE WHEN ua.action_type = 'view' THEN ua.id END) as view_count,
    COUNT(DISTINCT CASE WHEN ua.action_type = 'like' THEN ua.id END) as like_count,
    MAX(ua.created_at) as last_activity
FROM users u
LEFT JOIN user_actions ua ON u.id = ua.user_id
LEFT JOIN bookmarks b ON u.id = b.user_id
WHERE u.active = true
GROUP BY u.id, u.username, u.name;

-- 3. 인기 기사 뷰 (최근 7일)
CREATE OR REPLACE VIEW trending_articles AS
SELECT
    na.id,
    na.title,
    na.url,
    na.image_url,
    na.pub_date,
    c.name as category_name,
    s.name as source_name,
    COALESCE(ast.view_count, 0) as view_count,
    COALESCE(ast.like_count, 0) as like_count,
    COALESCE(ast.bookmark_count, 0) as bookmark_count,
    (COALESCE(ast.view_count, 0) * 1 +
     COALESCE(ast.like_count, 0) * 3 +
     COALESCE(ast.bookmark_count, 0) * 5) as popularity_score
FROM news_articles na
LEFT JOIN categories c ON na.category_id = c.id
LEFT JOIN sources s ON na.source_id = s.id
LEFT JOIN article_stats ast ON na.id = ast.article_id
WHERE na.pub_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY popularity_score DESC, na.pub_date DESC;

-- ======================================================
-- 권한 설정
-- ======================================================

-- 기본 역할 및 권한 설정 (필요시)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fans_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fans_user;