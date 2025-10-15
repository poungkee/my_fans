import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './AuthPages.css';

const EmailVerificationPage = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // URL에서 이메일 파라미터 가져오기
  const email = new URLSearchParams(location.search).get('email');

  useEffect(() => {
    if (!email) {
      navigate('/register');
    }
  }, [email, navigate]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (e) => {
    setCode(e.target.value);
    if (error) setError('');
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (code.length !== 6) {
      setError('6자리 인증 코드를 입력해주세요.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email,
          code: code
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('이메일 인증이 완료되었습니다! 로그인 페이지로 이동합니다.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(data.error || '인증 코드가 올바르지 않습니다.');
      }
    } catch (err) {
      console.error('이메일 인증 에러:', err);
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: email })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('인증 코드가 재전송되었습니다.');
        setCountdown(60); // 60초 대기
      } else {
        setError(data.error || '코드 재전송에 실패했습니다.');
      }
    } catch (err) {
      console.error('코드 재전송 에러:', err);
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setResendLoading(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form">
          <form onSubmit={handleVerifyCode} className="auth-form-content">
            <div className="auth-header">
              <h2>이메일 인증</h2>
              <p>{email}로 전송된 6자리 인증 코드를 입력해주세요</p>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                {success}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="code">인증 코드</label>
              <input
                type="text"
                id="code"
                name="code"
                value={code}
                onChange={handleChange}
                placeholder="6자리 인증 코드를 입력하세요"
                maxLength="6"
                required
                disabled={loading}
                style={{ 
                  textAlign: 'center', 
                  fontSize: '24px', 
                  letterSpacing: '8px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <button 
              type="submit" 
              className="auth-button primary"
              disabled={loading || code.length !== 6}
            >
              {loading ? '인증 중...' : '인증 완료'}
            </button>

            <div className="resend-section">
              <p>인증 코드를 받지 못하셨나요?</p>
              <button 
                type="button" 
                className="auth-button secondary"
                onClick={handleResendCode}
                disabled={resendLoading || countdown > 0}
              >
                {resendLoading ? '전송 중...' : 
                 countdown > 0 ? `${countdown}초 후 재전송 가능` : 
                 '인증 코드 재전송'}
              </button>
            </div>
          </form>
          
          <div className="auth-footer">
            <Link to="/register" className="back-link">← 회원가입으로 돌아가기</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;

