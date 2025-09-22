import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CATEGORIES, MEDIA_SOURCES } from '../constants/commonData';
import './AuthPages.css';

const ProfileSetupPage = () => {
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    location: '',
    preferredCategories: [],
    preferredSources: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();

  // URL에서 사용자 정보 가져오기
  const userInfo = location.state?.user;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleCategoryChange = (category) => {
    setFormData(prev => ({
      ...prev,
      preferredCategories: prev.preferredCategories.includes(category)
        ? prev.preferredCategories.filter(c => c !== category)
        : [...prev.preferredCategories, category]
    }));
  };

  const handleMediaSourceChange = (source) => {
    setFormData(prev => ({
      ...prev,
      preferredSources: prev.preferredSources.includes(source)
        ? prev.preferredSources.filter(s => s !== source)
        : [...prev.preferredSources, source]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 3단계가 아닌 경우 submit 방지
    if (currentStep !== 3) {
      return;
    }

    // 최종 제출 전 유효성 검사
    if (!validateCurrentStep()) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // localStorage 또는 sessionStorage에서 토큰 가져오기
      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }
      
      if (!token) {
        setError('인증 토큰이 없습니다. 다시 로그인해주세요.');
        navigate('/login');
        return;
      }

      // 사용자 프로필 셋업 API 호출
      const response = await fetch('/api/auth/setup-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          age: formData.age ? parseInt(formData.age) : null,
          gender: formData.gender || null,
          location: formData.location || null,
          preferredCategories: formData.preferredCategories,
          preferredSources: formData.preferredSources
        })
      });

      const data = await response.json();

      if (data.success) {
        // 기존 사용자 정보를 유지하면서 프로필 설정 정보만 업데이트
        const existingUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
        const updatedUser = {
          ...existingUser,
          ...formData,
          age: formData.age ? parseInt(formData.age) : null
        };

        // 어느 스토리지에 저장되어 있는지 확인하고 같은 곳에 업데이트
        if (localStorage.getItem('user')) {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        if (sessionStorage.getItem('user')) {
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
        }

        // 헤더 컴포넌트에 변경 알림
        window.dispatchEvent(new CustomEvent('loginStatusChange'));

        // 회원가입과 프로필 설정이 모두 완료되었음을 알림
        navigate('/', {
          state: {
            message: '회원가입이 완료되었습니다! 환영합니다.'
          }
        });
      } else {
        setError(data.error || '프로필 설정에 실패했습니다.');
      }
    } catch (err) {
      console.error('프로필 설정 에러:', err);
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const skipSetup = () => {
    // 프로필 설정을 건너뛰고 메인페이지로 이동
    navigate('/', {
      state: {
        message: '회원가입이 완료되었습니다! 환영합니다.'
      }
    });
  };

  // 각 단계별 유효성 검사
  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        // 1단계는 모든 항목이 선택사항이므로 항상 통과
        return true;
      case 2:
        // 2단계: 최소 1개 이상의 카테고리 선택
        if (formData.preferredCategories.length === 0) {
          setError('관심 있는 뉴스 카테고리를 최소 1개 이상 선택해주세요.');
          return false;
        }
        return true;
      case 3:
        // 3단계: 최소 1개 이상의 언론사 선택
        if (formData.preferredSources.length === 0) {
          setError('선호하는 언론사를 최소 1개 이상 선택해주세요.');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    setError(''); // 이전 에러 메시지 초기화

    if (!validateCurrentStep()) {
      return; // 유효성 검사 실패 시 다음 단계로 이동하지 않음
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 공통 상수에서 카테고리와 언론사 목록 가져오기
  const categories = CATEGORIES;
  const mediaSources = MEDIA_SOURCES;

  // 각 단계별 버튼 활성화 조건
  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return true; // 1단계는 항상 진행 가능
      case 2:
        return formData.preferredCategories.length > 0;
      case 3:
        return formData.preferredSources.length > 0;
      default:
        return true;
    }
  };

  if (!userInfo) {
    navigate('/register');
    return null;
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <div className="step-header">
              <h3>기본 정보</h3>
              <p>나이, 성별, 지역 정보를 입력해주세요.</p>
            </div>
            
            <div className="form-group">
              <label htmlFor="age">나이 (선택)</label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="나이를 입력하세요"
                min="1"
                max="120"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="gender">성별 (선택)</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">선택하세요</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="location">지역 (선택)</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="거주 지역을 입력하세요 (예: 서울, 경기, 부산)"
                disabled={loading}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <div className="step-header">
              <h3>관심 카테고리</h3>
              <p>관심 있는 뉴스 카테고리를 선택해주세요. (최소 1개 이상 필수)</p>
              <div className="selection-status">
                <span className={`status-indicator ${formData.preferredCategories.length > 0 ? 'success' : 'warning'}`}>
                  선택됨: {formData.preferredCategories.length}개 / {categories.length}개
                </span>
                {formData.preferredCategories.length === 0 && (
                  <span className="requirement-message">⚠️ 최소 1개 이상 선택해주세요</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <div className="checkbox-grid">
                {categories.map(category => (
                  <label key={category} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={formData.preferredCategories.includes(category)}
                      onChange={() => handleCategoryChange(category)}
                      disabled={loading}
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <div className="step-header">
              <h3>선호 언론사</h3>
              <p>선호하는 언론사를 선택해주세요. (최소 1개 이상 필수)</p>
              <div className="selection-status">
                <span className={`status-indicator ${formData.preferredSources.length > 0 ? 'success' : 'warning'}`}>
                  선택됨: {formData.preferredSources.length}개 / {mediaSources.length}개
                </span>
                {formData.preferredSources.length === 0 && (
                  <span className="requirement-message">⚠️ 최소 1개 이상 선택해주세요</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <div className="checkbox-grid">
                {mediaSources.map(source => (
                  <label key={source} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={formData.preferredSources.includes(source)}
                      onChange={() => handleMediaSourceChange(source)}
                      disabled={loading}
                    />
                    <span>{source}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form">
          <form onSubmit={handleSubmit} className="auth-form-content" onKeyDown={(e) => {
            // Enter 키가 눌렸을 때 3단계가 아니면 submit 방지
            if (e.key === 'Enter' && currentStep !== 3) {
              e.preventDefault();
              nextStep();
            }
          }}>
            <div className="auth-header">
              <h2>프로필 설정</h2>
              <p>안녕하세요, {userInfo.name}님! 맞춤 뉴스를 위해 추가 정보를 입력해주세요.</p>
            </div>

            {/* 진행 단계 표시 */}
            <div className="step-indicator">
              <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
                <span className="step-number">1</span>
                <span className="step-label">기본 정보</span>
              </div>
              <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
                <span className="step-number">2</span>
                <span className="step-label">관심 카테고리</span>
              </div>
              <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
                <span className="step-number">3</span>
                <span className="step-label">선호 언론사</span>
              </div>
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

            {renderStepContent()}

            <div className="form-actions">
              {currentStep > 1 && (
                <button 
                  type="button" 
                  className="auth-button secondary"
                  onClick={prevStep}
                  disabled={loading}
                >
                  이전
                </button>
              )}
              
              {currentStep < 3 ? (
                <button
                  type="button"
                  className={`auth-button ${isStepValid() ? 'primary' : 'disabled'}`}
                  onClick={nextStep}
                  disabled={loading || !isStepValid()}
                  title={!isStepValid() ? '필수 항목을 선택해주세요' : ''}
                >
                  {isStepValid() ? '다음' : `선택 후 다음 (${currentStep === 2 ? formData.preferredCategories.length : formData.preferredSources.length}/1)`}
                </button>
              ) : (
                <button
                  type="submit"
                  className={`auth-button ${isStepValid() ? 'primary' : 'disabled'}`}
                  disabled={loading || !isStepValid()}
                  title={!isStepValid() ? '선호 언론사를 최소 1개 이상 선택해주세요' : ''}
                >
                  {loading ? '설정 중...' : isStepValid() ? '프로필 설정 완료' : `언론사 선택 후 완료 (${formData.preferredSources.length}/1)`}
                </button>
              )}

              <button 
                type="button" 
                className="auth-button tertiary"
                onClick={skipSetup}
                disabled={loading}
              >
                나중에 설정하기
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
