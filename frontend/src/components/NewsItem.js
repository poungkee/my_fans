import React, { useEffect, useState } from 'react';

const NewsItem = ({
  news,
  onDetail,
  onSubscribe
}) => {
  const [thumb, setThumb] = useState(null);

  useEffect(() => {
    setThumb(news.image_url || null);
  }, [news.image_url]);

  // 추천 타입에 따른 배지 정보
  const getRecommendationBadge = (type) => {
    const badges = {
      'most_viewed': { label: '🔥 인기', color: '#FF6B6B', bg: '#FFE5E5' },
      'collaborative': { label: '👥 협업 필터링', color: '#4ECDC4', bg: '#E0F7F6' },
      'content_based': { label: '📚 맞춤형', color: '#95E1D3', bg: '#E8F8F5' },
      'keyword_based': { label: '🔑 키워드', color: '#F38181', bg: '#FFE8E8' },
      'bias_based': { label: '⚖️ 편향 분석', color: '#AA96DA', bg: '#F0EBFA' },
      'trending': { label: '📈 트렌딩', color: '#FCBAD3', bg: '#FFF0F6' },
      'hybrid': { label: '✨ 하이브리드', color: '#A8D8EA', bg: '#E8F6FA' }
    };
    return badges[type] || null;
  };

  const badge = news.recommendation_type ? getRecommendationBadge(news.recommendation_type) : null;

  return (
    <article
      className="news-item"
      data-category={news.category}
      data-agency={news.agency}
      data-time={news.timeValue}
    >
      <div
        className="news-image"
        onClick={onDetail}
        style={{
          overflow:'hidden',
          borderRadius: '8px',
          background:'#eef',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          cursor: 'pointer'
        }}
      >
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
        {badge && (
          <div style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: '600',
            color: badge.color,
            backgroundColor: badge.bg,
            marginBottom: '8px',
            border: `1px solid ${badge.color}30`
          }}>
            {badge.label}
          </div>
        )}
        <h2
          className="news-title"
          onClick={onDetail}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.4',
            wordWrap: 'break-word',
            cursor: 'pointer',
            height: 'auto',
            maxHeight: 'none'
          }}
        >
          {news.title}
        </h2>

        <div className="news-meta-container">
        <div className="news-meta">
          <div className="news-source-row">
            <div className="news-source-info">
              <img
                className="news-source-logo"
                src={`/logos/${news.source || 'default'}.png`}
                alt={news.source || '출처 미상'}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'inline';
                }}
              />
              <span className="news-source-fallback" style={{display: 'none'}}>📰</span>
              <span className="news-source-name">
                {news.source || '출처 미상'}
              </span>
            </div>
            <button className="subscribe-button" onClick={async () => {
              if (!onSubscribe) return;

              try {
                // localStorage와 sessionStorage 모두 확인
                let token = localStorage.getItem('token');
                if (!token) {
                  token = sessionStorage.getItem('token');
                }

                if (!token) {
                  alert('로그인이 필요합니다.');
                  return;
                }

                const response = await fetch('/api/user/subscribe', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    sourceName: news.source
                  })
                });

                const data = await response.json();

                if (data.ok) {
                  alert(data.message || `${news.source} 구독이 완료되었습니다!`);
                } else {
                  alert(data.error || '구독에 실패했습니다.');
                }
              } catch (error) {
                console.error('구독 요청 실패:', error);
                alert('구독 요청 중 오류가 발생했습니다.');
              }
            }}>
              구독하기
            </button>
          </div>

          <div className="news-details-row">
            <span className="news-journalist">
              {news.journalist || '기자 정보 없음'}
            </span>
            <span className="news-time">
              {(() => {
                const date = new Date(news.pub_date);
                const year = date.getFullYear().toString().slice(-2);
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                return `${year}.${month}.${day} ${hours}:${minutes}`;
              })()}
            </span>
          </div>
        </div>
        </div>
      </div>
    </article>
  );
};

export default NewsItem;
