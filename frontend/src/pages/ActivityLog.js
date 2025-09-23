import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import AgencySection from '../components/AgencySection';
import './ActivityLog.css';

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, subscription, read, bookmark, comment, like, dislike
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({
    preferredCategories: [],
    preferredSources: []
  });
  const [categories, setCategories] = useState([]);
  const [mediaSources, setMediaSources] = useState([]);
  const navigate = useNavigate();

  // 토큰 만료 확인 함수
  const isTokenExpired = (token) => {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  };

  useEffect(() => {
    fetchActivities();
    fetchUserProfile();
    fetchCommonData();
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
      console.warn('활동 로그 조회 실패:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }

      if (!token || isTokenExpired(token)) {
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

  const fetchUserProfile = async () => {
    try {
      // 먼저 localStorage에서 데이터를 가져와서 즉시 설정
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const profile = JSON.parse(savedUser);
          setUserProfile(profile);
          setEditFormData({
            preferredCategories: profile.preferredCategories || [],
            preferredSources: profile.preferredSources || []
          });
        } catch (parseError) {
          console.error('localStorage 파싱 오류:', parseError);
        }
      }

      // 토큰이 있으면 API 호출하여 최신 정보 가져오기
      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }

      if (token && !isTokenExpired(token)) {
        // 1. 기본 프로필 정보 가져오기
        const profileResponse = await fetch('/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        // 2. 사용자 선호도 정보 가져오기
        const preferencesResponse = await fetch('/api/auth/preferences', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });


        if (profileResponse.ok) {
          const profileData = await profileResponse.json();

          if (preferencesResponse.ok) {
            const preferencesData = await preferencesResponse.json();

            if (profileData.success) {
              // 프로필과 선호도 데이터를 합치기
              const combinedProfile = {
                ...profileData.data.user,
                preferredCategories: preferencesData.success ? (preferencesData.data?.preferred_categories || []) : [],
                preferredSources: preferencesData.success ? (preferencesData.data?.preferred_sources || []) : []
              };


              setUserProfile(combinedProfile);
              setEditFormData({
                preferredCategories: combinedProfile.preferredCategories || [],
                preferredSources: combinedProfile.preferredSources || []
              });

              // localStorage 업데이트
              localStorage.setItem('user', JSON.stringify(combinedProfile));

              console.log('Profile loaded from API:', combinedProfile);
              console.log('Preferences data:', preferencesData.data);
            }
          } else {
            console.error('Preferences API failed:', preferencesResponse.status);
            // 선호도 API가 실패해도 기본 프로필은 표시
            if (profileData.success) {
              setUserProfile(profileData.data.user);
              setEditFormData({
                preferredCategories: [],
                preferredSources: []
              });
            }
          }
        } else {
          console.error('Profile API failed:', profileResponse.status);
        }
      }
    } catch (error) {
      console.error('프로필 조회 실패:', error);
    }
  };

  const fetchCommonData = async () => {
    try {
      const [categoriesResponse, sourcesResponse] = await Promise.all([
        fetch('/api/common/categories'),
        fetch('/api/common/media-sources')
      ]);

      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        if (categoriesData.success && categoriesData.data) {
          setCategories(categoriesData.data);
        }
      } else {
        setCategories(['정치', '경제', '사회', '생활/문화', 'IT/과학', '세계', '스포츠', '연예']);
      }

      if (sourcesResponse.ok) {
        const sourcesData = await sourcesResponse.json();
        if (sourcesData.success && sourcesData.data) {
          const sourceNames = sourcesData.data.map(source => source.name);
          setMediaSources(sourceNames);
        }
      } else {
        setMediaSources(['조선일보', 'KBS', 'SBS', 'MBC', '한겨레', '중앙일보', '동아일보', '경향신문', '연합뉴스', 'YTN']);
      }
    } catch (error) {
      console.error('공통 데이터 조회 실패:', error);
      setCategories(['정치', '경제', '사회', '생활/문화', 'IT/과학', '세계', '스포츠', '연예']);
      setMediaSources(['조선일보', 'KBS', 'SBS', 'MBC', '한겨레', '중앙일보', '동아일보', '경향신문', '연합뉴스', 'YTN']);
    }
  };

  const handleEditProfile = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    // 원래 데이터로 되돌리기
    if (userProfile) {
      setEditFormData({
        preferredCategories: userProfile.preferredCategories || [],
        preferredSources: userProfile.preferredSources || []
      });
    }
  };

  const handleSaveProfile = async () => {
    try {
      // 토큰 확인 (localStorage, sessionStorage 순서로)
      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }


      if (!token) {
        alert('로그인이 필요합니다.');
        return;
      }

      // 토큰 만료 확인
      if (isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
        return;
      }

      // user_preferences 테이블에 저장하기 위해 preferences API 사용
      const response = await fetch('/api/auth/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          preferredCategories: editFormData.preferredCategories,
          preferredSources: editFormData.preferredSources
        })
      });

      const data = await response.json();
      if (data.success) {
        // 성공시 로컬 상태 업데이트
        const updatedProfile = {
          ...userProfile,
          preferredCategories: editFormData.preferredCategories,
          preferredSources: editFormData.preferredSources
        };
        setUserProfile(updatedProfile);

        // localStorage 업데이트
        localStorage.setItem('user', JSON.stringify(updatedProfile));

        setIsEditMode(false);
        alert('프로필이 성공적으로 업데이트되었습니다.');

        // 최신 데이터로 다시 로드
        await fetchUserProfile();
      } else {
        alert(data.error || '프로필 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
      alert('서버 연결에 실패했습니다.');
    }
  };

  const handleCategoryChange = (category) => {
    setEditFormData(prev => ({
      ...prev,
      preferredCategories: prev.preferredCategories.includes(category)
        ? prev.preferredCategories.filter(c => c !== category)
        : [...prev.preferredCategories, category]
    }));
  };

  const handleSourceChange = (source) => {
    setEditFormData(prev => ({
      ...prev,
      preferredSources: prev.preferredSources.includes(source)
        ? prev.preferredSources.filter(s => s !== source)
        : [...prev.preferredSources, source]
    }));
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
      <div className="activity-log-container">
        <button
          className="back-to-main-btn"
          onClick={() => navigate('/')}
          title="메인페이지로 돌아가기"
        >
          🏠 메인으로
        </button>

        <div className="activity-main-content">
          <div className="activity-log-page">
            <div className="activity-header">
              <h1>📊 나의 활동 관리</h1>
              <p>최근 활동과 구독 중인 언론사를 관리하세요</p>
            </div>

        <div className="activity-filters">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => {
              try { setFilter('all'); } catch(e) { console.warn('Filter error:', e); }
            }}
          >
            전체
          </button>
          <button
            className={filter === 'subscription' ? 'active' : ''}
            onClick={() => {
              try { setFilter('subscription'); } catch(e) { console.warn('Filter error:', e); }
            }}
          >
            📰 구독
          </button>
          <button
            className={filter === 'read' ? 'active' : ''}
            onClick={() => {
              try { setFilter('read'); } catch(e) { console.warn('Filter error:', e); }
            }}
          >
            📖 읽기
          </button>
          <button
            className={filter === 'bookmark' ? 'active' : ''}
            onClick={() => {
              try { setFilter('bookmark'); } catch(e) { console.warn('Filter error:', e); }
            }}
          >
            🔖 북마크
          </button>
          <button
            className={filter === 'comment' ? 'active' : ''}
            onClick={() => {
              try { setFilter('comment'); } catch(e) { console.warn('Filter error:', e); }
            }}
          >
            💬 댓글
          </button>
          <button
            className={filter === 'like' ? 'active' : ''}
            onClick={() => {
              try { setFilter('like'); } catch(e) { console.warn('Filter error:', e); }
            }}
          >
            ❤️ 좋아요
          </button>
          <button
            className={filter === 'dislike' ? 'active' : ''}
            onClick={() => {
              try { setFilter('dislike'); } catch(e) { console.warn('Filter error:', e); }
            }}
          >
            👎 싫어요
          </button>
        </div>

        {filter === 'all' ? (
          <div className="all-content">

            <div className="profile-settings-info">
              <div className="profile-header">
                <h3>📋 프로필 설정 정보</h3>
                {!isEditMode ? (
                  <button className="edit-profile-btn" onClick={handleEditProfile}>
                    ✏️ 수정
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button className="save-btn" onClick={handleSaveProfile}>
                      💾 저장
                    </button>
                    <button className="cancel-btn" onClick={handleCancelEdit}>
                      ❌ 취소
                    </button>
                  </div>
                )}
              </div>

              {!isEditMode ? (
                <div className="profile-info-grid">
                  <div className="profile-section">
                    <h4>🏷️ 선호 카테고리</h4>
                    {userProfile?.preferredCategories && userProfile.preferredCategories.length > 0 ? (
                      <div className="category-tags">
                        {userProfile.preferredCategories.map(category => (
                          <span key={category} className="category-tag">{category}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="no-data">설정된 선호 카테고리가 없습니다. 수정 버튼을 눌러 설정해보세요.</p>
                    )}
                  </div>

                  <div className="profile-section">
                    <h4>📰 선호 언론사</h4>
                    {userProfile?.preferredSources && userProfile.preferredSources.length > 0 ? (
                      <div className="source-tags">
                        {userProfile.preferredSources.map(source => (
                          <span key={source} className="source-tag">{source}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="no-data">설정된 선호 언론사가 없습니다. 수정 버튼을 눌러 설정해보세요.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="profile-edit-form">
                  <div className="edit-section">
                    <h4>🏷️ 선호 카테고리</h4>
                    <div className="checkbox-grid">
                      {categories.map(category => (
                        <label key={category} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={editFormData.preferredCategories.includes(category)}
                            onChange={() => handleCategoryChange(category)}
                          />
                          <span>{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="edit-section">
                    <h4>📰 선호 언론사</h4>
                    <div className="checkbox-grid">
                      {mediaSources.map(source => (
                        <label key={source} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={editFormData.preferredSources.includes(source)}
                            onChange={() => handleSourceChange(source)}
                          />
                          <span>{source}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

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
          </div>
        ) : filter === 'subscription' ? (
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

          {/* 광고 영역 */}
          <aside className="activity-sidebar">
            <div className="sidebar-section">
              <h3 className="sidebar-title">광고</h3>

              {/* 메인 광고 배너 */}
              <div className="ad-banner main-ad">
                <div className="ad-content">
                  <div className="ad-badge">광고</div>
                  <h4 className="ad-title">프리미엄 뉴스 서비스</h4>
                  <p className="ad-description">더 깊이 있는 분석과 독점 뉴스를 만나보세요</p>
                  <button className="ad-button">지금 시작하기</button>
                </div>
              </div>

              {/* 작은 광고 카드들 */}
              <div className="ad-card">
                <div className="ad-badge small">광고</div>
                <div className="ad-card-content">
                  <h5>뉴스레터 구독</h5>
                  <p>매일 주요 뉴스를 이메일로 받아보세요</p>
                  <button className="ad-card-button">구독하기</button>
                </div>
              </div>

              <div className="ad-card">
                <div className="ad-badge small">광고</div>
                <div className="ad-card-content">
                  <h5>모바일 앱 다운로드</h5>
                  <p>언제 어디서나 뉴스를 확인하세요</p>
                  <button className="ad-card-button">다운로드</button>
                </div>
              </div>

              <div className="ad-card">
                <div className="ad-badge small">광고</div>
                <div className="ad-card-content">
                  <h5>프리미엄 구독</h5>
                  <p>광고 없는 깔끔한 뉴스 경험</p>
                  <button className="ad-card-button">구독하기</button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;