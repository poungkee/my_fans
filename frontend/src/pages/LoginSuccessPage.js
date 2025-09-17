// src/pages/LoginSuccessPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AuthPages.css';

export default function LoginSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);
  const [verifyMsg, setVerifyMsg] = useState('토큰 검증 중...');

  useEffect(() => {
    const raw = searchParams.get('token');
    const token = raw ? decodeURIComponent(raw) : null;

    if (!token) {
      setVerifyMsg('토큰이 없습니다. 로그인 페이지로 이동합니다.');
      const t = setTimeout(() => navigate('/login', { replace: true }), 1200);
      return () => clearTimeout(t);
    }

    // 토큰 저장(소셜 로그인은 보통 장기 보관)
    localStorage.setItem('token', token);
    localStorage.setItem('rememberMe', 'true');

    (async () => {
      try {
        // 백엔드에 토큰 검증 요청
        const r = await fetch('/api/auth/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await r.json().catch(() => ({}));
        if (r.ok && data?.success) {
          // 사용자 정보 저장
          if (data.data?.user) {
            localStorage.setItem('user', JSON.stringify(data.data.user));
          }
          // 헤더에 알려서 UI 갱신
          window.dispatchEvent(new Event('loginStatusChange'));
          setVerifyMsg('로그인 완료! 곧 메인으로 이동합니다.');
        } else {
          // 검증 실패 시 토큰 제거
          localStorage.removeItem('token');
          setVerifyMsg(`토큰 검증 실패: ${data?.error || '알 수 없는 오류'}`);
        }
      } catch (e) {
        console.error('verify-token fetch error:', e);
        localStorage.removeItem('token');
        setVerifyMsg('토큰 검증 요청 실패');
      }

      // 3초 카운트 후 메인 이동
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            navigate('/', { replace: true });
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    })();

    // cleanup 없음(위에서 내부 타이머 클린업 처리)
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
            <p>{verifyMsg}</p>
            <p className="countdown">{countdown}초 후 자동 이동</p>
          </div>

          <button className="auth-button primary" onClick={() => navigate('/', { replace: true })}>
            지금 이동하기
          </button>
        </div>
      </div>
    </div>
  );
}
