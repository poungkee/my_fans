import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import AgencySection from '../components/AgencySection';
import './ActivityLog.css';

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, subscription, read, bookmark, comment, like, dislike

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      // TODO: 실제 API 호출로 교체
      // const response = await fetch('/api/user/activities', {
      //   headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      // });
      // const data = await response.json();

      setActivities([]);
    } catch (error) {
      console.error('활동 로그 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = activities.filter(activity =>
    filter === 'all' || (filter !== 'subscription' && activity.type === filter)
  );

  const getActivityIcon = (type) => {
    switch(type) {
      case 'read': return '📖';
      case 'bookmark': return '🔖';
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'dislike': return '👎';
      case 'subscription': return '📰';
      default: return '📋';
    }
  };

  const getActivityColor = (type) => {
    switch(type) {
      case 'read': return '#3b82f6';
      case 'bookmark': return '#f59e0b';
      case 'like': return '#ef4444';
      case 'comment': return '#10b981';
      case 'dislike': return '#8b5cf6';
      case 'subscription': return '#f97316';
      default: return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}분 전`;
    } else if (hours < 24) {
      return `${hours}시간 전`;
    } else {
      return `${days}일 전`;
    }
  };

  if (loading) {
    return (
      <div className="activity-log-page">
        <div className="loading">활동 로그를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <div className="activity-log-page">
        <div className="activity-header">
        <h1>📊 나의 활동 관리</h1>
        <p>최근 활동과 구독 중인 언론사를 관리하세요</p>
      </div>

      <div className="activity-filters">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          전체
        </button>
        <button
          className={filter === 'subscription' ? 'active' : ''}
          onClick={() => setFilter('subscription')}
        >
          📰 구독
        </button>
        <button
          className={filter === 'read' ? 'active' : ''}
          onClick={() => setFilter('read')}
        >
          📖 읽기
        </button>
        <button
          className={filter === 'bookmark' ? 'active' : ''}
          onClick={() => setFilter('bookmark')}
        >
          🔖 북마크
        </button>
        <button
          className={filter === 'comment' ? 'active' : ''}
          onClick={() => setFilter('comment')}
        >
          💬 댓글
        </button>
        <button
          className={filter === 'like' ? 'active' : ''}
          onClick={() => setFilter('like')}
        >
          ❤️ 좋아요
        </button>
        <button
          className={filter === 'dislike' ? 'active' : ''}
          onClick={() => setFilter('dislike')}
        >
          👎 싫어요
        </button>
      </div>

      {filter === 'subscription' ? (
        <div className="subscription-content">
          <AgencySection />
        </div>
      ) : (
        <div className="activity-list">
          {filteredActivities.length === 0 ? (
            <div className="no-activities">
              <p>활동 기록이 없습니다.</p>
            </div>
          ) : (
            filteredActivities.map(activity => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon" style={{ backgroundColor: getActivityColor(activity.type) }}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="activity-content">
                  <div className="activity-title">{activity.title}</div>
                  <div className="activity-description">{activity.description}</div>
                  <div className="activity-meta">
                    <span className="activity-source">{activity.source}</span>
                    <span className="activity-time">{formatTimestamp(activity.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default ActivityLog;