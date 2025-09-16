import { useState, useEffect } from 'react';
import { commonAPI } from '../services/api';

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
        
        // 모든 공통 데이터 한번에 가져오기
        const response = await commonAPI.getAll();
        
        if (response.success) {
          setData(response.data);
        } else {
          throw new Error('Failed to fetch common data');
        }
      } catch (err) {
        console.error('Error fetching common data:', err);
        setError(err.message);
        
        // 에러 시 기본값 설정 (하드코딩 백업)
        setData({
          categories: ['정치', '경제', '사회', '생활/문화', 'IT/과학', '세계', '스포츠', '연예'],
          mediaSources: [
            { name: '조선일보', domain: 'chosun.com', oid: '023' },
            { name: 'KBS', domain: 'kbs.co.kr', oid: '056' },
            { name: 'SBS', domain: 'sbs.co.kr', oid: '055' }
          ],
          searchOptions: {
            sort: [
              { value: 'date', label: '최신순' },
              { value: 'sim', label: '정확도순' }
            ],
            pageSize: [10, 20, 30, 50]
          }
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