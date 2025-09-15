import React, { useState } from 'react';

const Header = ({ onSortChange, onSearch, selectedSort }) => {
  const [activeDropdown, setActiveDropdown] = useState(null);

  const toggleDropdown = (type) => {
    setActiveDropdown(activeDropdown === type ? null : type);
  };

  const handleSortClick = (sortType, displayText) => {
    onSortChange(sortType, displayText);
    setActiveDropdown(null);
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      const query = e.target.value || e.target.previousElementSibling?.value;
      onSearch(query);
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">📰 뉴스포털</div>
        
        <div className="dropdown">
          <div 
            className="news-agency" 
            onClick={() => toggleDropdown('agency')}
          >
            언론사 ▼
          </div>
          <div 
            id="agency-dropdown" 
            className={`dropdown-content ${activeDropdown === 'agency' ? 'show' : ''}`}
          >
            <a href="#" onClick={(e) => { e.preventDefault(); }}>00일보</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>일보</a>
          </div>
        </div>
        
        <div className="dropdown">
          <div 
            className="category-nav" 
            onClick={() => toggleDropdown('category')}
          >
            카테고리 ▼
          </div>
          <div 
            id="category-dropdown" 
            className={`dropdown-content ${activeDropdown === 'category' ? 'show' : ''}`}
          >
            <a href="#" onClick={(e) => { e.preventDefault(); }}>정치</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>과학</a>
            <a href="#" onClick={(e) => { e.preventDefault(); }}>IT</a>
          </div>
        </div>
      </div>
      
      <div className="search-section">
        <div className="dropdown">
          <div 
            className="search-filter" 
            onClick={() => toggleDropdown('sort')}
          >
            <span className="search-filter-text">{selectedSort}</span>
            <span>▼</span>
          </div>
          <div 
            id="sort-dropdown" 
            className={`dropdown-content ${activeDropdown === 'sort' ? 'show' : ''}`}
          >
            <a href="#" onClick={(e) => { e.preventDefault(); handleSortClick('latest', '최신순'); }}>최신순</a>
            <a href="#" onClick={(e) => { e.preventDefault(); handleSortClick('relevant', '관련순'); }}>관련순</a>
            <a href="#" onClick={(e) => { e.preventDefault(); handleSortClick('popular', '조회순'); }}>조회순</a>
            <a href="#" onClick={(e) => { e.preventDefault(); handleSortClick('trending', '인기순'); }}>인기순</a>
          </div>
        </div>
        
        <input 
          type="text" 
          className="search-input" 
          placeholder="검색어를 입력하세요"
          onKeyUp={handleSearch}
        />
        
        <div 
          className="search-icon" 
          onClick={handleSearch}
        >
          🔍
        </div>
      </div>
      
      <div className="user-menu">
        <div className="user-dropdown">
          <div 
            className="user-icon" 
            onClick={() => toggleDropdown('user')}
          >
            👤
          </div>
          <div 
            id="user-dropdown" 
            className={`user-dropdown-content ${activeDropdown === 'user' ? 'show' : ''}`}
          >
            <a href="#" onClick={(e) => { e.preventDefault(); alert('로그인 페이지로 이동합니다. (데모용)'); }}>로그인</a>
            <a href="#" onClick={(e) => { e.preventDefault(); alert('회원가입 페이지로 이동합니다. (데모용)'); }}>회원가입</a>
            <a href="#" onClick={(e) => { e.preventDefault(); alert('마이페이지로 이동합니다. (데모용)'); }}>마이페이지</a>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
