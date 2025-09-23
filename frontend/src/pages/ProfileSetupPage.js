import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ProfileSetupPage.css';

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

  // 데이터베이스에서 가져올 카테고리와 언론사 데이터
  const [categories, setCategories] = useState([]);
  const [mediaSources, setMediaSources] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  // URL에서 사용자 정보 가져오기
  const userInfo = location.state?.user;

  // 데이터베이스에서 카테고리와 언론사 데이터 가져오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataLoading(true);

        const [categoriesResponse, sourcesResponse] = await Promise.all([
          fetch('/api/common/categories'),
          fetch('/api/common/media-sources')
        ]);

        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          if (categoriesData.success && categoriesData.data) {
            setCategories(categoriesData.data);
          }
        }

        if (sourcesResponse.ok) {
          const sourcesData = await sourcesResponse.json();
          if (sourcesData.success && sourcesData.data) {
            // 언론사 데이터에서 name만 추출
            const sourceNames = sourcesData.data.map(source => source.name);
            setMediaSources(sourceNames);
          }
        }
      } catch (error) {
        console.error('카테고리/언론사 데이터 조회 실패:', error);
        // 에러 발생 시 기본값 사용
        setCategories(['정치', '경제', '사회', '생활/문화', 'IT/과학', '세계', '스포츠', '연예']);
        setMediaSources(['조선일보', 'KBS', 'SBS', 'MBC', '한겨레', '중앙일보', '동아일보', '경향신문', '연합뉴스', 'YTN']);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, []);

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

      // 사용자 프로필 셋업 API 호출 (user_preferences 테이블에 저장)
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

  // 데이터 로딩 중일 때 로딩 표시
  if (dataLoading) {
    return (
      <div className="profile-setup-page">
        <div className="profile-setup-container">
          <div className="profile-setup-form">
            <div className="profile-setup-header">
              <h2>프로필 설정</h2>
              <p>카테고리와 언론사 정보를 불러오는 중...</p>
            </div>
            <div className="loading-spinner">로딩 중...</div>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="step-section">
            <div className="section-title">
              <h3>기본 정보</h3>
              <p>개인화된 뉴스 추천을 위해 기본 정보를 입력해주세요. (선택사항)</p>
            </div>

            <div className="form-field">
              <label htmlFor="age">나이</label>
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

            <div className="form-field">
              <label htmlFor="gender">성별</label>
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

            <div className="form-field">
              <label htmlFor="location">지역</label>
              <select
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">지역을 선택하세요</option>
                <option value="서울">서울</option>
                <option value="경기">경기</option>
                <option value="강원">강원</option>
                <option value="충북">충북</option>
                <option value="충남">충남</option>
                <option value="전북">전북</option>
                <option value="전남">전남</option>
                <option value="경북">경북</option>
                <option value="경남">경남</option>
                <option value="제주">제주</option>
              </select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-section">
            <div className="section-title">
              <h3>관심 카테고리</h3>
              <p>관심 있는 뉴스 카테고리를 선택해주세요. 최소 1개 이상 선택해야 합니다.</p>
            </div>

            <div className="selection-status">
              <div className={`status-badge ${formData.preferredCategories.length > 0 ? 'success' : 'warning'}`}>
                <span>✓</span>
                선택됨: {formData.preferredCategories.length}개 / {categories.length}개
              </div>
              {formData.preferredCategories.length === 0 && (
                <div className="requirement-hint">
                  ⚠️ 최소 1개 이상의 카테고리를 선택해주세요
                </div>
              )}
            </div>

            <div className="selection-grid">
              {categories.map(category => (
                <label key={category} className={`selection-item ${formData.preferredCategories.includes(category) ? 'selected' : ''}`}>
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
        );

      case 3:
        return (
          <div className="step-section">
            <div className="section-title">
              <h3>선호 언론사</h3>
              <p>선호하는 언론사를 선택해주세요. 최소 1개 이상 선택해야 합니다.</p>
            </div>

            <div className="selection-status">
              <div className={`status-badge ${formData.preferredSources.length > 0 ? 'success' : 'warning'}`}>
                <span>✓</span>
                선택됨: {formData.preferredSources.length}개 / {mediaSources.length}개
              </div>
              {formData.preferredSources.length === 0 && (
                <div className="requirement-hint">
                  ⚠️ 최소 1개 이상의 언론사를 선택해주세요
                </div>
              )}
            </div>

            <div className="selection-grid">
              {mediaSources.map(source => (
                <label key={source} className={`selection-item ${formData.preferredSources.includes(source) ? 'selected' : ''}`}>
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
        );

      default:
        return null;
    }
  };

  const getProgressPercentage = () => {
    return (currentStep / 3) * 100;
  };

  return (
    <div className="profile-setup-page">
      <div className="profile-setup-container">
        <div className="profile-setup-form">
          <div className="profile-setup-header">
            <h2>프로필 설정</h2>
            <p>안녕하세요, {userInfo.name}님! 맞춤 뉴스를 위해 추가 정보를 입력해주세요.</p>
          </div>

          <div className="step-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>

            <div className="step-indicators">
              <div className={`step-indicator ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
                <div className="step-circle">1</div>
                <div className="step-label">기본 정보</div>
              </div>
              <div className={`step-indicator ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
                <div className="step-circle">2</div>
                <div className="step-label">관심 카테고리</div>
              </div>
              <div className={`step-indicator ${currentStep >= 3 ? 'active' : ''}`}>
                <div className="step-circle">3</div>
                <div className="step-label">선호 언론사</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="profile-setup-content" onKeyDown={(e) => {
            if (e.key === 'Enter' && currentStep !== 3) {
              e.preventDefault();
              nextStep();
            }
          }}>
            {error && (
              <div className="message error">
                {error}
              </div>
            )}

            {success && (
              <div className="message success">
                {success}
              </div>
            )}

            {renderStepContent()}

            <div className="form-actions">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="action-btn secondary"
                  onClick={prevStep}
                  disabled={loading}
                >
                  이전
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  className="action-btn primary"
                  onClick={nextStep}
                  disabled={loading || !isStepValid()}
                >
                  {loading ? '처리 중...' : '다음'}
                </button>
              ) : (
                <button
                  type="submit"
                  className="action-btn primary"
                  disabled={loading || !isStepValid()}
                >
                  {loading ? '설정 중...' : '프로필 설정 완료'}
                </button>
              )}

              <button
                type="button"
                className="action-btn tertiary"
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
