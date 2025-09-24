import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
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
      setIsLoggedIn(!!token);
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
      } catch (err) {
        console.error('기사 로드 실패:', err);
        setError('기사를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, API_BASE]);

  const handleBookmark = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        alert('로그인이 필요합니다.');
        return;
      }

      const response = await fetch(`${API_BASE}/api/user/bookmark/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: isBookmarked ? 'remove' : 'add'
        })
      });

      if (response.ok) {
        setIsBookmarked(!isBookmarked);
      }
    } catch (err) {
      console.error('북마크 처리 실패:', err);
    }
  };

  const handleSubscribe = () => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setIsSubscribed(!isSubscribed);
    // TODO: 구독 API 연동
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article?.title,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('링크가 클립보드에 복사되었습니다.');
    }
  };

  const handleLike = () => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (isLiked) {
      // 좋아요 취소
      setIsLiked(false);
      setLikeCount(prev => prev - 1);
    } else {
      // 좋아요 추가
      setIsLiked(true);
      setLikeCount(prev => prev + 1);

      // 싫어요가 눌려있다면 해제
      if (isDisliked) {
        setIsDisliked(false);
        setDislikeCount(prev => prev - 1);
      }
    }
  };

  const handleDislike = () => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (isDisliked) {
      // 싫어요 취소
      setIsDisliked(false);
      setDislikeCount(prev => prev - 1);
    } else {
      // 싫어요 추가
      setIsDisliked(true);
      setDislikeCount(prev => prev + 1);

      // 좋아요가 눌려있다면 해제
      if (isLiked) {
        setIsLiked(false);
        setLikeCount(prev => prev - 1);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
  };

  const handleCommentLike = (commentId, isReply = false, parentId = null) => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    setComments(prev => prev.map(comment => {
      if (!isReply && comment.id === commentId) {
        return {
          ...comment,
          likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
          isLiked: !comment.isLiked
        };
      }
      if (isReply && comment.id === parentId) {
        return {
          ...comment,
          replies: comment.replies.map(reply => {
            if (reply.id === commentId) {
              return {
                ...reply,
                likes: reply.isLiked ? reply.likes - 1 : reply.likes + 1,
                isLiked: !reply.isLiked
              };
            }
            return reply;
          })
        };
      }
      return comment;
    }));
  };

  const handleAddComment = () => {
    if (!isLoggedIn) {
      alert('로그인이 필요한 서비스입니다.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (!newComment.trim()) return;

    // 저장된 사용자 정보 가져오기
    const userInfo = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
    const username = userInfo.username || '익명 사용자';

    const comment = {
      id: Date.now(),
      author: username,
      content: newComment,
      timestamp: new Date().toLocaleString('ko-KR'),
      likes: 0,
      isLiked: false,
      replies: []
    };

    setComments(prev => [...prev, comment]);
    setNewComment('');
  };

  const handleDeleteComment = (commentId, isReply = false, parentId = null) => {
    if (window.confirm('댓글을 삭제하시겠습니까?')) {
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

  const handleAddReply = (parentId) => {
    if (!replyText.trim()) return;

    // 저장된 사용자 정보 가져오기
    const userInfo = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
    const username = userInfo.username || '익명 사용자';

    const reply = {
      id: Date.now(),
      author: username,
      content: replyText,
      timestamp: new Date().toLocaleString('ko-KR'),
      likes: 0,
      isLiked: false
    };

    setComments(prev => prev.map(comment => {
      if (comment.id === parentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), reply]
        };
      }
      return comment;
    }));

    setReplyText('');
    setReplyingTo(null);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
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
      <Header />

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
                title={!isLoggedIn ? '로그인이 필요합니다' : (isSubscribed ? '구독중' : '구독하기')}
                disabled={!isLoggedIn}
              >
                📧
              </button>
              <button className="icon-button share" onClick={handleShare} title="공유">
                📤
              </button>
              <button
                className={`icon-button like ${isLiked ? 'active' : ''}`}
                onClick={handleLike}
                title={!isLoggedIn ? '로그인이 필요합니다' : '좋아요'}
                disabled={!isLoggedIn}
              >
                👍 {likeCount}
              </button>
              <button
                className={`icon-button dislike ${isDisliked ? 'active' : ''}`}
                onClick={handleDislike}
                title={!isLoggedIn ? '로그인이 필요합니다' : '싫어요'}
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
              {article.content ? (
                article.content.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))
              ) : (
                <>
                  <p>최근 발표된 연구 결과에 따르면, 인공지능 기술의 발전이 다양한 산업 분야에서 혁신적인 변화를 이끌어내고 있다고 밝혔습니다.</p>
                  <p>특히 의료, 금융, 교육 등의 분야에서 AI 기술의 활용도가 급격히 증가하고 있으며, 이는 기존의 업무 방식과 서비스 제공 방식에 근본적인 변화를 가져오고 있습니다.</p>
                  <p>의료 분야에서는 AI를 활용한 진단 시스템이 의사들의 정확한 진단을 돕고 있으며, 환자 개개인에게 맞춤형 치료법을 제공하는 데 큰 도움을 주고 있습니다.</p>
                  <p>금융업계에서는 AI 기반의 위험 관리 시스템과 자동화된 투자 상담 서비스가 고객들에게 더 나은 금융 서비스를 제공하고 있습니다.</p>
                  <p>교육 분야에서도 AI 기술의 도입으로 개인화된 학습 경험이 가능해지고 있습니다. 학습자의 수준과 선호도를 분석하여 최적화된 학습 콘텐츠를 제공하고 있습니다.</p>
                </>
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
                            className={`like-button ${comment.isLiked ? 'liked' : ''}`}
                            onClick={() => handleCommentLike(comment.id)}
                          >
                            👍 {comment.likes}
                          </button>
                          <button
                            className="reply-button"
                            onClick={() => handleReply(comment.id)}
                          >
                            답글
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            삭제
                          </button>
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
                                  <button
                                    className={`like-button ${reply.isLiked ? 'liked' : ''}`}
                                    onClick={() => handleCommentLike(reply.id, true, comment.id)}
                                  >
                                    👍 {reply.likes}
                                  </button>
                                  <button
                                    className="delete-button"
                                    onClick={() => handleDeleteComment(reply.id, true, comment.id)}
                                  >
                                    삭제
                                  </button>
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
              )}

              {activeTab === 'analysis' && (
                <div className="analysis-info">
                  <h4>분석</h4>
                  <div className="analysis-content">
                    <p>기사 분석 결과가 여기에 표시됩니다.</p>
                  </div>
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