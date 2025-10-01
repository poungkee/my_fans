import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import SourceBiasChart from '../components/SourceBiasChart';
import ArticleAnalysis from '../components/ArticleAnalysis';
import './NewsDetailPage.css';

function NewsDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('comments');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  const API_BASE = process.env.REACT_APP_API_BASE || '';

  // 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = () => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const user = localStorage.getItem('user') || sessionStorage.getItem('user');
      setIsLoggedIn(!!token);

      if (user) {
        try {
          setCurrentUser(JSON.parse(user));
        } catch (error) {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    };

    checkLoginStatus();

    // 로그인 상태 변경 이벤트 리스너
    const handleLoginStatusChange = () => {
      checkLoginStatus();
    };

    window.addEventListener('loginStatusChange', handleLoginStatusChange);
    return () => {
      window.removeEventListener('loginStatusChange', handleLoginStatusChange);
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      try {
        setLoading(true);
        window.scrollTo(0, 0);
        const response = await fetch(`${API_BASE}/api/news/${id}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setArticle(data);

        // 기사 데이터에서 초기 카운트 설정
        if (data.like_count !== undefined) {
          setLikeCount(data.like_count);
        }
        if (data.dislike_count !== undefined) {
          setDislikeCount(data.dislike_count);
        }

        // 로그인 상태일 때 VIEW 액션 기록
        if (isLoggedIn) {
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          if (token) {
            fetch(`${API_BASE}/api/user/view/${id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                readingDuration: 0,
                readingPercentage: 0
              })
            }).catch(err => console.warn('VIEW 액션 기록 실패:', err));
          }
        }
      } catch (err) {
        console.error('기사 로드 실패:', err);
        setError('기사를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, API_BASE, isLoggedIn]);

  // 댓글, 좋아요/싫어요 상태, 구독 상태, 북마크 상태 로딩
  useEffect(() => {
    if (!id) return;

    const fetchComments = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/comments/article/${id}`);
        if (response.ok) {
          const result = await response.json();
          setComments(result.data || []);
        }
      } catch (error) {
        console.error('댓글 로드 실패:', error);
      }
    };

    const fetchUserReactions = async () => {
      try {
        if (!isLoggedIn) {
          // 비로그인 사용자는 사용자 상태만 초기화
          setIsLiked(false);
          setIsDisliked(false);
          return;
        }

        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/user/reactions/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // 사용자 반응 상태만 업데이트
            setIsLiked(result.data.isLiked || false);
            setIsDisliked(result.data.isDisliked || false);

            // 서버에서 최신 카운트도 업데이트
            setLikeCount(result.data.likeCount || 0);
            setDislikeCount(result.data.dislikeCount || 0);
          } else {
            // API 응답은 성공이지만 데이터 구조가 예상과 다름
            setIsLiked(false);
            setIsDisliked(false);
          }
        } else {
          // API 오류 시 사용자 상태만 기본값 설정
          setIsLiked(false);
          setIsDisliked(false);
        }
      } catch (error) {
        console.error('반응 상태 로드 실패:', error);
        setIsLiked(false);
        setIsDisliked(false);
      }
    };

    const fetchBookmarkStatus = async () => {
      try {
        if (!isLoggedIn) {
          setIsBookmarked(false);
          return;
        }

        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/news/${id}/bookmark-status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          setIsBookmarked(result.isBookmarked || false);
        } else {
          setIsBookmarked(false);
        }
      } catch (error) {
        console.error('북마크 상태 로드 실패:', error);
        setIsBookmarked(false);
      }
    };

    const fetchSubscriptionStatus = async () => {
      try {
        if (!isLoggedIn || !article?.source) {
          setIsSubscribed(false);
          return;
        }

        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/user/status/${encodeURIComponent(article.source)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.ok) {
            setIsSubscribed(result.isSubscribed || false);
          } else {
            setIsSubscribed(false);
          }
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error('구독 상태 로드 실패:', error);
        setIsSubscribed(false);
      }
    };

    fetchComments();
    fetchUserReactions();
    fetchBookmarkStatus();
    fetchSubscriptionStatus();
  }, [id, API_BASE, isLoggedIn, article?.source]);

  const handleBookmark = async () => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');

      // 애니메이션 효과 추가
      const bookmarkButton = document.querySelector('.icon-button.bookmark');
      if (bookmarkButton) {
        bookmarkButton.classList.add('animate');
        setTimeout(() => {
          bookmarkButton.classList.remove('animate');
        }, 800);
      }

      if (isBookmarked) {
        // 북마크 해제
        const response = await fetch(`${API_BASE}/api/user/bookmark/${id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'remove'
          })
        });

        console.log('북마크 해제 응답 상태:', response.status);
        if (response.ok) {
          const result = await response.json();
          console.log('북마크 해제 응답 데이터:', result);
          if (result.success) {
            setIsBookmarked(false);
            alert(result.message || '북마크가 해제되었습니다.');
          } else {
            alert(result.error || '북마크 해제에 실패했습니다.');
          }
        } else {
          let errorMessage = '북마크 해제에 실패했습니다.';
          try {
            const errorData = await response.json();
            console.log('북마크 해제 에러 데이터:', errorData);
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
          alert(errorMessage);
        }
      } else {
        // 북마크 추가
        const response = await fetch(`${API_BASE}/api/user/bookmark/${id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'add'
          })
        });

        console.log('북마크 추가 응답 상태:', response.status);
        if (response.ok) {
          const result = await response.json();
          console.log('북마크 추가 응답 데이터:', result);
          if (result.success) {
            setIsBookmarked(true);
            alert(result.message || '북마크가 완료되었습니다.');
          } else {
            alert(result.error || '북마크에 실패했습니다.');
          }
        } else {
          let errorMessage = '북마크에 실패했습니다.';
          try {
            const errorData = await response.json();
            console.log('북마크 추가 에러 데이터:', errorData);
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
          alert(errorMessage);
        }
      }
    } catch (error) {
      console.error('북마크 처리 실패:', error);
      alert('네트워크 오류가 발생했습니다.');
    }
  };

  const handleSubscribe = async () => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (!article?.source) {
      alert('언론사 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');

      if (isSubscribed) {
        // 구독 취소
        const response = await fetch(`${API_BASE}/api/user/unsubscribe`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sourceName: article.source
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.ok) {
            setIsSubscribed(false);
            alert(result.message || '구독이 취소되었습니다.');
          } else {
            alert(result.error || '구독 취소에 실패했습니다.');
          }
        } else {
          const errorData = await response.json();
          alert(errorData.error || '구독 취소에 실패했습니다.');
        }
      } else {
        // 구독하기
        const response = await fetch(`${API_BASE}/api/user/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sourceName: article.source
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.ok) {
            setIsSubscribed(true);
            alert(result.message || '구독이 완료되었습니다.');
          } else {
            alert(result.error || '구독에 실패했습니다.');
          }
        } else {
          const errorData = await response.json();
          alert(errorData.error || '구독에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('구독 처리 실패:', error);
      alert('네트워크 오류가 발생했습니다.');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.title,
          url: window.location.href
        });
      } catch (error) {
        // 사용자가 취소한 경우 (AbortError) 무시
        if (error.name !== 'AbortError') {
          console.error('공유 실패:', error);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('링크가 클립보드에 복사되었습니다.');
      } catch (error) {
        console.error('클립보드 복사 실패:', error);
      }
    }
  };

  const handleLike = async () => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    console.log('🔥 좋아요 버튼 클릭 - 현재 상태:', { isLiked, isDisliked, likeCount, dislikeCount });

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        alert('로그인이 필요합니다.');
        return;
      }

      // API 호출로 서버에서 상태 처리
      const response = await fetch(`${API_BASE}/api/user/reaction/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'like'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🔥 좋아요 API 응답:', result);

        if (result.success) {
          // 서버 응답으로 UI 업데이트
          setLikeCount(result.data.likeCount);
          setDislikeCount(result.data.dislikeCount);

          // 좋아요 상태 업데이트 (서버에서 토글 처리됨)
          if (result.action === 'added') {
            console.log('🔥 좋아요 추가됨');
            setIsLiked(true);
            setIsDisliked(false); // 좋아요 시 싫어요 해제
          } else if (result.action === 'removed') {
            console.log('🔥 좋아요 제거됨');
            setIsLiked(false);
          }
        } else {
          console.error('좋아요 API 응답 에러:', result.error);
          alert(result.error || '좋아요 처리 중 오류가 발생했습니다.');
        }
      } else {
        const errorData = await response.json();
        console.error('좋아요 API 에러:', errorData);
        alert(errorData.error || '좋아요 처리 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('좋아요 처리 실패:', error);
      alert('네트워크 오류가 발생했습니다.');
    }
  };

  const handleDislike = async () => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    console.log('🔥 싫어요 버튼 클릭 - 현재 상태:', { isLiked, isDisliked, likeCount, dislikeCount });

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        alert('로그인이 필요합니다.');
        return;
      }

      // API 호출로 서버에서 상태 처리
      const response = await fetch(`${API_BASE}/api/user/reaction/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'dislike'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🔥 싫어요 API 응답:', result);

        if (result.success) {
          // 서버 응답으로 UI 업데이트
          setLikeCount(result.data.likeCount);
          setDislikeCount(result.data.dislikeCount);

          // 싫어요 상태 업데이트 (서버에서 토글 처리됨)
          if (result.action === 'added') {
            console.log('🔥 싫어요 추가됨');
            setIsDisliked(true);
            setIsLiked(false); // 싫어요 시 좋아요 해제
          } else if (result.action === 'removed') {
            console.log('🔥 싫어요 제거됨');
            setIsDisliked(false);
          }
        } else {
          console.error('싫어요 API 응답 에러:', result.error);
          alert(result.error || '싫어요 처리 중 오류가 발생했습니다.');
        }
      } else {
        const errorData = await response.json();
        console.error('싫어요 API 에러:', errorData);
        alert(errorData.error || '싫어요 처리 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('싫어요 처리 실패:', error);
      alert('네트워크 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
  };

  const handleAddComment = async () => {
    console.log('🔥 댓글 작성 시작 - isLoggedIn:', isLoggedIn);

    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      console.log('🔥 토큰 확인:', token ? 'EXISTS' : 'MISSING');
      const response = await fetch(`${API_BASE}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          articleId: id,
          content: newComment.trim()
        })
      });

      console.log('🔥 API 응답 상태:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('🔥 댓글 작성 성공:', result);
        setComments(prev => [...prev, result.data]);
        setNewComment('');
      } else {
        const errorText = await response.text();
        console.log('🔥 API 에러 응답:', errorText);
        throw new Error('댓글 작성에 실패했습니다.');
      }
    } catch (error) {
      console.error('🔥 댓글 작성 실패:', error);
      alert('댓글 작성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleDeleteComment = async (commentId, isReply = false, parentId = null) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setComments(prev => {
          if (!isReply) {
            // 메인 댓글 삭제
            return prev.filter(comment => comment.id !== commentId);
          } else {
            // 답글 삭제
            return prev.map(comment => {
              if (comment.id === parentId) {
                return {
                  ...comment,
                  replies: comment.replies.filter(reply => reply.id !== commentId)
                };
              }
              return comment;
            });
          }
        });
      } else {
        throw new Error('댓글 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      alert('댓글 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleReply = (commentId) => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setReplyingTo(commentId);
    setReplyText('');
  };

  const handleAddReply = async (parentId) => {
    if (!replyText.trim()) return;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          articleId: id,
          content: replyText.trim(),
          parentId: parentId
        })
      });

      if (response.ok) {
        const result = await response.json();
        setComments(prev => prev.map(comment => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), result.data]
            };
          }
          return comment;
        }));

        setReplyText('');
        setReplyingTo(null);
      } else {
        throw new Error('답글 작성에 실패했습니다.');
      }
    } catch (error) {
      console.error('답글 작성 실패:', error);
      alert('답글 작성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  // Header 핸들러 함수들
  const handleSortChange = (sortType, displayText) => {
    // NewsDetail 페이지에서는 정렬 기능이 필요없지만 Header에서 필요로 함
    console.log('Sort changed:', sortType, displayText);
  };

  const handleSearch = (query) => {
    // 검색 기능 - 메인 페이지로 이동하면서 검색어 전달
    if (query && query.trim()) {
      navigate(`/?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleCategoryFilter = (category) => {
    // 카테고리 필터 - 메인 페이지로 이동하면서 카테고리 전달
    navigate(`/?category=${encodeURIComponent(category)}`);
  };

  const handleSourceFilter = (sourceName) => {
    // 언론사 필터 - 메인 페이지로 이동하면서 언론사 전달
    navigate(`/?source=${encodeURIComponent(sourceName)}`);
  };

  if (loading) {
    return (
      <div className="news-detail-container">
        <div className="loading">기사를 불러오는 중...</div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="news-detail-container">
        <div className="error">
          <p>{error || '기사를 찾을 수 없습니다.'}</p>
          <button onClick={() => navigate('/')} className="back-button">
            메인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="news-detail-container">
      {/* 헤더 */}
      <Header
        onSortChange={handleSortChange}
        onSearch={handleSearch}
        selectedSort="최신순"
        onCategoryFilter={handleCategoryFilter}
        onSourceFilter={handleSourceFilter}
      />

      <div className="news-content-wrapper">
        <div className="main-article-area">
          {/* 뒤로 가기 버튼 */}
          <div className="back-navigation">
            <button className="back-icon-button" onClick={() => {
              const from = location.state?.from;
              const scrollY = location.state?.scrollY;

              if (from) {
                navigate(from, { replace: true });
                // 스크롤 위치 복원
                if (scrollY !== undefined) {
                  setTimeout(() => {
                    window.scrollTo(0, scrollY);
                  }, 100);
                }
              } else {
                navigate('/', { replace: true });
              }
            }} title="뒤로 가기">
              ←
            </button>
          </div>

          {/* 기사 제목 */}
          <div className="article-header">
            <h1 className="article-title">{article.title}</h1>
          </div>

          {/* 기사 메타 정보 */}
          <div className="article-meta-info">
            <div className="meta-left">
              <span className="news-source">{article.source || article.agency}</span>
              {article.journalist && <span className="journalist-name">{article.journalist}</span>}
            </div>
            <div className="meta-right">
              <span className="publish-time">{formatDate(article.pub_date)}</span>
              <span className="update-time">수정 {formatDate(article.updated_at)}</span>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="action-bar">
            <div className="social-buttons">
              <button
                className={`icon-button subscribe ${isSubscribed ? 'subscribed' : ''}`}
                onClick={handleSubscribe}
                title={!isLoggedIn ? '로그인이 필요합니다' : (isSubscribed ? `${article?.source} 구독 취소` : `${article?.source} 구독하기`)}
                disabled={!isLoggedIn}
              >
                {isSubscribed ? '📧✓' : '📧'}
              </button>
              <button
                className={`icon-button bookmark ${isBookmarked ? 'bookmarked' : ''}`}
                onClick={handleBookmark}
                title={!isLoggedIn ? '로그인이 필요합니다' : (isBookmarked ? '북마크 해제' : '북마크 추가')}
                disabled={!isLoggedIn}
              >
                <span className="bookmark-icon">
                  {isBookmarked ? '🔖' : '🔗'}
                </span>
              </button>
              <button className="icon-button share" onClick={handleShare} title="공유">
                📤
              </button>
              <button
                className={`icon-button like ${isLiked ? 'active' : ''}`}
                onClick={handleLike}
                title={!isLoggedIn ? '로그인이 필요합니다' : (isLiked ? '좋아요 취소' : '좋아요')}
                disabled={!isLoggedIn}
              >
                👍 {likeCount}
              </button>
              <button
                className={`icon-button dislike ${isDisliked ? 'active' : ''}`}
                onClick={handleDislike}
                title={!isLoggedIn ? '로그인이 필요합니다' : (isDisliked ? '싫어요 취소' : '싫어요')}
                disabled={!isLoggedIn}
              >
                👎 {dislikeCount}
              </button>
            </div>
          </div>

          {/* 기사 이미지 */}
          {article.image_url && (
            <div className="article-image-wrapper">
              <img
                src={article.image_url}
                alt={article.title}
                className="main-article-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* 기사 본문 */}
          <div className="article-body">
            {article.ai_summary && (
              <div className="article-summary-box">
                <strong>AI 요약: </strong>
                {article.ai_summary}
              </div>
            )}

            <div className="article-content-text">
              {article.content && article.content.trim().length > 0 ? (
                article.content.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  <p>기사 본문을 불러올 수 없습니다.</p>
                  <p>원본 기사는 <a href={article.url} target="_blank" rel="noopener noreferrer">여기</a>에서 확인하실 수 있습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* 댓글 섹션 */}
          <div className="comments-section">
            <div className="comments-tabs">
              <button
                className={`comments-tab ${activeTab === 'comments' ? 'active' : ''}`}
                onClick={() => setActiveTab('comments')}
              >
                댓글
              </button>
              <button
                className={`comments-tab ${activeTab === 'media-info' ? 'active' : ''}`}
                onClick={() => setActiveTab('media-info')}
              >
                언론사정보
              </button>
              <button
                className={`comments-tab ${activeTab === 'analysis' ? 'active' : ''}`}
                onClick={() => setActiveTab('analysis')}
              >
                분석
              </button>
            </div>

            <div className="comments-content">
              {activeTab === 'comments' && (
                <div className="comments-area">
                  <div className="comment-write">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={isLoggedIn ? "댓글을 입력하세요..." : "로그인 후 댓글을 작성할 수 있습니다"}
                      rows="4"
                      disabled={!isLoggedIn}
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!isLoggedIn || !newComment.trim()}
                    >
                      {isLoggedIn ? '댓글쓰기' : '로그인 필요'}
                    </button>
                  </div>

                  <div className="comments-list">
                    {comments.map(comment => (
                      <div key={comment.id} className="comment">
                        <div className="comment-info">
                          <strong className="commenter-name">{comment.author}</strong>
                          <span className="comment-time">{comment.timestamp}</span>
                        </div>
                        <p className="comment-text">{comment.content}</p>
                        <div className="comment-actions">
                          <button
                            className="reply-button"
                            onClick={() => handleReply(comment.id)}
                          >
                            답글
                          </button>
                          {currentUser && currentUser.username === comment.author && (
                            <button
                              className="delete-button"
                              onClick={() => handleDeleteComment(comment.id)}
                            >
                              삭제
                            </button>
                          )}
                        </div>

                        {/* 답글 작성 폼 */}
                        {replyingTo === comment.id && (
                          <div className="reply-write">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="답글을 입력하세요..."
                              rows="3"
                            />
                            <div className="reply-buttons">
                              <button
                                onClick={() => handleAddReply(comment.id)}
                                disabled={!replyText.trim()}
                                className="reply-submit-btn"
                              >
                                답글 작성
                              </button>
                              <button
                                onClick={handleCancelReply}
                                className="reply-cancel-btn"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        )}

                        {comment.replies.length > 0 && (
                          <div className="replies">
                            {comment.replies.map(reply => (
                              <div key={reply.id} className="reply">
                                <div className="comment-info">
                                  <strong className="commenter-name">{reply.author}</strong>
                                  <span className="comment-time">{reply.timestamp}</span>
                                </div>
                                <p className="comment-text">{reply.content}</p>
                                <div className="comment-actions">
                                  {currentUser && currentUser.username === reply.author && (
                                    <button
                                      className="delete-button"
                                      onClick={() => handleDeleteComment(reply.id, true, comment.id)}
                                    >
                                      삭제
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'media-info' && (
                <div className="media-info">
                  <div className="media-info-section">
                    <h4>언론사 정보</h4>
                    <div className="media-details">
                      <div className="info-item">
                        <strong>언론사:</strong> {article.source || article.agency}
                      </div>
                      <div className="info-item">
                        <strong>기자:</strong> {article.journalist || '정보 없음'}
                      </div>
                      <div className="info-item">
                        <strong>발행일:</strong> {formatDate(article.pub_date)}
                      </div>
                      <div className="info-item">
                        <strong>수정일:</strong> {formatDate(article.updated_at)}
                      </div>
                      {article.url && (
                        <div className="info-item">
                          <strong>원문:</strong>
                          <a href={article.url} target="_blank" rel="noopener noreferrer">
                            기사 원문 보기
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 언론사 편향성 차트 추가 */}
                  <div className="media-bias-section">
                    <SourceBiasChart articleSource={article.source || article.agency} />
                  </div>
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="analysis-info">
                  <ArticleAnalysis articleId={id} articleContent={article.content} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 사이드바 */}
        <div className="news-sidebar">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}

export default NewsDetailPage;