import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AuthPages.css';

const LoginErrorPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  const error = searchParams.get('error') || '알 수 없는 오류가 발생했습니다.';

  useEffect(() => {
    // 5초 후 로그인 페이지로 리다이렉트
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form">
          <div className="auth-header">
            <h2>로그인 실패</h2>
            <p>소셜 로그인 중 오류가 발생했습니다.</p>
          </div>
          
          <div className="error-message">
            <div className="error-icon">❌</div>
            <p className="error-text">{error}</p>
            <p className="countdown">{countdown}초 후 로그인 페이지로 이동</p>
          </div>
          
          <div className="auth-buttons">
            <button 
              className="auth-button primary"
              onClick={() => navigate('/login')}
            >
              로그인 페이지로 이동
            </button>
            
            <button 
              className="auth-button secondary"
              onClick={() => navigate('/')}
            >
              메인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginErrorPage;
