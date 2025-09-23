import { useState, useEffect } from 'react';
import { commonAPI } from '../services/api';
import { CATEGORIES_WITH_ALL, MEDIA_SOURCES_WITH_DOMAIN, SEARCH_OPTIONS } from '../constants/commonData';

// 사용자 선호도를 반영한 공통 데이터 훅
export const useCommonData = () => {
  const [data, setData] = useState({
    categories: [],
    mediaSources: [],
    searchOptions: {
      sort: [],
      pageSize: []
    },
    userPreferences: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCommonData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 사용자 선호도 API 호출
        let userPreferences = null;
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');

        if (token) {
          try {
            const response = await fetch('/api/auth/preferences', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              const prefData = await response.json();
              userPreferences = prefData.data;
            }
          } catch (prefError) {
            console.warn('사용자 선호도 조회 실패:', prefError);
          }
        }

        // 데이터베이스에서 실제 카테고리와 언론사 목록 가져오기
        let categories = CATEGORIES_WITH_ALL;
        let mediaSources = MEDIA_SOURCES_WITH_DOMAIN;

        try {
          // 실제 API에서 카테고리와 언론사 목록 가져오기
          const [categoriesResponse, sourcesResponse] = await Promise.all([
            fetch('/api/common/categories'),
            fetch('/api/common/media-sources')
          ]);

          if (categoriesResponse.ok) {
            const categoriesData = await categoriesResponse.json();
            if (categoriesData.success && categoriesData.data) {
              categories = ['전체', ...categoriesData.data];
            }
          }

          if (sourcesResponse.ok) {
            const sourcesData = await sourcesResponse.json();
            if (sourcesData.success && sourcesData.data) {
              mediaSources = sourcesData.data;
            }
          }
        } catch (apiError) {
          console.warn('API 데이터 조회 실패, 상수 데이터 사용:', apiError);
        }

        // 사용자 선호도가 있다면 우선순위 적용
        if (userPreferences) {
          // 선호 카테고리 우선 배치
          if (userPreferences.preferredCategories && Array.isArray(userPreferences.preferredCategories)) {
            const preferredCats = userPreferences.preferredCategories;
            const otherCats = categories.filter(cat => cat === '전체' || !preferredCats.includes(cat));
            categories = ['전체', ...preferredCats, ...otherCats.slice(1)];
          }

          // 선호 언론사 우선 배치
          if (userPreferences.preferredSources && Array.isArray(userPreferences.preferredSources)) {
            const preferredSources = userPreferences.preferredSources;
            const preferredSourcesData = mediaSources.filter(source => preferredSources.includes(source.name));
            const otherSources = mediaSources.filter(source => !preferredSources.includes(source.name));
            mediaSources = [...preferredSourcesData, ...otherSources];
          }
        }

        setData({
          categories,
          mediaSources,
          searchOptions: SEARCH_OPTIONS,
          userPreferences
        });
      } catch (err) {
        console.error('Error fetching common data:', err);
        setError(err.message);

        // 에러 시에도 공통 상수를 사용하여 일관성 유지
        setData({
          categories: CATEGORIES_WITH_ALL,
          mediaSources: MEDIA_SOURCES_WITH_DOMAIN,
          searchOptions: SEARCH_OPTIONS,
          userPreferences: null
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCommonData();
  }, []);

  return {
    categories: data.categories,
    mediaSources: data.mediaSources,
    searchOptions: data.searchOptions,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      // 데이터 재요청 로직을 여기에 추가할 수 있음
    }
  };
};

// 개별 데이터만 필요한 경우를 위한 훅들
export const useCategories = () => {
  const { categories, loading, error } = useCommonData();
  return { categories, loading, error };
};

export const useMediaSources = () => {
  const { mediaSources, loading, error } = useCommonData();
  return { mediaSources, loading, error };
};

export const useSearchOptions = () => {
  const { searchOptions, loading, error } = useCommonData();
  return { searchOptions, loading, error };
};

export default useCommonData;