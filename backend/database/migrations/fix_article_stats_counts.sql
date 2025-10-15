-- ================================
-- 모든 article_stats 카운트를 user_actions 기반으로 재계산
-- ================================

-- 1. 먼저 모든 article_stats를 0으로 초기화
UPDATE article_stats
SET
    view_count = 0,
    like_count = 0,
    dislike_count = 0,
    bookmark_count = 0,
    updated_at = NOW();

-- 2. user_actions 테이블 기반으로 정확한 카운트 재계산
WITH action_counts AS (
    SELECT
        article_id,
        COUNT(CASE WHEN action_type = 'VIEW' THEN 1 END) as views,
        COUNT(CASE WHEN action_type = 'LIKE' THEN 1 END) as likes,
        COUNT(CASE WHEN action_type = 'DISLIKE' THEN 1 END) as dislikes,
        COUNT(CASE WHEN action_type = 'BOOKMARK' THEN 1 END) as bookmarks
    FROM user_actions
    GROUP BY article_id
)
UPDATE article_stats
SET
    view_count = COALESCE(action_counts.views, 0),
    like_count = COALESCE(action_counts.likes, 0),
    dislike_count = COALESCE(action_counts.dislikes, 0),
    bookmark_count = COALESCE(action_counts.bookmarks, 0),
    updated_at = NOW()
FROM action_counts
WHERE article_stats.article_id = action_counts.article_id;

-- 3. user_actions에 없지만 article_stats에 있는 기사는 카운트를 0으로 유지 (위의 UPDATE에서 이미 처리됨)

-- 4. 결과 확인
SELECT
    '재계산 완료' as status,
    COUNT(*) as total_articles,
    SUM(view_count) as total_views,
    SUM(like_count) as total_likes,
    SUM(dislike_count) as total_dislikes,
    SUM(bookmark_count) as total_bookmarks
FROM article_stats;
