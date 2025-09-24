// src/components/NewsGrid.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NewsItem from './NewsItem';
import './NewsGrid.css';

const PAGE_SIZE = 8; // 한번에 추가로 보여줄 개수

const NewsGrid = ({ newsData, searchQuery }) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const observer = useRef();
  const navigate = useNavigate();

  // newsData나 검색어 변경 시 페이지 리셋
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [newsData, searchQuery]);

  const handleNewsDetail = (news) => {
    // 현재 스크롤 위치 저장
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

    // 뉴스 디테일 페이지로 이동하면서 현재 위치 정보 전달
    navigate(`/news/${news.id}`, {
      state: {
        from: window.location.pathname + window.location.search,
        scrollY: currentScrollY
      }
    });
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

  // 무한 스크롤을 위한 마지막 요소 참조
  const lastNewsElementRef = useCallback(node => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < filteredNews.length) {
        setIsLoading(true);
        setTimeout(() => {
          setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredNews.length));
          setIsLoading(false);
        }, 300); // 로딩 효과를 위한 지연
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, visibleCount, filteredNews.length]);

  const hasMore = visibleCount < filteredNews.length;

  return (
    <div className="news-container">
      <div className="news-grid">
        {visibleItems.map((news, index) => {
          // 마지막 요소에 ref 추가
          if (visibleItems.length === index + 1) {
            return (
              <div ref={lastNewsElementRef} key={news.id}>
                <NewsItem
                  news={news}
                  onDetail={() => handleNewsDetail(news)}
                  onSubscribe={handleSubscribe}
                />
              </div>
            );
          } else {
            return (
              <NewsItem
                key={news.id}
                news={news}
                onDetail={() => handleNewsDetail(news)}
                onSubscribe={handleSubscribe}
              />
            );
          }
        })}
      </div>

      {/* 로딩 인디케이터 */}
      {isLoading && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '20px',
          color: '#666'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #f3f3f3',
              borderTop: '2px solid #4f46e5',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            더 많은 뉴스를 불러오는 중...
          </div>
        </div>
      )}

      {/* 모든 뉴스를 다 보여준 경우 */}
      {!hasMore && visibleItems.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '30px',
          color: '#888',
          fontSize: '14px'
        }}>
          모든 뉴스를 확인하셨습니다.
        </div>
      )}
    </div>
  );
};

export default NewsGrid;
