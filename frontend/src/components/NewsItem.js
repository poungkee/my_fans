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
