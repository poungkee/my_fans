import React from 'react';
import './SocialLogin.css';

const SocialLogin = ({ type = "login" }) => {
  const handleKakaoLogin = () => {
    // 기능 구현 없음 - UI만
    alert('카카오 로그인 기능은 구현되지 않았습니다. (UI 데모)');
  };

  const handleNaverLogin = () => {
    // 기능 구현 없음 - UI만
    alert('네이버 로그인 기능은 구현되지 않았습니다. (UI 데모)');
  };

  const buttonText = type === "login" ? "로그인" : "회원가입";

  return (
    <div className="social-login">
      <div className="social-divider">
        <span>또는</span>
      </div>
      
      <div className="social-buttons">
        <button 
          className="social-button kakao" 
          onClick={handleKakaoLogin}
        >
          <div className="social-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 0C4.477 0 0 3.582 0 8c0 2.925 1.67 5.5 4.167 7.1L3.333 20l5.417-2.5c.833.1 1.667.1 2.5.1 5.523 0 10-3.582 10-8S15.523 0 10 0z" fill="#FEE500"/>
              <path d="M10 2.5c4.142 0 7.5 2.686 7.5 6s-3.358 6-7.5 6c-.833 0-1.667-.1-2.5-.2L5 17.5l1.667-3.2C4.5 12.8 2.5 10.6 2.5 8.5c0-3.314 3.358-6 7.5-6z" fill="#000"/>
            </svg>
          </div>
          <span>카카오로 {buttonText}</span>
        </button>
        
        <button 
          className="social-button naver" 
          onClick={handleNaverLogin}
        >
          <div className="social-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect width="20" height="20" rx="4" fill="#03C75A"/>
              <path d="M6 6h8v2H6V6zm0 3h8v2H6V9zm0 3h8v2H6v-2z" fill="white"/>
            </svg>
          </div>
          <span>네이버로 {buttonText}</span>
        </button>
      </div>
    </div>
  );
};

export default SocialLogin;
