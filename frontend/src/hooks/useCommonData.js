import { useState, useEffect } from 'react';
import { commonAPI } from '../services/api';
import { CATEGORIES_WITH_ALL, MEDIA_SOURCES_WITH_DOMAIN, SEARCH_OPTIONS } from '../constants/commonData';

// 공통 데이터 훅
export const useCommonData = () => {
  const [data, setData] = useState({
    categories: [],
    mediaSources: [],
    searchOptions: {
      sort: [],
      pageSize: []
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCommonData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 공통 상수를 사용하여 프로필 셋업과 동일한 데이터 제공
        setData({
          categories: CATEGORIES_WITH_ALL,
          mediaSources: MEDIA_SOURCES_WITH_DOMAIN,
          searchOptions: SEARCH_OPTIONS
        });
      } catch (err) {
        console.error('Error fetching common data:', err);
        setError(err.message);
        
        // 에러 시에도 공통 상수를 사용하여 일관성 유지
        setData({
          categories: CATEGORIES_WITH_ALL,
          mediaSources: MEDIA_SOURCES_WITH_DOMAIN,
          searchOptions: SEARCH_OPTIONS
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