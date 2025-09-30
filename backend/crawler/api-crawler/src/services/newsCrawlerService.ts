import axios from 'axios';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';
import { AppDataSource } from '../config/database';
import { NewsArticle } from '../entities/NewsArticle';
import logger from '../config/logger';

interface NaverNewsApiResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverNewsItem[];
}

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface ParsedNews {
  title: string;
  content: string;
  journalist?: string;
  mediaSource?: string;
  pubDate: Date;
  imageUrl?: string;
  videoUrl?: string;
}

class NewsCrawlerService {
  // Naver API 키 설정 (2개 키를 라운드 로빈 방식으로 사용)
  private naverApiKeys: Array<{ clientId: string; clientSecret: string }> = [];
  private currentKeyIndex: number = 0;

  constructor() {
    logger.debug('[CRAWLER DEBUG] NewsCrawlerService constructor 실행됨');

    // 환경변수에서 2개의 Naver API 키 로드
    const key1Id = process.env.NAVER_CLIENT_ID || '';
    const key1Secret = process.env.NAVER_CLIENT_SECRET || '';
    const key2Id = process.env.NAVER_CLIENT_ID_2 || '';
    const key2Secret = process.env.NAVER_CLIENT_SECRET_2 || '';

    logger.debug(`[CRAWLER DEBUG] Key1 존재: ${!!key1Id}, Key2 존재: ${!!key2Id}`);

    // 첫 번째 키 추가
    if (key1Id && key1Secret) {
      this.naverApiKeys.push({ clientId: key1Id, clientSecret: key1Secret });
      logger.debug('[CRAWLER DEBUG] ✅ Naver API Key #1 로드됨');
    } else {
      logger.debug('[CRAWLER DEBUG] ❌ Naver API Key #1 없음');
    }

    // 두 번째 키 추가
    if (key2Id && key2Secret) {
      this.naverApiKeys.push({ clientId: key2Id, clientSecret: key2Secret });
      logger.debug('[CRAWLER DEBUG] ✅ Naver API Key #2 로드됨');
    } else {
      logger.debug('[CRAWLER DEBUG] ❌ Naver API Key #2 없음');
    }

    logger.debug(`[CRAWLER DEBUG] 🔑 총 ${this.naverApiKeys.length}개의 Naver API 키 사용 가능`);
  }

  // 현재 사용할 API 키 가져오기 (라운드 로빈)
  private getCurrentApiKey(): { clientId: string; clientSecret: string } {
    if (this.naverApiKeys.length === 0) {
      throw new Error('Naver API 키가 설정되지 않았습니다.');
    }

    const key = this.naverApiKeys[this.currentKeyIndex];
    logger.debug(`[CRAWLER DEBUG] API Key #${this.currentKeyIndex + 1} 사용 중`);

    // 다음 요청을 위해 인덱스 증가 (라운드 로빈)
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.naverApiKeys.length;

    return key;
  }
  // 텍스트 정리 함수
  // URL에서 언론사 추출
  private extractMediaSourceFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      // 서브도메인 포함 패턴 체크
      // 동아일보 (sports.donga.com, news.donga.com 등)
      if (domain.endsWith('.donga.com') || domain === 'donga.com') {
        return '동아일보';
      }
      // 조선일보 (biz.chosun.com, sports.chosun.com 등)
      if (domain.endsWith('.chosun.com') || domain === 'chosun.com') {
        return '조선일보';
      }
      // 한겨레
      if (domain.endsWith('.hani.co.kr') || domain === 'hani.co.kr') {
        return '한겨레';
      }
      // 경향신문 (sports.khan.co.kr, biz.khan.co.kr 등)
      if (domain.endsWith('.khan.co.kr') || domain === 'khan.co.kr') {
        return '경향신문';
      }
      // 중앙일보 (news.joins.com 등)
      if (domain.endsWith('.joins.com') || domain === 'joins.com' ||
          domain.endsWith('.joongang.co.kr') || domain === 'joongang.co.kr') {
        return '중앙일보';
      }
      // 연합뉴스
      if (domain.endsWith('.yna.co.kr') || domain === 'yna.co.kr' ||
          domain.endsWith('.yonhapnews.co.kr') || domain === 'yonhapnews.co.kr') {
        return '연합뉴스';
      }
      // 매일경제 (stock.mk.co.kr, news.mk.co.kr 등)
      if (domain.endsWith('.mk.co.kr') || domain === 'mk.co.kr') {
        return '매일경제';
      }
      // 한국경제 (news.hankyung.com, markets.hankyung.com 등)
      if (domain.endsWith('.hankyung.com') || domain === 'hankyung.com') {
        return '한국경제';
      }
      // 머니투데이 (news.mt.co.kr, stock.mt.co.kr 등)
      if (domain.endsWith('.mt.co.kr') || domain === 'mt.co.kr') {
        return '머니투데이';
      }
      // YTN (science.ytn.co.kr 등)
      if (domain.endsWith('.ytn.co.kr') || domain === 'ytn.co.kr') {
        return 'YTN';
      }
      // JTBC (news.jtbc.co.kr 등)
      if (domain.endsWith('.jtbc.co.kr') || domain === 'jtbc.co.kr' ||
          domain.endsWith('.jtbc.joins.com') || domain === 'jtbc.joins.com') {
        return 'JTBC';
      }
      // 문화일보
      if (domain.endsWith('.munhwa.com') || domain === 'munhwa.com') {
        return '문화일보';
      }
      // 세계일보
      if (domain.endsWith('.segye.com') || domain === 'segye.com') {
        return '세계일보';
      }
      // 한국일보
      if (domain.endsWith('.hankookilbo.com') || domain === 'hankookilbo.com') {
        return '한국일보';
      }

      // 도메인 기반 언론사 매핑
      const domainToMedia: { [key: string]: string } = {
        'yna.co.kr': '연합뉴스',
        'yonhapnews.co.kr': '연합뉴스',
        'hankookilbo.com': '한국일보',
        'sbs.co.kr': 'SBS',
        'kbs.co.kr': 'KBS',
        'mbc.co.kr': 'MBC',
        'jtbc.co.kr': 'JTBC',
        'mt.co.kr': '머니투데이',
        'mk.co.kr': '매일경제',
        'hankyung.com': '한국경제',
        'wikitree.co.kr': '위키트리',
        'news1.kr': '뉴스1',
        'newsen.com': '뉴스엔',
        'heraldcorp.com': '헤럴드경제',
        'choicenews.co.kr': '초이스경제',
        'ccnnews.co.kr': '충청뉴스',
        'dailian.co.kr': '데일리안',
        'sateconomy.co.kr': '새턴경제',
        'biz.heraldcorp.com': '헤럴드경제',
        'jmbc.co.kr': '전주MBC'
      };

      // 정확한 도메인 매치
      if (domainToMedia[domain]) {
        return domainToMedia[domain];
      }

      // 서브도메인 제거하고 매치 시도
      const mainDomain = domain.split('.').slice(-2).join('.');
      if (domainToMedia[mainDomain]) {
        return domainToMedia[mainDomain];
      }

      // 부분 매치 시도
      for (const [key, value] of Object.entries(domainToMedia)) {
        if (domain.includes(key.split('.')[0])) {
          return value;
        }
      }

      return '';
    } catch (error) {
      logger.debug(`[DEBUG] URL 파싱 오류: ${url}`);
      return '';
    }
  }

  // 제목에서 언론사 추출 (개선된 버전)
  private extractMediaSourceFromTitle(title: string): string {
    // 제목 끝에 있는 언론사명 패턴들
    const patterns = [
      /\s-\s(.+)$/, // "제목 - 언론사"
      /\s\|\s(.+)$/, // "제목 | 언론사"
      /\s(.+)$/,     // "제목 언론사" (마지막 단어)
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        const candidate = match[1].trim();
        // 언론사명으로 보이는 패턴인지 확인
        if (candidate.length >= 2 && candidate.length <= 15 &&
            !candidate.includes('http') &&
            !candidate.match(/^\d+$/)) {
          return candidate;
        }
      }
    }

    return '';
  }

  private cleanText(text: string): string {
    if (!text) return '';

    return text
      // HTML 태그 제거
      .replace(/<[^>]*>/g, '')
      // CSS 스타일 제거
      .replace(/\{[^}]*\}/g, '')
      // CSS 선택자 패턴 제거
      .replace(/[a-zA-Z-]+:\s*[^;]+;/g, '')
      .replace(/\.[a-zA-Z-]+\s*\{[^}]*\}/g, '')
      .replace(/#[a-zA-Z-]+\s*\{[^}]*\}/g, '')
      // JavaScript 코드 제거
      .replace(/function\s*\([^)]*\)\s*\{[^}]*\}/g, '')
      .replace(/var\s+[^;]+;/g, '')
      .replace(/\$\([^)]*\)[^;]*;/g, '')
      // 특수 문자 및 패턴 제거
      .replace(/margin-top:\s*\d+px/gi, '')
      .replace(/Item:not\([^)]*\)/gi, '')
      .replace(/\{[^}]*margin[^}]*\}/gi, '')
      // 연속된 공백, 탭, 줄바꿈 정리
      .replace(/\s+/g, ' ')
      .replace(/\t+/g, ' ')
      .replace(/\n+/g, ' ')
      // 특수문자 정리
      .replace(/[^\w\s가-힣.,!?""''()\-]/g, '')
      // 앞뒤 공백 제거
      .trim();
  }

  // 개선된 본문 정리 함수
  private cleanContent(text: string): string {
    if (!text) return '';

    return text
      // HTML 태그 제거
      .replace(/<[^>]*>/g, '')
      // 웹사이트 공통 요소들 제거
      .replace(/로그인|회원가입|구독|공유하기|페이스북|트위터|카카오톡/g, '')
      .replace(/SNS 퍼가기|URL 복사|글자크기 설정/g, '')
      .replace(/뉴스 요약쏙|AI 요약은|OpenAI의 최신 기술을/g, '')
      .replace(/읽는 재미의 발견|새로워진|크롬브라우저만 가능/g, '')
      .replace(/웹 알림 동의|다양한 경제, 산업 현장의/g, '')
      // 기자 서명 패턴 정리
      .replace(/기자\s*구독\s*공유하기/g, '')
      .replace(/\s*기자\s*수정\s*\d{4}-\d{2}-\d{2}/g, '')
      .replace(/등록\s*\d{4}-\d{2}-\d{2}/g, '')
      // 연속된 공백 정리
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  // 유효한 본문 내용인지 검증하는 함수
  private isValidContent(text: string): boolean {
    if (!text || text.length < 50) return false;

    // 웹사이트 UI 요소들이 많이 포함된 경우 제외
    const uiKeywords = [
      '로그인', '회원가입', '구독', '공유하기',
      '페이스북', '트위터', '카카오톡', 'SNS',
      '글자크기', '창 닫기', '웹 알림', '크롬브라우저',
      '읽는 재미의 발견', '새로워진'
    ];

    const uiKeywordCount = uiKeywords.reduce((count, keyword) => {
      return count + (text.includes(keyword) ? 1 : 0);
    }, 0);

    // UI 키워드가 5개 이상이면 본문이 아닌 것으로 판단 (기존 3개에서 5개로 완화)
    if (uiKeywordCount >= 5) return false;

    // 의미있는 한글 문장이 있는지 확인 (조건 완화)
    const koreanContent = text.match(/[가-힣]{5,}/g);
    if (!koreanContent || koreanContent.length === 0) return false;

    // 전체 텍스트에서 한글 비율이 30% 이상이면 유효한 것으로 판단
    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    const koreanRatio = koreanChars / text.length;

    logger.debug(`[DEBUG] 콘텐츠 유효성 검사: 길이=${text.length}, UI키워드=${uiKeywordCount}, 한글비율=${(koreanRatio*100).toFixed(1)}%`);

    return koreanRatio >= 0.3; // 30% 이상 한글이면 유효
  }

  private readonly categories = [
    { name: '정치', query: '정치' },
    { name: '경제', query: '경제' },
    { name: '사회', query: '사회' },
    { name: '생활/문화', query: '생활 문화' },
    { name: 'IT/과학', query: 'IT 과학 기술' },
    { name: '세계', query: '세계 국제' },
    { name: '스포츠', query: '스포츠' },
    { name: '연예', query: '연예' }
  ];

  async fetchNewsFromNaver(query: string, display: number = 20): Promise<NaverNewsItem[]> {
    try {
      // 오늘 날짜를 검색어에 추가하여 최신 뉴스 우선 수집
      const today = new Date();
      const todayStr = today.getFullYear() + '년 ' + (today.getMonth() + 1) + '월 ' + today.getDate() + '일';
      const enhancedQuery = `${query} ${todayStr}`;

      // 한글 쿼리를 URL 인코딩
      const encodedQuery = encodeURIComponent(enhancedQuery);
      const url = `https://openapi.naver.com/v1/search/news.json?query=${encodedQuery}&display=${display}&start=1&sort=date`;

      logger.debug(`[API DEBUG] 검색어: "${enhancedQuery}"`);

      // 라운드 로빈 방식으로 API 키 선택
      const apiKey = this.getCurrentApiKey();

      const response = await axios.get(url, {
        headers: {
          'X-Naver-Client-Id': apiKey.clientId,
          'X-Naver-Client-Secret': apiKey.clientSecret,
        }
      });

      const data: NaverNewsApiResponse = response.data;
      logger.debug(`[API DEBUG] 쿼리 "${query}" -> ${data.items.length}개 결과 반환 (total: ${data.total})`);

      // 최신 뉴스만 필터링 (오늘, 어제 뉴스만)
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const recentItems = data.items.filter(item => {
        const pubDate = new Date(item.pubDate);
        return pubDate >= twoDaysAgo;
      });

      logger.debug(`[API DEBUG] 최근 2일 내 뉴스 필터링: ${data.items.length}개 -> ${recentItems.length}개`);
      return recentItems;
    } catch (error) {
      logger.error('네이버 뉴스 API 호출 실패:', error);
      return [];
    }
  }

  async parseNewsContent(url: string): Promise<ParsedNews | null> {
    try {
      logger.debug(`[DEBUG] 뉴스 파싱 시작: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate'
        },
        timeout: 10000,
        responseType: 'arraybuffer'
      });

      logger.debug(`[DEBUG] HTTP 응답 상태: ${response.status}`);

      // 인코딩 처리 - 한글 깨짐 방지
      let html = '';
      if (response.data instanceof Buffer || Buffer.isBuffer(response.data)) {
        const buffer = Buffer.from(response.data);

        logger.debug(`[DEBUG] 버퍼 크기: ${buffer.length} bytes`);

        // Content-Type 헤더에서 charset 확인
        const contentType = response.headers['content-type'] || '';
        logger.debug(`[DEBUG] Content-Type: ${contentType}`);

        let encoding = 'utf8';
        if (contentType.includes('charset=euc-kr') || contentType.includes('charset=ks_c_5601-1987')) {
          encoding = 'euc-kr';
        } else if (contentType.includes('charset=utf-8')) {
          encoding = 'utf8';
        }

        logger.debug(`[DEBUG] 감지된 인코딩: ${encoding}`);

        // iconv-lite로 디코딩
        try {
          if (encoding === 'euc-kr') {
            html = iconv.decode(buffer, 'euc-kr');
          } else {
            html = iconv.decode(buffer, 'utf8');
            // UTF-8이 깨졌다면 EUC-KR로 재시도
            if (html.includes('�') || html.includes('????')) {
              html = iconv.decode(buffer, 'euc-kr');
              logger.debug(`[DEBUG] EUC-KR로 재시도`);
            }
          }
        } catch (error) {
          logger.debug(`[DEBUG] 인코딩 실패, UTF-8 기본값 사용:`, error);
          html = buffer.toString('utf8');
        }
      } else {
        html = response.data;
      }

      const $ = cheerio.load(html, { xmlMode: false });

      // 다양한 뉴스 사이트 구조에 맞게 파싱
      const titleSelectors = [
        'h2.media_end_head_headline',
        'h3.tit_view',
        '.article_header h3',
        '.article-header h1',
        '.article-title',
        '.news-title',
        '.post-title',
        '.entry-title',
        '.headline',
        '.subject',
        'title',
        'h1',
        'h2',
        'h3',
        '[class*="title"]',
        '[class*="headline"]'
      ];

      let title = '';
      for (const selector of titleSelectors) {
        const found = this.cleanText($(selector).first().text());
        logger.debug(`[DEBUG] 제목 셀렉터 ${selector}: "${found}"`);
        if (found && found.length > 5 && found.length < 200) {
          title = found;
          break;
        }
      }
      logger.debug(`[DEBUG] 최종 추출된 제목: ${title}`);

      // 본문 추출 (개선된 버전)
      let content = '';
      const contentSelectors = [
        // 네이버 뉴스
        '#dic_area',
        '#articleBodyContents',
        // 네이버 스포츠
        '.news_end_body_container',
        // 조선일보, 동아일보 등
        '.article_body',
        '.article_view .article_body',
        // 한겨레, 경향신문 등
        '.article-content',
        '.article-body',
        // 블로그형 언론사
        '.post-content',
        '.entry-content',
        // 일반적인 뉴스 사이트
        '.news-content',
        '.text-content',
        '.story-body',
        '.article-text',
        // 마지막 시도 (가장 안전한 것들만)
        'article .content',
        '.news-article .content'
      ];

      logger.debug(`[DEBUG] 본문 추출 시도 중...`);
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length === 0) continue;

        // 불필요한 요소 제거
        element.find('script, style, .ad, .advertisement, .share, .social, .comment, .related, .sidebar, .header, .footer, .nav, .menu').remove();

        let found = element.text();
        found = this.cleanContent(found);

        logger.debug(`[DEBUG] 셀렉터 ${selector}: ${found ? found.length : 0}자`);
        if (found && found.length > 100 && found.length < 10000 && this.isValidContent(found)) {
          content = found;
          logger.debug(`[DEBUG] 본문 추출 완료: ${content.substring(0, 100)}...`);
          break;
        }
      }

      // 대체 방법: 본문 p 태그들만 선별적으로 추출
      if (!content) {
        logger.debug(`[DEBUG] 대체 방법으로 본문 추출 시도...`);
        const paragraphs: string[] = [];
        $('p').each((_index, el) => {
          const $el = $(el);
          const parent = $el.parent();

          // 헤더, 네비게이션, 광고, 사이드바 등 제외
          if (parent.hasClass('header') || parent.hasClass('nav') ||
              parent.hasClass('sidebar') || parent.hasClass('ad') ||
              parent.hasClass('footer') || parent.hasClass('menu') ||
              parent.hasClass('share') || parent.hasClass('social')) {
            return;
          }

          const text = this.cleanContent($el.text());
          if (text && text.length > 20 && text.length < 1000) {
            paragraphs.push(text);
          }
        });

        if (paragraphs.length > 0) {
          const allText = paragraphs.join(' ');
          if (allText.length > 100 && this.isValidContent(allText)) {
            content = allText;
            logger.debug(`[DEBUG] 대체 방법으로 본문 추출 완료: ${content.substring(0, 100)}...`);
          }
        }
      }

      // 기자 정보 추출 (개선된 버전)
      let journalist = '';

      // 기자 이름 정리 함수
      const cleanJournalistName = (name: string): string => {
        if (!name) return '';

        // 이메일 주소, 전화번호, 기타 불필요한 정보 제거
        name = name
          .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // 이메일 제거
          .replace(/\d{2,4}-\d{2,4}-\d{4}/g, '') // 전화번호 제거
          .replace(/\d{3}-\d{3,4}-\d{4}/g, '') // 전화번호 제거
          .replace(/\([^)]*\)/g, '') // 괄호와 내용 제거
          .replace(/\[[^\]]*\]/g, '') // 대괄호와 내용 제거
          .replace(/기자|reporter|작성자|글쓴이|입력|수정|승인|배포|송고|편집|교정|교열/gi, '') // 불필요한 단어 제거
          .replace(/\d{4}[-.년년]\d{1,2}[-.월월]\d{1,2}/g, '') // 날짜 제거
          .replace(/\d{1,2}:\d{2}/g, '') // 시간 제거
          .replace(/[^\w\s가-힣]/g, ' ') // 특수문자를 공백으로
          .replace(/\s+/g, ' ') // 연속 공백 제거
          .trim();

        // 한글 이름만 추출 (2-4글자)
        const koreanNameMatch = name.match(/[가-힣]{2,4}/);
        if (koreanNameMatch) {
          const extractedName = koreanNameMatch[0];
          // 일반적이지 않은 이름 패턴 필터링
          if (!extractedName.match(/^(뉴스|기사|제공|출처|언론|매체|신문|방송|통신|미디어|편집|부서|팀장|대표|위원|의원|장관|차관|실장|국장|과장|부장|센터|연구소|대학교|교수|박사|석사|학사)$/)) {
            return extractedName;
          }
        }

        return '';
      };

      // 1단계: 다양한 셀렉터로 기자 정보 추출
      const journalistSelectors = [
        '.media_end_head_journalist .name',
        '.article_reporter .reporter_name',
        '.reporter .name',
        '.byline_p',
        '.reporter',
        '.author',
        '.writer',
        '.byline',
        '[class*="reporter"]',
        '[class*="author"]',
        '[class*="writer"]',
        '[class*="journalist"]'
      ];

      for (const selector of journalistSelectors) {
        const found = $(selector).text().trim();
        if (found && found.length > 1 && found.length < 100) {
          const cleanedName = cleanJournalistName(found);
          if (cleanedName && cleanedName.length >= 2 && cleanedName.length <= 4) {
            journalist = cleanedName;
            logger.debug(`[DEBUG] 셀렉터로 기자 추출: ${selector} -> "${found}" -> "${journalist}"`);
            break;
          }
        }
      }

      // 2단계: 본문에서 기자 정보 추출 (패턴 매칭)
      if (!journalist && content) {
        const reporterPatterns = [
          /([가-힣]{2,4})\s*기자/g,
          /기자\s*([가-힣]{2,4})/g,
          /\[([가-힣]{2,4})\s*기자\]/g,
          /=\s*([가-힣]{2,4})\s*기자/g
        ];

        for (const pattern of reporterPatterns) {
          const matches = [...content.matchAll(pattern)];
          if (matches && matches.length > 0) {
            for (const match of matches) {
              const extractedName = match[1] ? match[1].trim() : '';
              const cleanedName = cleanJournalistName(extractedName);
              if (cleanedName && cleanedName.length >= 2 && cleanedName.length <= 4) {
                journalist = cleanedName;
                logger.debug(`[DEBUG] 본문 패턴으로 기자 추출: "${match[0]}" -> "${journalist}"`);
                break;
              }
            }
            if (journalist) break;
          }
        }
      }

      // 1단계: URL에서 언론사 추출
      let mediaSource = this.extractMediaSourceFromUrl(url);

      // 2단계: HTML에서 언론사 정보 추출 (URL에서 추출 못한 경우)
      if (!mediaSource) {
        const mediaSelectors = [
          '.media_end_head_top .media_logo img',
          '.article_header .press_logo img',
          '.media_logo img',
          '.press_name',
          '.source',
          '.publisher',
          '[class*="press"]',
          '[class*="media"]',
          '[class*="source"]'
        ];

        for (const selector of mediaSelectors) {
          const element = $(selector);
          if (element.is('img')) {
            mediaSource = element.attr('alt') || element.attr('title') || '';
          } else {
            mediaSource = element.text().trim();
          }
          if (mediaSource && mediaSource.length > 1 && mediaSource.length < 50) {
            mediaSource = mediaSource.replace(/로고|logo|신문사|뉴스|news/gi, '').trim();
            if (mediaSource) break;
          }
        }
      }

      // 3단계: 제목에서 언론사 추출 (마지막 방법)
      if (!mediaSource) {
        mediaSource = this.extractMediaSourceFromTitle(title);
      }

      // 이미지 URL 추출 - 본문 이미지 우선 (로고 제외)
      const imageSelectors = [
        '#articleBodyContents img',
        '.article_body img',
        '.news_end_body_container img',
        'div.article img',
        'div.content img',
        '.post-content img',
        'article p img',
        'article div img',
        '.news-article img',
        '.story-body img',
        '.entry-content img',
        'main img',
        'section img',
        'img[src*=".jpg"]',
        'img[src*=".jpeg"]',
        'img[src*=".png"]',
        'img[src*=".gif"]',
        'img[src*=".webp"]'
      ];

      let imageUrl = '';
      logger.debug(`[DEBUG] 이미지 추출 시도 중...`);
      for (const selector of imageSelectors) {
        const images = $(selector);
        for (let i = 0; i < images.length; i++) {
          const src = $(images[i]).attr('src') || '';
          const alt = $(images[i]).attr('alt') || '';
          const className = $(images[i]).attr('class') || '';

          logger.debug(`[DEBUG] 이미지 셀렉터 ${selector}[${i}]: ${src} (alt: ${alt})`);

          // 로고나 아이콘 이미지 제외 (더 강화)
          const isLogo = src ? (
            alt.toLowerCase().includes('logo') ||
            className.toLowerCase().includes('logo') ||
            src.toLowerCase().includes('logo') ||
            src.toLowerCase().includes('banner') ||
            src.toLowerCase().includes('ad') ||
            src.toLowerCase().includes('icon') ||
            alt.toLowerCase().includes('아이콘') ||
            alt.toLowerCase().includes('로고') ||
            alt.toLowerCase().includes('배너') ||
            src.includes('/logo/') ||
            src.includes('/icon/') ||
            src.includes('/banner/')
          ) : true;

          // 이미지 크기도 확인 (너무 작은 이미지 제외)
          const width = parseInt($(images[i]).attr('width') || '0');
          const height = parseInt($(images[i]).attr('height') || '0');
          const isTooSmall = (width > 0 && width < 100) || (height > 0 && height < 100);

          if (src && (src.startsWith('http') || src.startsWith('//')) && !isLogo && !isTooSmall) {
            imageUrl = src.startsWith('//') ? 'https:' + src : src;
            logger.debug(`[DEBUG] 이미지 URL 발견: ${imageUrl} (크기: ${width}x${height})`);
            break;
          } else if (src) {
            logger.debug(`[DEBUG] 이미지 제외됨 - 로고: ${isLogo}, 작음: ${isTooSmall}, URL: ${src}`);
          }
        }
        if (imageUrl) break;
      }

      // 발행 시간 추출
      const timeSelectors = [
        '.media_end_head_info_datestamp_time',
        '.article_info .date',
        '.date_time'
      ];

      let pubDateString = '';
      for (const selector of timeSelectors) {
        const found = $(selector).text().trim();
        if (found) {
          pubDateString = found;
          break;
        }
      }

      const pubDate = pubDateString ? new Date(pubDateString) : new Date();

      if (!title || !content) {
        logger.info('파싱 실패: 제목 또는 내용이 없음', { title: !!title, content: !!content });
        return null;
      }

      return {
        title,
        content,
        journalist: journalist || undefined,
        mediaSource: mediaSource || undefined,
        pubDate,
        imageUrl: imageUrl || undefined
      };

    } catch (error) {
      logger.error('뉴스 파싱 실패:', error);
      return null;
    }
  }

  async saveNewsToDatabase(parsedNews: ParsedNews, categoryName: string, originalUrl: string): Promise<NewsArticle | null> {
    try {
      const newsRepo = AppDataSource.getRepository(NewsArticle);

      // 중복 체크
      const existingNews = await newsRepo.findOne({ where: { url: originalUrl } });
      if (existingNews) {
        logger.info('이미 존재하는 뉴스:', originalUrl);

        // 이미 존재하는 기사도 분석이 없으면 분석 실행
        const biasRepo = AppDataSource.getRepository('BiasAnalysis');
        const existingAnalysis = await biasRepo.findOne({ where: { articleId: existingNews.id } });

        if (!existingAnalysis && existingNews.content) {
          try {
            await this.analyzeBias(existingNews.id, existingNews.content);
            logger.info(`[기존 기사 분석 완료] 기사 ID ${existingNews.id}`);
          } catch (biasError) {
            logger.error(`[기존 기사 분석 실패] 기사 ID ${existingNews.id}:`, biasError);
          }
        }

        return existingNews;
      }

      // 카테고리 ID 매핑
      const categoryIdMap: { [key: string]: number } = {
        '정치': 1,
        '경제': 2,
        '사회': 3,
        '연예': 4,
        '생활/문화': 5,
        'IT/과학': 6,
        '세계': 7,
        '스포츠': 8
      };

      // 언론사 ID 매핑 (실제 DB ID 기준)
      const sourceIdMap: { [key: string]: number } = {
        '연합뉴스': 1, '동아일보': 20, '문화일보': 21,
        '세계일보': 22, '조선일보': 23, '중앙일보': 25,
        '한겨레': 28, '경향신문': 32, '한국일보': 55,
        '매일경제': 56, '한국경제': 214, '머니투데이': 421,
        'YTN': 437, 'JTBC': 448,
        '기타': 449  // 목록에 없는 언론사는 기타로 분류
      };

      // URL과 제목에서 언론사 추출 (RSS 크롤러와 동일한 방식)
      let extractedSource = this.extractSourceFromURL(originalUrl) || '';

      if (!extractedSource && parsedNews.mediaSource) {
        extractedSource = parsedNews.mediaSource;
      }

      if (!extractedSource) {
        // 제목에서 언론사 추출 (예: "뉴스 제목 - 조선일보" 형태)
        const titleMatch = parsedNews.title.match(/\-\s*([가-힣]+(?:신문|일보|경제|투데이|뉴스|방송|TV)?)\s*$/);
        if (titleMatch) {
          extractedSource = titleMatch[1];
        }
      }

      // 추출된 언론사명으로 sourceId 결정
      // 매핑에 없는 언론사는 '기타'(449)로 분류
      const sourceId = sourceIdMap[extractedSource] || 449;

      logger.debug(`[DEBUG] 언론사 매핑: URL="${originalUrl.substring(0,50)}..." 제목="${parsedNews.title.substring(0,50)}..." -> 추출="${extractedSource}" -> sourceId: ${sourceId} ${sourceId === 449 ? '(기타)' : ''}`);

      // ✅ 모든 뉴스를 저장 (목록에 없으면 '기타'로 저장)

      // NewsArticle 생성 (새 스키마)
      const article = newsRepo.create({
        title: parsedNews.title,
        content: parsedNews.content,
        url: originalUrl,
        imageUrl: parsedNews.imageUrl,
        journalist: parsedNews.journalist,
        sourceId: sourceId,
        categoryId: categoryIdMap[categoryName] || 1, // 기본값: 정치
        pubDate: parsedNews.pubDate
      });

      const savedArticle = await newsRepo.save(article);

      // AI 편향성 분석 자동 실행
      try {
        await this.analyzeBias(savedArticle.id, parsedNews.content);
      } catch (biasError) {
        logger.error(`[편향성 분석 실패] 기사 ID ${savedArticle.id}:`, biasError);
        // 편향성 분석 실패해도 기사는 저장됨
      }

      return savedArticle;

    } catch (error) {
      logger.error('뉴스 저장 실패:', error);
      return null;
    }
  }

  // AI 요약 기능 제거 - 크롤러에서는 기본 크롤링만 수행

  async crawlNewsByCategory(categoryName: string, limit: number = 10): Promise<NewsArticle[]> {
    const category = this.categories.find(cat => cat.name === categoryName);
    if (!category) {
      throw new Error(`지원하지 않는 카테고리: ${categoryName}`);
    }

    logger.info(`${categoryName} 카테고리 뉴스 수집 시작...`);

    const naverNews = await this.fetchNewsFromNaver(category.query, limit);
    const results: NewsArticle[] = [];

    for (const item of naverNews) {
      try {
        // HTML 태그 제거
        const title = item.title.replace(/<[^>]*>/g, '');
        logger.info(`파싱 중: ${title}`);

        const parsed = await this.parseNewsContent(item.originallink || item.link);
        if (parsed) {
          const saved = await this.saveNewsToDatabase(parsed, categoryName, item.originallink || item.link);
          if (saved) {
            results.push(saved);
            logger.info(`저장 완료: ${saved.title}`);
          } else {
            logger.info(`[파싱 실패] 저장 실패: ${title}`);
          }
        } else {
          logger.info(`[파싱 실패] 내용 파싱 실패: ${title}`);
        }

        // 🕒 개별 뉴스 기사 간 요청 간격 조절
        // 네이버 API 부하 방지를 위한 딜레이 (밀리초 단위)
        // 1000ms = 1초, 500ms = 0.5초, 2000ms = 2초
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        logger.error(`뉴스 처리 실패: ${item.title}`, error);
      }
    }

    logger.info(`${categoryName} 카테고리 수집 완료: ${results.length}개`);
    return results;
  }

  async crawlAllCategories(limitPerCategory: number = 5): Promise<{ [category: string]: NewsArticle[] }> {
    const results: { [category: string]: NewsArticle[] } = {};

    for (const category of this.categories) {
      try {
        const articles = await this.crawlNewsByCategory(category.name, limitPerCategory);
        results[category.name] = articles;

        // 🕒 카테고리 간 요청 간격 조절
        // 각 카테고리 크롤링 완료 후 다음 카테고리로 넘어가기 전 대기 시간
        // 2000ms = 2초, 1000ms = 1초, 3000ms = 3초
        // 값을 줄이면 더 빠르게, 늘리면 더 안전하게 크롤링됩니다
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error(`${category.name} 카테고리 수집 실패:`, error);
        results[category.name] = [];
      }
    }

    return results;
  }

  getSupportedCategories(): string[] {
    return this.categories.map(cat => cat.name);
  }

  // URL에서 언론사 추출 (RSS 크롤러와 동일한 로직)
  private extractSourceFromURL(url: string): string {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      // 서브도메인 포함 패턴 체크
      // 동아일보 (sports.donga.com, news.donga.com 등)
      if (domain.endsWith('.donga.com') || domain === 'donga.com') {
        return '동아일보';
      }
      // 조선일보 (biz.chosun.com, sports.chosun.com 등)
      if (domain.endsWith('.chosun.com') || domain === 'chosun.com') {
        return '조선일보';
      }
      // 한겨레
      if (domain.endsWith('.hani.co.kr') || domain === 'hani.co.kr') {
        return '한겨레';
      }
      // 경향신문 (sports.khan.co.kr, biz.khan.co.kr 등)
      if (domain.endsWith('.khan.co.kr') || domain === 'khan.co.kr') {
        return '경향신문';
      }
      // 중앙일보 (news.joins.com 등)
      if (domain.endsWith('.joins.com') || domain === 'joins.com' ||
          domain.endsWith('.joongang.co.kr') || domain === 'joongang.co.kr') {
        return '중앙일보';
      }
      // 연합뉴스
      if (domain.endsWith('.yna.co.kr') || domain === 'yna.co.kr' ||
          domain.endsWith('.yonhapnews.co.kr') || domain === 'yonhapnews.co.kr') {
        return '연합뉴스';
      }
      // 매일경제 (stock.mk.co.kr, news.mk.co.kr 등)
      if (domain.endsWith('.mk.co.kr') || domain === 'mk.co.kr') {
        return '매일경제';
      }
      // 한국경제 (news.hankyung.com, markets.hankyung.com 등)
      if (domain.endsWith('.hankyung.com') || domain === 'hankyung.com') {
        return '한국경제';
      }
      // 머니투데이 (news.mt.co.kr, stock.mt.co.kr 등)
      if (domain.endsWith('.mt.co.kr') || domain === 'mt.co.kr') {
        return '머니투데이';
      }
      // YTN (science.ytn.co.kr 등)
      if (domain.endsWith('.ytn.co.kr') || domain === 'ytn.co.kr') {
        return 'YTN';
      }
      // JTBC (news.jtbc.co.kr 등)
      if (domain.endsWith('.jtbc.co.kr') || domain === 'jtbc.co.kr' ||
          domain.endsWith('.jtbc.joins.com') || domain === 'jtbc.joins.com') {
        return 'JTBC';
      }
      // 문화일보
      if (domain.endsWith('.munhwa.com') || domain === 'munhwa.com') {
        return '문화일보';
      }
      // 세계일보
      if (domain.endsWith('.segye.com') || domain === 'segye.com') {
        return '세계일보';
      }
      // 한국일보
      if (domain.endsWith('.hankookilbo.com') || domain === 'hankookilbo.com') {
        return '한국일보';
      }

      // 도메인 기반 언론사 매핑
      const domainToSource: { [key: string]: string } = {
        'mk.co.kr': '매일경제',
        'star.mt.co.kr': '머니투데이',
        'stardailynews.co.kr': '스타투데이',
        'yna.co.kr': '연합뉴스',
        'yonhapnews.co.kr': '연합뉴스',
        'hankyung.com': '한국경제',
        'mt.co.kr': '머니투데이',
        'kmib.co.kr': '국민일보',
        'munhwa.com': '문화일보',
        'segye.com': '세계일보',
        'hankookilbo.com': '한국일보',
        'ytn.co.kr': 'YTN',
        'jtbc.co.kr': 'JTBC'
      };

      // 정확한 도메인 매치
      if (domainToSource[domain]) {
        return domainToSource[domain];
      }

      // 서브도메인 제거하고 매치 시도
      const mainDomain = domain.split('.').slice(-2).join('.');
      if (domainToSource[mainDomain]) {
        return domainToSource[mainDomain];
      }

      // 부분 매치 시도
      for (const [key, value] of Object.entries(domainToSource)) {
        if (domain.includes(key.split('.')[0])) {
          return value;
        }
      }

      logger.debug(`[API DEBUG] 알 수 없는 도메인: ${domain}`);
      return '';
    } catch (error) {
      logger.debug(`[API DEBUG] URL 파싱 오류: ${url}`);
      return '';
    }
  }

  // AI 편향성 분석 실행
  private async analyzeBias(articleId: number, content: string): Promise<void> {
    if (!content || content.length < 100) {
      logger.info(`[편향성 분석 스킵] 기사 ${articleId}: 내용이 너무 짧음`);
      return;
    }

    try {
      const BIAS_AI_URL = 'http://bias-analysis-ai:8002';

      // bias-analysis-ai 서비스 호출
      const response = await axios.post(`${BIAS_AI_URL}/analyze/full`, {
        text: content,
        article_id: articleId
      }, {
        timeout: 30000 // 30초 타임아웃
      });

      if (response.data) {
        // BiasAnalysis 엔티티에 저장
        const biasRepo = AppDataSource.getRepository('BiasAnalysis');

        const political = response.data.political;
        const biasAnalysis = biasRepo.create({
          articleId: articleId,
          biasScore: political?.bias_score || 0,
          politicalLeaning: political?.leaning || 'neutral',
          confidence: response.data.sentiment?.confidence || 0,
          analysisData: response.data
        });

        await biasRepo.save(biasAnalysis);
        logger.info(`[편향성 분석 완료] 기사 ${articleId}: 점수 ${political?.bias_score || 0}`);
      }
    } catch (error: any) {
      logger.error(`[편향성 분석 오류] 기사 ${articleId}:`, error?.message || error);
      throw error;
    }
  }

  // 기존 기사 중 분석되지 않은 기사들을 분석
  async analyzeExistingArticles(limit: number = 100): Promise<{
    total: number;
    analyzed: number;
    failed: number;
    skipped: number;
  }> {
    const newsRepo = AppDataSource.getRepository('NewsArticle');

    // 분석되지 않은 기사 조회
    const articles = await newsRepo
      .createQueryBuilder('article')
      .leftJoin('bias_analysis', 'ba', 'ba.article_id = article.id')
      .where('ba.id IS NULL')
      .andWhere('article.content IS NOT NULL')
      .andWhere("LENGTH(article.content) >= 100")
      .limit(limit)
      .getMany();

    logger.info(`[기존 기사 분석] 총 ${articles.length}개 기사 분석 시작`);

    let analyzed = 0;
    let failed = 0;
    let skipped = 0;

    for (const article of articles) {
      try {
        if (!article.content || article.content.length < 100) {
          skipped++;
          continue;
        }

        await this.analyzeBias(article.id, article.content);
        analyzed++;

        // 과부하 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`[기존 기사 분석 실패] 기사 ID ${article.id}:`, error);
        failed++;
      }
    }

    logger.info(`[기존 기사 분석 완료] 성공: ${analyzed}, 실패: ${failed}, 스킵: ${skipped}`);

    return {
      total: articles.length,
      analyzed,
      failed,
      skipped
    };
  }
}

export const newsCrawlerService = new NewsCrawlerService();