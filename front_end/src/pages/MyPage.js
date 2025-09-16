import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MyPage.css';

const MyPage = () => {
  const navigate = useNavigate();

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
          <h2>회원정보</h2>
          <div className="user-info-card">
            <div className="user-avatar">
              <div className="avatar-placeholder">👤</div>
            </div>
            <div className="user-details">
              <div className="user-name">홍길동</div>
              <div className="user-email">hong@example.com</div>
              <div className="user-join-date">가입일: 2024년 1월 15일</div>
              <button className="edit-profile-btn">프로필 수정</button>
            </div>
          </div>
        </section>

        {/* 북마크 뉴스 섹션 */}
        <section className="bookmark-section">
          <h2>북마크한 뉴스</h2>
          <div className="bookmark-list">
            <div className="bookmark-item">
              <div className="bookmark-news">
                <h3>경제 관련 중요 뉴스 제목</h3>
                <p>뉴스 요약 내용이 여기에 표시됩니다...</p>
                <div className="news-meta">
                  <span className="news-source">조선일보</span>
                  <span className="news-date">2시간 전</span>
                </div>
              </div>
              <button className="remove-bookmark-btn">북마크 해제</button>
            </div>
            
            <div className="bookmark-item">
              <div className="bookmark-news">
                <h3>IT/과학 분야 최신 뉴스</h3>
                <p>기술 발전에 관한 흥미로운 내용...</p>
                <div className="news-meta">
                  <span className="news-source">한국경제</span>
                  <span className="news-date">5시간 전</span>
                </div>
              </div>
              <button className="remove-bookmark-btn">북마크 해제</button>
            </div>

            <div className="bookmark-item">
              <div className="bookmark-news">
                <h3>정치 관련 주요 뉴스</h3>
                <p>정치 동향에 대한 분석 내용...</p>
                <div className="news-meta">
                  <span className="news-source">중앙일보</span>
                  <span className="news-date">1일 전</span>
                </div>
              </div>
              <button className="remove-bookmark-btn">북마크 해제</button>
            </div>
          </div>
        </section>

        {/* 좋아요/댓글 기록 섹션 */}
        <section className="activity-section">
          <h2>활동 기록</h2>
          <div className="activity-tabs">
            <button className="tab-button active">좋아요</button>
            <button className="tab-button">댓글</button>
          </div>
          
          <div className="activity-content">
            <div className="liked-news">
              <h3>좋아요한 뉴스</h3>
              <div className="liked-item">
                <h4>사회 이슈 관련 뉴스</h4>
                <p>사회 전반에 걸친 중요한 이슈에 대한 내용...</p>
                <div className="news-meta">
                  <span className="news-source">동아일보</span>
                  <span className="news-date">3시간 전</span>
                </div>
              </div>
              
              <div className="liked-item">
                <h4>문화/생활 관련 뉴스</h4>
                <p>일상생활과 문화에 관한 흥미로운 소식...</p>
                <div className="news-meta">
                  <span className="news-source">문화일보</span>
                  <span className="news-date">6시간 전</span>
                </div>
              </div>
            </div>
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
      </div>
    </div>
  );
};

export default MyPage;
