import React from 'react';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3 className="sidebar-title">인기 뉴스</h3>
        <div className="sidebar-item">1. 오늘의 주요 소식</div>
        <div className="sidebar-item">2. 경제 동향 분석</div>
        <div className="sidebar-item">3. 스포츠 경기 결과</div>
        <div className="sidebar-item">4. IT 기술 뉴스</div>
      </div>
    </aside>
  );
};

export default Sidebar;
