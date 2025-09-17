import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './AuthPages.css';

const ForgotPasswordPage = () => {
  const [step, setStep] = useState(1); // 1: 이메일 입력, 2: 코드 입력, 3: 비밀번호 재설정
  const [formData, setFormData] = useState({
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  // 1단계: 이메일로 재설정 코드 전송
  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: formData.email })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setStep(2);
      } else {
        setError(data.error || '코드 전송에 실패했습니다.');
      }
    } catch (err) {
      console.error('코드 전송 에러:', err);
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 2단계: 코드 확인
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-password-reset-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          email: formData.email, 
          code: formData.code 
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('인증 코드가 확인되었습니다.');
        setStep(3);
      } else {
        setError(data.error || '인증 코드가 올바르지 않습니다.');
      }
    } catch (err) {
      console.error('코드 확인 에러:', err);
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 3단계: 비밀번호 재설정
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.newPassword.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email,
          code: formData.code,
          newPassword: formData.newPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('비밀번호가 성공적으로 재설정되었습니다. 로그인 페이지로 이동합니다.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(data.error || '비밀번호 재설정에 실패했습니다.');
      }
    } catch (err) {
      console.error('비밀번호 재설정 에러:', err);
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <form onSubmit={handleSendCode} className="auth-form-content">
      <div className="auth-header">
        <h2>비밀번호 재설정</h2>
        <p>가입하신 이메일 주소를 입력해주세요</p>
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
        <label htmlFor="email">이메일</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="이메일을 입력하세요"
          required
          disabled={loading}
        />
      </div>

      <button 
        type="submit" 
        className="auth-button primary"
        disabled={loading}
      >
        {loading ? '전송 중...' : '인증 코드 전송'}
      </button>
    </form>
  );

  const renderStep2 = () => (
    <form onSubmit={handleVerifyCode} className="auth-form-content">
      <div className="auth-header">
        <h2>인증 코드 확인</h2>
        <p>{formData.email}로 전송된 6자리 코드를 입력해주세요</p>
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
          value={formData.code}
          onChange={handleChange}
          placeholder="6자리 인증 코드를 입력하세요"
          maxLength="6"
          required
          disabled={loading}
        />
      </div>

      <button 
        type="submit" 
        className="auth-button primary"
        disabled={loading}
      >
        {loading ? '확인 중...' : '코드 확인'}
      </button>

      <button 
        type="button" 
        className="auth-button secondary"
        onClick={() => setStep(1)}
        disabled={loading}
      >
        이메일 다시 입력
      </button>
    </form>
  );

  const renderStep3 = () => (
    <form onSubmit={handleResetPassword} className="auth-form-content">
      <div className="auth-header">
        <h2>새 비밀번호 설정</h2>
        <p>새로운 비밀번호를 입력해주세요</p>
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
        <label htmlFor="newPassword">새 비밀번호</label>
        <input
          type="password"
          id="newPassword"
          name="newPassword"
          value={formData.newPassword}
          onChange={handleChange}
          placeholder="새 비밀번호를 입력하세요 (최소 8자)"
          required
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword">비밀번호 확인</label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="비밀번호를 다시 입력하세요"
          required
          disabled={loading}
        />
      </div>

      <button 
        type="submit" 
        className="auth-button primary"
        disabled={loading}
      >
        {loading ? '재설정 중...' : '비밀번호 재설정'}
      </button>
    </form>
  );

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          
          <div className="auth-footer">
            <Link to="/login" className="back-link">← 로그인으로 돌아가기</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

