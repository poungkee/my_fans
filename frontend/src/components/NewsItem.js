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
    const target = news.origin_url || news.url;
    if (!target) return;

    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/media?url=${encodeURIComponent(target)}`);
        if (!r.ok) throw new Error(`MEDIA ${r.status}`);
        const m = await r.json();
        if (alive) setThumb(m.image_url || null);
      } catch {
        if (alive) setThumb(null);
      }
    })();

    return () => { alive = false; };
  }, [news.origin_url, news.url]);

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
          <span className="news-source">{news.source}</span>
          <span className="news-time">{news.time}</span>
          <span className="news-views">{news.views}</span>
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
