const axios = require('axios');

// API 서버에 크롤링 요청
async function testCrawler() {
  try {
    console.log('크롤링 API 테스트 시작...');

    // 단일 카테고리 테스트 (정치 뉴스 2개만)
    const response = await axios.post('http://localhost:3000/api/crawler/crawl', {
      category: '정치',
      limit: 2
    });

    console.log('크롤링 결과:', response.data);

    if (response.data.success && response.data.articles.length > 0) {
      console.log('\n수집된 기사:');
      response.data.articles.forEach((article, index) => {
        console.log(`\n[기사 ${index + 1}]`);
        console.log(`제목: ${article.title}`);
        console.log(`URL: ${article.url}`);
        console.log(`요약: ${article.aiSummary || article.content?.substring(0, 100) + '...'}`);
        console.log(`본문 길이: ${article.content?.length || 0}자`);

        // 댓글 정책이나 약관 텍스트가 포함되어 있는지 확인
        const policyKeywords = ['댓글 운영', '삭제 기준', '이용약관', '저작권자'];
        const hasPolicy = policyKeywords.some(keyword =>
          article.content?.includes(keyword) || article.aiSummary?.includes(keyword)
        );

        if (hasPolicy) {
          console.log('⚠️  경고: 댓글 정책/약관 텍스트가 감지됨!');
        } else {
          console.log('✅ 정상적인 뉴스 콘텐츠로 보임');
        }
      });
    }

  } catch (error) {
    console.error('테스트 실패:', error.response?.data || error.message);
  }
}

// 테스트 실행
testCrawler();