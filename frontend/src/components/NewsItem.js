import React, { useEffect, useState } from 'react';

const NewsItem = ({
  news,
  isBookmarked,
  isLiked,
  onBookmark,
  onLike,
  onShare,
  onDetail
}) => {
  const [thumb, setThumb] = useState(null);

  useEffect(() => {
    // 임시로 이미지 API 비활성화 - 뉴스 데이터에서 직접 사용
    setThumb(news.image_url || null);
  }, [news.image_url]);

  return (
    <article
      className="news-item"
      data-category={news.category}
      data-agency={news.agency}
      data-time={news.timeValue}
    >
      <div className="news-image" style={{overflow:'hidden', borderRadius: '8px', background:'#eef', display:'flex', alignItems:'center', justifyContent:'center'}}>
        {thumb ? (
          <img
            src={thumb}
            alt={news.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{opacity:.6, fontSize:22}}>🖼️</span>
        )}
      </div>

      <div className="news-content">
        <h2 className="news-title" onClick={onDetail}>{news.title}</h2>
        <p className="news-summary">{news.summary}</p>
        <div className="news-meta">
          <span className="news-source">
            {news.media_source?.name || '출처 미상'}
          </span>
          <span className="news-category">
            {news.category?.name}
          </span>
          <span className="news-time">
            {new Date(news.pub_date).toLocaleDateString('ko-KR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        <div className="news-actions">
          <button className={`news-action ${isBookmarked ? 'bookmarked' : ''}`} onClick={onBookmark}>
            {isBookmarked ? '✅ 북마크됨' : '🔖 북마크'}
          </button>
          <button className="news-action" onClick={onShare}>📤 공유</button>
          <button className="news-action" onClick={onLike} style={{ color: isLiked ? '#dc3545' : '' }}>
            {isLiked ? '❤️ 좋아요됨' : '👍 좋아요'}
          </button>
        </div>
      </div>
    </article>
  );
};

export default NewsItem;
