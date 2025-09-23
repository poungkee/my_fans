// src/components/NewsGrid.js
import React, { useState, useEffect } from 'react';
import NewsItem from './NewsItem';

const PAGE_SIZE = 8; // 한번에 추가로 보여줄 개수

const NewsGrid = ({ newsData, searchQuery }) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // newsData나 검색어 변경 시 페이지 리셋
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [newsData, searchQuery]);

  const handleNewsDetail = (news) => {
    const url = news.origin_url || news.url;
    if (url) window.open(url, '_blank', 'noopener');
    else alert(`뉴스 상세 페이지: ${news.title}`);
  };

  const handleSubscribe = (sourceName) => {
    if (sourceName && sourceName !== '출처 미상') {
      alert(`${sourceName} 구독이 추가되었습니다!`);
      // TODO: 실제 구독 로직 구현
    } else {
      alert('구독할 수 없는 언론사입니다.');
    }
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
            onDetail={() => handleNewsDetail(news)}
            onSubscribe={handleSubscribe}
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
