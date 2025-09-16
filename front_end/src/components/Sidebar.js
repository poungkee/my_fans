import React from 'react';

const Sidebar = () => {
  return (
    <aside className="sidebar">
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
  );
};

export default Sidebar;
