import React from 'react';
import { Link } from 'react-router-dom';
import SocialLogin from '../components/SocialLogin';
import './AuthPages.css';

const RegisterPage = () => {
  const handleSubmit = (e) => {
    e.preventDefault();
    // 기능 구현 없음 - UI만
    alert('회원가입 기능은 구현되지 않았습니다. (UI 데모)');
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form">
          <div className="auth-header">
            <h2>회원가입</h2>
            <p>뉴스 포털에 가입하고 맞춤 뉴스를 받아보세요</p>
          </div>
          
          <form onSubmit={handleSubmit} className="auth-form-content">
            <div className="form-group">
              <label htmlFor="username">아이디</label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="아이디를 입력하세요 (3-20자)"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="이메일을 입력하세요"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="비밀번호를 입력하세요 (최소 8자)"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">비밀번호 확인</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="비밀번호를 다시 입력하세요"
                required
              />
            </div>
            
            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" required />
                <span>이용약관 및 개인정보처리방침에 동의합니다</span>
              </label>
            </div>
            
            <button type="submit" className="auth-button primary">
              회원가입
            </button>
          </form>
          
          <SocialLogin type="register" />
          
          <div className="auth-footer">
            <p>이미 계정이 있으신가요? <Link to="/login" className="link">로그인</Link></p>
            <Link to="/" className="back-link">← 메인으로 돌아가기</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
