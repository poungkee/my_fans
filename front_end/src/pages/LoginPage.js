import React from 'react';
import { Link } from 'react-router-dom';
import SocialLogin from '../components/SocialLogin';
import './AuthPages.css';

const LoginPage = () => {
  const handleSubmit = (e) => {
    e.preventDefault();
    // 기능 구현 없음 - UI만
    alert('로그인 기능은 구현되지 않았습니다. (UI 데모)');
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form">
          <div className="auth-header">
            <h2>로그인</h2>
            <p>뉴스 포털에 오신 것을 환영합니다</p>
          </div>
          
          <form onSubmit={handleSubmit} className="auth-form-content">
            <div className="form-group">
              <label htmlFor="username">아이디</label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="아이디를 입력하세요"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="비밀번호를 입력하세요"
                required
              />
            </div>
            
            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span>로그인 상태 유지</span>
              </label>
              <Link to="/forgot-password" className="forgot-link">비밀번호를 잊으셨나요?</Link>
            </div>
            
            <button type="submit" className="auth-button primary">
              로그인
            </button>
          </form>
          
          <SocialLogin type="login" />
          
          <div className="auth-footer">
            <p>계정이 없으신가요? <Link to="/register" className="link">회원가입</Link></p>
            <Link to="/" className="back-link">← 메인으로 돌아가기</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
