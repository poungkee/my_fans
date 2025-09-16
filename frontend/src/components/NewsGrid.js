// src/components/NewsGrid.js
import React, { useState, useEffect } from 'react';
import NewsItem from './NewsItem';

const PAGE_SIZE = 8; // 한번에 추가로 보여줄 개수

const NewsGrid = ({ newsData, searchQuery }) => {
  // ✅ 반드시 컴포넌트 최상단에서 선언
  const [bookmarkedNews, setBookmarkedNews] = useState(new Set());
  const [likedNews, setLikedNews] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE); // ← 여기!

  // 디버그 로그 추가
  console.log('NewsGrid - newsData:', newsData?.length || 0, 'items');

  // newsData나 검색어 변경 시 페이지 리셋
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [newsData, searchQuery]);

  const handleBookmark = (newsId) => {
    const next = new Set(bookmarkedNews);
    if (next.has(newsId)) {
      next.delete(newsId);
      alert('북마크에서 제거되었습니다.');
    } else {
      next.add(newsId);
      alert('북마크에 추가되었습니다!');
    }
    setBookmarkedNews(next);
  };

  const handleLike = (newsId) => {
    const next = new Set(likedNews);
    if (next.has(newsId)) next.delete(newsId);
    else next.add(newsId);
    setLikedNews(next);
  };

  const handleShare = (news) => {
    const link = news.origin_url || news.url || window.location.href;
    if (navigator.share) {
      navigator.share({ title: news.title, text: '이 뉴스를 확인해보세요!', url: link });
    } else {
      navigator.clipboard.writeText(link).then(() => alert('링크가 클립보드에 복사되었습니다!'));
    }
  };

  const handleNewsDetail = (news) => {
    const url = news.origin_url || news.url;
    if (url) window.open(url, '_blank', 'noopener');
    else alert(`뉴스 상세 페이지: ${news.title}`);
  };

  // 검색 필터링
  const filteredNews = (newsData || []).filter((news) => {
    if (!searchQuery) return true;
    const q = String(searchQuery).toLowerCase();
    return (
      String(news.title || '').toLowerCase().includes(q) ||
      String(news.summary || '').toLowerCase().includes(q)
    );
  });

  // 현재 화면에 보여줄 아이템
  const visibleItems = filteredNews.slice(0, visibleCount);

  // 디버그 로그 추가
  console.log('NewsGrid - visibleCount:', visibleCount, 'filteredNews:', filteredNews.length, 'visibleItems:', visibleItems.length);

  // 더보기 클릭
  const handleLoadMore = () => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredNews.length));
  };

  const hasMore = visibleCount < filteredNews.length;
  const remain = Math.max(filteredNews.length - visibleCount, 0);

  return (
    <div className="news-container">
      <div className="news-grid">
        {visibleItems.map((news) => (
          <NewsItem
            key={news.id}
            news={news}
            isBookmarked={bookmarkedNews.has(news.id)}
            isLiked={likedNews.has(news.id)}
            onBookmark={() => handleBookmark(news.id)}
            onLike={() => handleLike(news.id)}
            onShare={() => handleShare(news)}
            onDetail={() => handleNewsDetail(news)}
          />
        ))}
      </div>

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 32px' }}>
          <button
            onClick={handleLoadMore}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#111827',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            더보기 {remain > 0 ? `(+${remain}개)` : ''}
          </button>
        </div>
      )}
    </div>
  );
};

export default NewsGrid;
