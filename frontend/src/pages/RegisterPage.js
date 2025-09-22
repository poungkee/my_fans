import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SocialLogin from '../components/SocialLogin';
import './AuthPages.css';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    marketing: false
  });
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // 에러 메시지 초기화
    if (error) setError('');
  };

  const handleAgreementChange = (type) => {
    setAgreements(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleAllAgreementsChange = () => {
    const allChecked = agreements.terms && agreements.privacy && agreements.marketing;
    setAgreements({
      terms: !allChecked,
      privacy: !allChecked,
      marketing: !allChecked
    });
  };

  const validateForm = () => {
    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }
    if (formData.username.length < 3) {
      setError('아이디는 최소 3자 이상이어야 합니다.');
      return false;
    }
    if (!agreements.terms) {
      setError('이용약관에 동의해주세요.');
      return false;
    }
    if (!agreements.privacy) {
      setError('개인정보 처리방침에 동의해주세요.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // 토큰을 sessionStorage에 저장 (회원가입 후 자동 로그인은 임시)
        if (data.data.token) {
          sessionStorage.setItem('token', data.data.token);
          sessionStorage.setItem('user', JSON.stringify(data.data.user));

          // Header 컴포넌트에 로그인 상태 변화 알림
          window.dispatchEvent(new Event('loginStatusChange'));
        }

        // 즉시 프로필 설정 페이지로 이동 (메시지 표시 없이)
        navigate('/profile-setup', {
          state: {
            user: data.data.user,
            message: '회원가입이 완료되었습니다! 프로필을 설정해주세요.'
          }
        });
      } else {
        setError(data.error || '회원가입에 실패했습니다.');
      }
    } catch (err) {
      console.error('회원가입 에러:', err);
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
            <h2>회원가입</h2>
            <p>뉴스 포털에 가입하고 맞춤 뉴스를 받아보세요</p>
          </div>
          
          <form onSubmit={handleSubmit} className="auth-form-content">
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
              <label htmlFor="name">이름</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="이름을 입력하세요"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="username">아이디</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="아이디를 입력하세요 (3-20자)"
                required
                disabled={loading}
              />
            </div>
            
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
            
            <div className="form-group">
              <label htmlFor="phone">연락처 (선택)</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="연락처를 입력하세요"
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
                placeholder="비밀번호를 입력하세요 (최소 8자)"
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
            
            {/* 약관 동의 섹션 */}
            <div className="agreement-section">
              <div className="agreement-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreements.terms && agreements.privacy && agreements.marketing}
                    onChange={handleAllAgreementsChange}
                    disabled={loading}
                  />
                  <span>전체 동의</span>
                </label>
              </div>

              <div className="agreement-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreements.terms}
                    onChange={() => handleAgreementChange('terms')}
                    disabled={loading}
                  />
                  <span>이용약관 동의 <span className="required">(필수)</span></span>
                </label>
                <button
                  type="button"
                  className="view-terms-btn"
                  onClick={() => setShowTerms(!showTerms)}
                  disabled={loading}
                >
                  {showTerms ? '닫기' : '보기'}
                </button>
              </div>

              <div className="agreement-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreements.privacy}
                    onChange={() => handleAgreementChange('privacy')}
                    disabled={loading}
                  />
                  <span>개인정보 처리방침 동의 <span className="required">(필수)</span></span>
                </label>
                <button
                  type="button"
                  className="view-terms-btn"
                  onClick={() => setShowPrivacy(!showPrivacy)}
                  disabled={loading}
                >
                  {showPrivacy ? '닫기' : '보기'}
                </button>
              </div>

              <div className="agreement-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreements.marketing}
                    onChange={() => handleAgreementChange('marketing')}
                    disabled={loading}
                  />
                  <span>마케팅 정보 수신 동의 <span className="optional">(선택)</span></span>
                </label>
              </div>

              {/* 약관 내용 */}
              {showTerms && (
                <div className="terms-content">
                  <h4>이용약관</h4>
                  <div className="terms-text">
                    <p>1. 서비스 이용</p>
                    <p>본 서비스는 뉴스 포털 서비스로, 사용자는 서비스 이용 시 본 약관에 동의한 것으로 간주됩니다.</p>
                    <p>2. 사용자 의무</p>
                    <p>사용자는 서비스 이용 시 관련 법령을 준수해야 하며, 타인의 권리를 침해하지 않아야 합니다.</p>
                    <p>3. 서비스 변경 및 중단</p>
                    <p>서비스 제공자는 사전 고지 후 서비스를 변경하거나 중단할 수 있습니다.</p>
                  </div>
                </div>
              )}

              {showPrivacy && (
                <div className="terms-content">
                  <h4>개인정보 처리방침</h4>
                  <div className="terms-text">
                    <p>1. 개인정보 수집 및 이용</p>
                    <p>회원가입 시 수집되는 개인정보는 서비스 제공 및 개선을 위해 이용됩니다.</p>
                    <p>2. 개인정보 보관</p>
                    <p>수집된 개인정보는 관련 법령에 따라 안전하게 보관됩니다.</p>
                    <p>3. 개인정보 제3자 제공</p>
                    <p>사용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.</p>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              type="submit" 
              className="auth-button primary"
              disabled={loading || !agreements.terms || !agreements.privacy}
            >
              {loading ? '회원가입 중...' : '회원가입'}
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
