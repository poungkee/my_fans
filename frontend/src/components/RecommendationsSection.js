import React, { useEffect, useState } from 'react';
import NewsItem from './NewsItem';
import './RecommendationsSection.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.fans.ai.kr/api';

const RecommendationsSection = ({ onNavigateToDetail }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true); // 기본값: 펼쳐진 상태로 변경

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);

        // 토큰 확인
        let token = localStorage.getItem('token');
        if (!token) {
          token = sessionStorage.getItem('token');
        }

        if (!token) {
          return; // 비로그인 사용자는 추천 섹션 숨김
        }

        // 초기 로드 시에는 캐시 삭제 안 함 (기존 추천 사용)
        const response = await fetch(`${API_BASE_URL}/recommendations?limit=20`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('추천 뉴스를 불러오는데 실패했습니다.');
        }

        const data = await response.json();

        if (data.success && data.data && data.data.recommendations) {
          setRecommendations(data.data.recommendations);
        }
      } catch (err) {
        console.error('추천 뉴스 로드 실패:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  // 새로고침 핸들러
  const handleRefresh = async () => {
    try {
      setLoading(true);
      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }

      if (!token) return;

      // 캐시 삭제
      await fetch(`${API_BASE_URL}/recommendations/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // 새로운 추천 가져오기
      const response = await fetch(`${API_BASE_URL}/recommendations?limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success && data.data && data.data.recommendations) {
        setRecommendations(data.data.recommendations);
      }
    } catch (err) {
      console.error('추천 새로고침 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 비로그인 사용자는 컴포넌트를 렌더링하지 않음
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) {
    return null;
  }

  // 로딩 중인 경우
  if (loading && recommendations.length === 0) {
    return (
      <section className={`recommendations-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="recommendations-header" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="recommendations-title-wrapper">
            <h2>🎯 맞춤 추천 뉴스</h2>
            <span className="toggle-icon">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
        {isExpanded && (
          <div className="recommendations-loading">
            추천 뉴스를 불러오는 중...
          </div>
        )}
      </section>
    );
  }

  if (error) {
    return (
      <section className={`recommendations-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="recommendations-header" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="recommendations-title-wrapper">
            <h2>🎯 맞춤 추천 뉴스</h2>
            <span className="toggle-icon">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
        {isExpanded && (
          <div className="recommendations-error">
            {error}
          </div>
        )}
      </section>
    );
  }

  if (recommendations.length === 0) {
    return (
      <section className={`recommendations-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="recommendations-header" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="recommendations-title-wrapper">
            <h2>🎯 맞춤 추천 뉴스</h2>
            <span className="toggle-icon">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
        {isExpanded && (
          <div className="recommendations-empty">
            기사를 읽거나 프로필 등록을 해서 맞춤 추천 뉴스 보기가 가능합니다
          </div>
        )}
      </section>
    );
  }

  // 프로필 미설정 사용자인지 확인 (모든 기사가 most_viewed 타입인 경우)
  const isNewUser = recommendations.length > 0 &&
    recommendations.every(article => article.recommendation_type === 'most_viewed');

  return (
    <section className={`recommendations-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="recommendations-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="recommendations-title-wrapper">
          <h2>{isNewUser ? '🔥 현재 인기 기사' : '🎯 맞춤 추천 뉴스'}</h2>
          <span className="recommendations-count">
            ({recommendations.length}개)
          </span>
          <span className="toggle-icon">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
        <button
          className="recommendations-refresh-btn"
          onClick={(e) => {
            e.stopPropagation(); // 부모 클릭 이벤트 방지
            handleRefresh();
          }}
          disabled={loading}
          title="추천 새로고침"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="recommendations-subtitle">
            {isNewUser
              ? '현재 인기 있는 기사를 추천해드립니다. 더 많은 기사를 읽으면 맞춤 추천이 개선됩니다!'
              : '당신의 관심사를 기반으로 선별한 뉴스입니다'}
          </div>

          <div className="recommendations-grid">
            {recommendations.map((article) => (
              <NewsItem
                key={article.id}
                news={{
                  id: article.id,
                  title: article.title,
                  image_url: article.image_url,
                  source: article.source_name,
                  journalist: article.journalist,
                  pub_date: article.pub_date,
                  category: article.category_name,
                  url: article.url,
                  recommendation_type: article.recommendation_type // 추천 타입 추가
                }}
                onDetail={() => onNavigateToDetail && onNavigateToDetail(article.id)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default RecommendationsSection;
