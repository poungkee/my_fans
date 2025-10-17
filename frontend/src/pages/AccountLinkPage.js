import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AuthPages.css';

const AccountLinkPage = () => {
  const [linkData, setLinkData] = useState(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const dataParam = urlParams.get('data');

    if (!dataParam) {
      setError('연동 정보가 없습니다.');
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    try {
      const data = JSON.parse(decodeURIComponent(dataParam));
      setLinkData(data);
      console.log('연동 데이터:', data);
    } catch (error) {
      console.error('연동 데이터 파싱 오류:', error);
      setError('잘못된 연동 정보입니다.');
      setTimeout(() => navigate('/login'), 3000);
    }
  }, [location.search, navigate]);

  const handleLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!password) {
      setError('비밀번호를 입력해주세요.');
      setLoading(false);
      return;
    }

    try {
      const token = sessionStorage.getItem('token');

      const response = await fetch('/api/auth/link-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          password: password,
          provider: linkData.newProvider,
          socialToken: linkData.socialToken,
          profileImage: linkData.profileImage
        })
      });

      const data = await response.json();

      if (data.success) {
        // 새 토큰 저장
        if (data.data.token) {
          sessionStorage.setItem('token', data.data.token);
          sessionStorage.setItem('user', JSON.stringify(data.data.user));
          window.dispatchEvent(new Event('loginStatusChange'));
        }

        alert(`${linkData.newProvider} 계정이 성공적으로 연동되었습니다!`);
        navigate('/');
      } else {
        setError(data.error || '계정 연동에 실패했습니다.');
      }
    } catch (err) {
      console.error('계정 연동 에러:', err);
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/login');
  };

  if (!linkData) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-form">
            <div className="auth-header">
              <h2>로딩 중...</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form">
          <div className="auth-header">
            <h2>계정 연동 확인</h2>
            <p>이미 가입된 계정이 있습니다. 연동하시겠습니까?</p>
          </div>

          <div className="link-info-section">
            <div className="existing-account-info">
              <h3>기존 계정</h3>
              <div className="account-details">
                <p><strong>아이디:</strong> {linkData.existingUsername}</p>
                <p><strong>이메일:</strong> {linkData.existingEmail}</p>
                <p><strong>로그인 방식:</strong> 일반 로그인</p>
              </div>
            </div>

            <div className="arrow-divider">↓</div>

            <div className="new-social-info">
              <h3>{linkData.newProvider === 'kakao' ? '카카오' : '네이버'} 계정</h3>
              <div className="social-profile">
                {linkData.profileImage && (
                  <img
                    src={linkData.profileImage}
                    alt="프로필"
                    className="profile-preview"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <div className="social-details">
                  <p><strong>이름:</strong> {linkData.name}</p>
                  <p><strong>이메일:</strong> {linkData.existingEmail}</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleLink} className="auth-form-content">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="security-notice">
              <p>⚠️ 보안을 위해 기존 계정의 비밀번호를 입력해주세요.</p>
            </div>

            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="기존 계정의 비밀번호를 입력하세요"
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="button-group">
              <button
                type="submit"
                className="auth-button primary"
                disabled={loading}
              >
                {loading ? '연동 중...' : '계정 연동하기'}
              </button>
              <button
                type="button"
                className="auth-button secondary"
                onClick={handleCancel}
                disabled={loading}
              >
                취소
              </button>
            </div>

            <div className="link-benefits">
              <h4>연동 시 혜택</h4>
              <ul>
                <li>✅ {linkData.newProvider === 'kakao' ? '카카오' : '네이버'}와 일반 로그인 모두 사용 가능</li>
                <li>✅ 하나의 계정으로 모든 데이터 통합 관리</li>
                <li>✅ 북마크, 추천 기록 유지</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountLinkPage;
