import React from 'react';

const NewsItem = ({ 
  news, 
  isBookmarked, 
  isLiked, 
  onBookmark, 
  onLike, 
  onShare, 
  onDetail 
}) => {
  return (
    <article 
      className="news-item" 
      data-category={news.category} 
      data-agency={news.agency} 
      data-time={news.timeValue}
    >
      <div className="news-image"></div>
      <div className="news-content">
        <h2 
          className="news-title" 
          onClick={onDetail}
        >
          {news.title}
        </h2>
        <p className="news-summary">{news.summary}</p>
        <div className="news-meta">
          <span className="news-source">{news.source}</span>
          <span className="news-time">{news.time}</span>
          <span className="news-views">{news.views}</span>
        </div>
        <div className="news-actions">
          <button 
            className={`news-action ${isBookmarked ? 'bookmarked' : ''}`}
            onClick={onBookmark}
          >
            {isBookmarked ? '✅ 북마크됨' : '🔖 북마크'}
          </button>
          <button 
            className="news-action" 
            onClick={onShare}
          >
            📤 공유
          </button>
          <button 
            className="news-action" 
            onClick={onLike}
            style={{ color: isLiked ? '#dc3545' : '' }}
          >
            {isLiked ? '❤️ 좋아요됨' : '👍 좋아요'}
          </button>
        </div>
      </div>
    </article>
  );
};

export default NewsItem;
