import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AuthPages.css';

const LoginSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // 토큰을 localStorage에 저장 (소셜 로그인은 기본적으로 30일 유지)
      localStorage.setItem('token', token);
      localStorage.setItem('rememberMe', 'true');
      
      // 사용자 정보를 가져와서 저장
      fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('user', JSON.stringify(data.data.user));
          // Header 컴포넌트에 로그인 상태 변화 알림
          window.dispatchEvent(new Event('loginStatusChange'));
        }
      })
      .catch(error => {
        console.error('사용자 정보 가져오기 실패:', error);
      });

      // 3초 후 메인 페이지로 리다이렉트
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      // 토큰이 없으면 로그인 페이지로 리다이렉트
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form">
          <div className="auth-header">
            <h2>로그인 성공!</h2>
            <p>소셜 로그인이 완료되었습니다.</p>
          </div>
          
          <div className="success-message">
            <div className="success-icon">✅</div>
            <p>잠시 후 메인 페이지로 이동합니다...</p>
            <p className="countdown">{countdown}초 후 자동 이동</p>
          </div>
          
          <button 
            className="auth-button primary"
            onClick={() => navigate('/')}
          >
            지금 이동하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginSuccessPage;
