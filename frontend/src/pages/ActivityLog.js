import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import AgencySection from '../components/AgencySection';
import './ActivityLog.css';

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, subscription, read, bookmark, comment, like, dislike

  useEffect(() => {
    fetchActivities();
    if (filter === 'subscription') {
      fetchSubscriptions();
    }
  }, [filter]);

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

  const fetchSubscriptions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSubscriptions([]);
        return;
      }

      const response = await fetch('/api/user/subscriptions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.ok) {
        setSubscriptions(data.subscriptions || []);
      } else {
        console.error('구독 목록 조회 실패:', data.error);
        setSubscriptions([]);
      }
    } catch (error) {
      console.error('구독 목록 조회 실패:', error);
      setSubscriptions([]);
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
          {subscriptions.length > 0 ? (
            <div className="subscription-list">
              <h3>구독 중인 언론사</h3>
              {subscriptions.map(subscription => (
                <div key={subscription.id} className="subscription-item">
                  <div className="subscription-info">
                    <strong>{subscription.name}</strong>
                    {subscription.url && (
                      <a href={subscription.url} target="_blank" rel="noopener noreferrer" className="subscription-link">
                        웹사이트 방문
                      </a>
                    )}
                  </div>
                  <button
                    className="unsubscribe-btn"
                    onClick={async () => {
                      if (!confirm(`${subscription.name} 구독을 취소하시겠습니까?`)) return;

                      try {
                        const token = localStorage.getItem('token');
                        const response = await fetch('/api/user/unsubscribe', {
                          method: 'DELETE',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            sourceName: subscription.name
                          })
                        });

                        const data = await response.json();
                        if (data.ok) {
                          alert(data.message);
                          fetchSubscriptions(); // 목록 새로고침
                        } else {
                          alert(data.error || '구독 취소에 실패했습니다.');
                        }
                      } catch (error) {
                        console.error('구독 취소 실패:', error);
                        alert('구독 취소 중 오류가 발생했습니다.');
                      }
                    }}
                  >
                    구독 취소
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-subscriptions">
              <p>구독 중인 언론사가 없습니다.</p>
              <p>뉴스 카드에서 구독하기 버튼을 눌러 언론사를 구독해보세요.</p>
            </div>
          )}
          <div className="agency-management">
            <h3>언론사 관리</h3>
            <AgencySection />
          </div>
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