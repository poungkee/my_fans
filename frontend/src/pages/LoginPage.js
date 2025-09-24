import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import SocialLogin from '../components/SocialLogin';
import './AuthPages.css';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // 에러 메시지 초기화
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          rememberMe: formData.rememberMe
        })
      });

      const data = await response.json();

      if (data.success) {
        // 로그인 성공
        // rememberMe에 따라 저장 방식 결정
        if (formData.rememberMe) {
          // 로그인 상태 유지: localStorage 사용 (브라우저를 닫아도 유지)
          localStorage.setItem('user', JSON.stringify(data.data.user));
          localStorage.setItem('token', data.data.token);
          localStorage.setItem('rememberMe', 'true');
        } else {
          // 일반 로그인: sessionStorage 사용 (브라우저 탭을 닫으면 삭제)
          sessionStorage.setItem('user', JSON.stringify(data.data.user));
          sessionStorage.setItem('token', data.data.token);
          localStorage.removeItem('rememberMe');
        }
        
        // Header 컴포넌트에 로그인 상태 변화 알림
        window.dispatchEvent(new Event('loginStatusChange'));

        alert('로그인 성공!');

        // 이전 페이지로 돌아가기 (상세페이지에서 왔다면 상세페이지로)
        const from = location.state?.from || '/';
        navigate(from, { replace: true });
      } else {
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch (err) {
      console.error('로그인 에러:', err);
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
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
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="username">아이디</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="아이디를 입력하세요"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="비밀번호를 입력하세요"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-options">
              <label className="checkbox-label">
                <div>
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  <span>로그인 상태 유지</span>
                </div>
                <small className="checkbox-hint">
                  {formData.rememberMe ? '30일간 로그인 상태가 유지됩니다' : '브라우저 종료 시 로그아웃됩니다'}
                </small>
              </label>
              <Link to="/forgot-password" className="forgot-link">비밀번호를 잊으셨나요?</Link>
            </div>
            
            <button 
              type="submit" 
              className="auth-button primary"
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
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
