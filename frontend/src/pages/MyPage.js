import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MyPage.css';

const MyPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [likedNews, setLikedNews] = useState([]);
  const [comments, setComments] = useState([]);
  const [activeTab, setActiveTab] = useState('likes');
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 사용자 정보 로드
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        
        // 토큰 확인
        let token = localStorage.getItem('token');
        if (!token) {
          token = sessionStorage.getItem('token');
        }
        
        if (!token) {
          navigate('/login');
          return;
        }

        // 사용자 프로필 정보 가져오기
        const response = await fetch('/api/auth/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.data.user);
        } else if (response.status === 401) {
          // 토큰이 만료된 경우
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          navigate('/login');
          return;
        } else {
          throw new Error('사용자 정보를 가져올 수 없습니다.');
        }

        // 북마크, 좋아요, 댓글 데이터 로드
        await loadUserInteractions(token);
        
      } catch (err) {
        console.error('사용자 데이터 로드 에러:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [navigate]);

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        navigate('/');
      }
    } catch (error) {
      console.error('로그아웃 에러:', error);
      // 에러가 발생해도 로컬 스토리지는 정리
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      navigate('/');
    }
  };

  // 사용자 상호작용 데이터 로드
  const loadUserInteractions = async (token) => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // 북마크 데이터 로드
      const bookmarksResponse = await fetch('/api/user/bookmarks', {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      if (bookmarksResponse.ok) {
        const bookmarksData = await bookmarksResponse.json();
        setBookmarks(bookmarksData.data.bookmarks);
      }

      // 좋아요 데이터 로드
      const likesResponse = await fetch('/api/user/likes', {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      if (likesResponse.ok) {
        const likesData = await likesResponse.json();
        setLikedNews(likesData.data.likes);
      }

      // 댓글 데이터 로드
      const commentsResponse = await fetch('/api/user/comments', {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json();
        setComments(commentsData.data.comments);
      }
    } catch (err) {
      console.error('사용자 상호작용 데이터 로드 에러:', err);
    }
  };

  // 날짜 포맷팅 함수
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 상대 시간 포맷팅 함수
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}일 전`;
    return formatDate(dateString);
  };

  // 프로필 이미지 업로드
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 파일 타입 체크
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('이미지 파일만 업로드 가능합니다. (JPEG, PNG, GIF, WebP)');
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('profileImage', file);

      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }

      const response = await fetch('/api/auth/upload-profile-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
        
        // localStorage와 sessionStorage의 사용자 정보도 업데이트
        const updatedUser = data.data.user;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        
        // 헤더 컴포넌트에 변경 알림
        window.dispatchEvent(new CustomEvent('loginStatusChange'));
        
        alert('프로필 이미지가 성공적으로 업로드되었습니다.');
        setShowImageUpload(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '이미지 업로드에 실패했습니다.');
      }
    } catch (err) {
      console.error('이미지 업로드 에러:', err);
      alert(err.message || '이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 프로필 이미지 삭제
  const handleImageDelete = async () => {
    if (!user.profile_image) return;
    
    if (!confirm('프로필 이미지를 삭제하시겠습니까?')) return;

    try {
      setUploading(true);
      
      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }

      const response = await fetch('/api/auth/delete-profile-image', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const updatedUser = { ...user, profile_image: null };
        setUser(updatedUser);
        
        // localStorage와 sessionStorage의 사용자 정보도 업데이트
        localStorage.setItem('user', JSON.stringify(updatedUser));
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        
        // 헤더 컴포넌트에 변경 알림
        window.dispatchEvent(new CustomEvent('loginStatusChange'));
        
        alert('프로필 이미지가 성공적으로 삭제되었습니다.');
        setShowImageUpload(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '이미지 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('이미지 삭제 에러:', err);
      alert(err.message || '이미지 삭제 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };


  if (loading) {
    return (
      <div className="mypage-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mypage-container">
        <div className="error">오류: {error}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mypage-container">
        <div className="error">사용자 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="mypage-container">
      <div className="mypage-header">
        <button 
          className="back-button" 
          onClick={() => navigate('/')}
        >
          ← 홈으로
        </button>
        <h1>마이페이지</h1>
      </div>

      <div className="mypage-content">
        {/* 회원정보 섹션 */}
        <section className="user-info-section">
          <h2>📋 회원정보</h2>
          <div className="user-info-card">
            <div className="user-avatar">
              {user.profile_image ? (
                <img 
                  src={user.profile_image} 
                  alt="프로필 이미지" 
                  className="profile-image"
                />
              ) : (
                <div className="avatar-placeholder">
                  {user.name ? user.name.charAt(0).toUpperCase() : '👤'}
                </div>
              )}
            </div>
            <div className="user-details">
              <div className="user-name">{user.name || user.username}</div>
              <div className="user-email">{user.email}</div>
              
              {/* 기본 정보 그리드 */}
              <div className="user-info-grid">
                <div className="info-card">
                  <div className="info-icon">👤</div>
                  <div className="info-content">
                    <div className="info-label">아이디</div>
                    <div className="info-value">{user.username}</div>
                  </div>
                </div>
                
                {user.phone && (
                  <div className="info-card">
                    <div className="info-icon">📱</div>
                    <div className="info-content">
                      <div className="info-label">연락처</div>
                      <div className="info-value">{user.phone}</div>
                    </div>
                  </div>
                )}
                
                {user.age && (
                  <div className="info-card">
                    <div className="info-icon">🎂</div>
                    <div className="info-content">
                      <div className="info-label">나이</div>
                      <div className="info-value">{user.age}세</div>
                    </div>
                  </div>
                )}
                
                {user.gender && (
                  <div className="info-card">
                    <div className="info-icon">⚥</div>
                    <div className="info-content">
                      <div className="info-label">성별</div>
                      <div className="info-value">{user.gender}</div>
                    </div>
                  </div>
                )}
                
                {user.location && (
                  <div className="info-card">
                    <div className="info-icon">📍</div>
                    <div className="info-content">
                      <div className="info-label">지역</div>
                      <div className="info-value">{user.location}</div>
                    </div>
                  </div>
                )}
                
                <div className="info-card">
                  <div className="info-icon">🔐</div>
                  <div className="info-content">
                    <div className="info-label">로그인 방식</div>
                    <div className="info-value">
                      {user.provider === 'local' ? '일반 로그인' : 
                       user.provider === 'kakao' ? '카카오 로그인' : 
                       user.provider === 'naver' ? '네이버 로그인' : '일반 로그인'}
                    </div>
                  </div>
                </div>
                
                <div className="info-card">
                  <div className="info-icon">📅</div>
                  <div className="info-content">
                    <div className="info-label">가입일</div>
                    <div className="info-value">{formatDate(user.created_at)}</div>
                  </div>
                </div>
                
                {user.last_login && (
                  <div className="info-card">
                    <div className="info-icon">🕒</div>
                    <div className="info-content">
                      <div className="info-label">마지막 로그인</div>
                      <div className="info-value">{formatDate(user.last_login)}</div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 관심사 섹션 */}
              {(user.preferred_categories && user.preferred_categories.length > 0) && (
                <div className="preferences-section">
                  <h4>🎯 관심 카테고리</h4>
                  <div className="preference-tags">
                    {user.preferred_categories.map((category, index) => (
                      <span key={index} className="preference-tag">{category}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {(user.preferred_media_sources && user.preferred_media_sources.length > 0) && (
                <div className="preferences-section">
                  <h4>📰 선호 언론사</h4>
                  <div className="preference-tags">
                    {user.preferred_media_sources.map((source, index) => (
                      <span key={index} className="preference-tag">{source}</span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="profile-actions">
                <button 
                  className="edit-profile-btn"
                  onClick={() => setShowImageUpload(!showImageUpload)}
                >
                  {user.profile_image ? '🖼️ 프로필 이미지 변경' : '➕ 프로필 이미지 추가'}
                </button>
                {user.profile_image && (
                  <button 
                    className="delete-image-btn"
                    onClick={handleImageDelete}
                    disabled={uploading}
                  >
                    🗑️ 이미지 삭제
                  </button>
                )}
              </div>
              
              {/* 프로필 이미지 업로드 섹션 */}
              {showImageUpload && (
                <div className="image-upload-section">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    style={{ display: 'none' }}
                    id="profile-image-input"
                  />
                  <label htmlFor="profile-image-input" className="upload-label">
                    {uploading ? '업로드 중...' : '📁 이미지 선택'}
                  </label>
                  <p className="upload-info">
                    이미지 파일만 업로드 가능합니다. (JPEG, PNG, GIF, WebP, 최대 5MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 북마크 뉴스 섹션 */}
        <section className="bookmark-section">
          <h2>북마크한 뉴스 ({bookmarks.length})</h2>
          <div className="bookmark-list">
            {bookmarks.length > 0 ? (
              bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="bookmark-item">
                  <div className="bookmark-news">
                    <h3>{bookmark.title}</h3>
                    <p>{bookmark.summary || '요약 정보가 없습니다.'}</p>
                    <div className="news-meta">
                      <span className="news-source">{bookmark.mediaSource}</span>
                      <span className="news-date">{formatRelativeTime(bookmark.bookmarkedAt)}</span>
                    </div>
                  </div>
                  <button 
                    className="remove-bookmark-btn"
                    onClick={() => window.open(bookmark.url, '_blank')}
                  >
                    기사 보기
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>북마크한 뉴스가 없습니다.</p>
                <p>관심 있는 뉴스를 북마크해보세요!</p>
              </div>
            )}
          </div>
        </section>

        {/* 좋아요/댓글 기록 섹션 */}
        <section className="activity-section">
          <h2>활동 기록</h2>
          <div className="activity-tabs">
            <button 
              className={`tab-button ${activeTab === 'likes' ? 'active' : ''}`}
              onClick={() => setActiveTab('likes')}
            >
              좋아요 ({likedNews.length})
            </button>
            <button 
              className={`tab-button ${activeTab === 'comments' ? 'active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              댓글 ({comments.length})
            </button>
          </div>
          
          <div className="activity-content">
            {activeTab === 'likes' ? (
              <div className="liked-news">
                <h3>좋아요한 뉴스</h3>
                {likedNews.length > 0 ? (
                  likedNews.map((like) => (
                    <div key={like.id} className="liked-item">
                      <h4>{like.title}</h4>
                      <p>{like.summary || '요약 정보가 없습니다.'}</p>
                      <div className="news-meta">
                        <span className="news-source">{like.mediaSource}</span>
                        <span className="news-date">{formatRelativeTime(like.likedAt)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>좋아요한 뉴스가 없습니다.</p>
                    <p>마음에 드는 뉴스에 좋아요를 눌러보세요!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="comments-news">
                <h3>작성한 댓글</h3>
                {comments.length > 0 ? (
                  comments.map((comment) => (
                    <div key={comment.id} className="comment-item">
                      <div className="comment-content">
                        <p>{comment.content}</p>
                        <div className="comment-meta">
                          <span className="comment-date">{formatRelativeTime(comment.createdAt)}</span>
                        </div>
                      </div>
                      <div className="comment-news">
                        <h4>{comment.news.title}</h4>
                        <div className="news-meta">
                          <span className="news-source">{comment.news.mediaSource}</span>
                          <span className="news-date">{formatRelativeTime(comment.news.pubDate)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>작성한 댓글이 없습니다.</p>
                    <p>뉴스에 댓글을 남겨보세요!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 구독 섹션 */}
        <section className="subscription-section">
          <h2>구독 관리</h2>
          <div className="subscription-list">
            <div className="subscription-item">
              <div className="subscription-info">
                <h3>경제 뉴스레터</h3>
                <p>매일 오전 9시 경제 관련 주요 뉴스를 전달합니다.</p>
              </div>
              <div className="subscription-status">
                <span className="status-badge active">구독중</span>
                <button className="unsubscribe-btn">구독 해지</button>
              </div>
            </div>
            
            <div className="subscription-item">
              <div className="subscription-info">
                <h3>IT/과학 뉴스레터</h3>
                <p>주 3회 IT와 과학 분야의 최신 소식을 전달합니다.</p>
              </div>
              <div className="subscription-status">
                <span className="status-badge active">구독중</span>
                <button className="unsubscribe-btn">구독 해지</button>
              </div>
            </div>
            
            <div className="subscription-item">
              <div className="subscription-info">
                <h3>정치 뉴스레터</h3>
                <p>정치 동향과 주요 이슈를 분석하여 전달합니다.</p>
              </div>
              <div className="subscription-status">
                <span className="status-badge inactive">구독 안함</span>
                <button className="subscribe-btn">구독하기</button>
              </div>
            </div>
          </div>
        </section>

        {/* 회원탈퇴 섹션 */}
        <section className="delete-account-section">
          <h2>계정 관리</h2>
          <div className="delete-account-card">
            <div className="delete-account-info">
              <h3>회원탈퇴</h3>
              <p>계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.</p>
              <ul className="delete-warning-list">
                <li>• 모든 개인정보가 삭제됩니다</li>
                <li>• 북마크, 좋아요, 댓글 기록이 삭제됩니다</li>
                <li>• 탈퇴 후 동일한 이메일로 재가입이 제한될 수 있습니다</li>
              </ul>
            </div>
            <div className="delete-account-actions">
              <button 
                className="delete-account-btn"
                onClick={() => navigate('/delete-account')}
                disabled={uploading}
                type="button"
              >
                회원탈퇴
              </button>
            </div>
          </div>

        </section>
      </div>
    </div>
  );
};

export default MyPage;
