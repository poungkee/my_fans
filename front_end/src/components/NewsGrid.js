import React, { useState } from 'react';
import NewsItem from './NewsItem';

const NewsGrid = ({ newsData, searchQuery }) => {
  const [bookmarkedNews, setBookmarkedNews] = useState(new Set());
  const [likedNews, setLikedNews] = useState(new Set());

  const handleBookmark = (newsId) => {
    const newBookmarked = new Set(bookmarkedNews);
    if (newBookmarked.has(newsId)) {
      newBookmarked.delete(newsId);
      alert('북마크에서 제거되었습니다.');
    } else {
      newBookmarked.add(newsId);
      alert('북마크에 추가되었습니다!');
    }
    setBookmarkedNews(newBookmarked);
  };

  const handleLike = (newsId) => {
    const newLiked = new Set(likedNews);
    if (newLiked.has(newsId)) {
      newLiked.delete(newsId);
    } else {
      newLiked.add(newsId);
    }
    setLikedNews(newLiked);
  };

  const handleShare = (news) => {
    if (navigator.share) {
      navigator.share({
        title: news.title,
        text: '이 뉴스를 확인해보세요!',
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('링크가 클립보드에 복사되었습니다!');
      });
    }
  };

  const handleNewsDetail = (news) => {
    alert(`뉴스 상세 페이지: ${news.title}\n\n(실제 구현에서는 상세 페이지로 이동)`);
  };

  // 검색 필터링
  const filteredNews = newsData.filter(news => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return news.title.toLowerCase().includes(query) || 
           news.summary.toLowerCase().includes(query);
  });

  return (
    <div className="news-container">
      <div className="news-grid">
        {filteredNews.map(news => (
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
    </div>
  );
};

export default NewsGrid;
