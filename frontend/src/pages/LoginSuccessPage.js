// src/pages/LoginSuccessPage.js
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AuthPages.css';

export default function LoginSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [countdown, setCountdown] = useState(3);
  const [verifyMsg, setVerifyMsg] = useState('토큰 검증 중...');
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  
  useEffect(() => {
    mountedRef.current = true;

    const token = searchParams.get('token'); // URLSearchParams가 이미 decoding 처리함
    if (!token) {
      setVerifyMsg('토큰이 없습니다. 로그인 페이지로 이동합니다.');
      const t = setTimeout(() => {
        if (mountedRef.current) navigate('/login', { replace: true });
      }, 1200);
      return () => clearTimeout(t);
    }

    // 소셜 로그인은 창 닫으면 자동 로그아웃되도록 sessionStorage 사용
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('socialLogin', 'true');

    // 디버깅을 위한 로그
    console.log('소셜 로그인 세션 저장 완료:', {
      token: token.substring(0, 20) + '...',
      socialLogin: 'true',
      storage: 'sessionStorage'
    });

    // 검증 요청
    (async () => {
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const r = await fetch('/api/auth/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          signal: ac.signal,
        });

        const data = await r.json().catch(() => ({}));

        if (r.ok && data?.success) {
          if (data.data?.user) {
            sessionStorage.setItem('user', JSON.stringify(data.data.user));
          }
          // 헤더 등 다른 곳에 로그인 상태 반영
          window.dispatchEvent(new Event('loginStatusChange'));
          if (mountedRef.current) {
            setVerifyMsg('로그인 완료! 곧 메인으로 이동합니다.');
          }
        } else {
          // 검증 실패 시 토큰 제거
          sessionStorage.removeItem('token');
          if (mountedRef.current) {
            setVerifyMsg(`토큰 검증 실패: ${data?.error || '알 수 없는 오류'}`);
          }
        }
      } catch (e) {
        if (e?.name !== 'AbortError') {
          console.error('verify-token fetch error:', e);
          sessionStorage.removeItem('token');
          if (mountedRef.current) setVerifyMsg('토큰 검증 요청 실패');
        }
      } finally {
        // 3초 카운트다운 후 이동
        if (mountedRef.current) {
          timerRef.current = setInterval(() => {
            setCountdown((c) => {
              if (c <= 1) {
                clearInterval(timerRef.current);
                navigate('/', { replace: true });
                return 0;
              }
              return c - 1;
            });
          }, 1000);
        }
      }
    })();

    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
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

          <button
            className="auth-button primary"
            onClick={() => navigate('/', { replace: true })}
          >
            지금 이동하기
          </button>
        </div>
      </div>
    </div>
  );
}
