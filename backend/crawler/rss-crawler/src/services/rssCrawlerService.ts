import axios from 'axios';
import * as xml2js from 'xml2js';
import * as cheerio from 'cheerio';
import { AppDataSource } from '../config/database';
import { NewsArticle } from '../entities/NewsArticle';

import { RSS_FEEDS, RSSFeed } from '../config/rssSources';

interface RSSItem {
  title: string[];
  link: string[];
  description?: string[];
  pubDate?: string[];
  'dc:date'?: string[];
  'dc:creator'?: string[];
  author?: string[];
}

interface ParsedRSSNews {
  title: string;
  content: string;
  journalist?: string;
  mediaSource: string;
  pubDate: Date;
  imageUrl?: string;
  url: string;
  sourceId: number;
}

class RSSCrawlerService {

  // RSS 피드에서 뉴스 가져오기
  private async fetchNewsFromRSS(feed: RSSFeed, limit: number = 10): Promise<ParsedRSSNews[]> {
    try {
      console.log(`[RSS DEBUG] ${feed.sourceName} RSS 크롤링 시작: ${feed.feedUrl}`);

      const response = await axios.get(feed.feedUrl, {
        timeout: 10000,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Buffer를 UTF-8로 디코딩
      const xmlData = Buffer.from(response.data).toString('utf-8');

      const parser = new xml2js.Parser({ trim: true, explicitArray: true });
      const result = await parser.parseStringPromise(xmlData);

      const items: RSSItem[] = result.rss?.channel?.[0]?.item || [];
      console.log(`[RSS DEBUG] ${feed.sourceName}에서 ${items.length}개 아이템 발견`);

      const parsedNews: ParsedRSSNews[] = [];

      for (let i = 0; i < Math.min(items.length, limit); i++) {
        const item = items[i];

        try {
          const news = await this.parseRSSItem(item, feed);
          if (news) {
            parsedNews.push(news);
          }
        } catch (error) {
          console.log(`[RSS DEBUG] ${feed.sourceName} 아이템 파싱 실패:`, error);
        }
      }

      console.log(`[RSS DEBUG] ${feed.sourceName}에서 ${parsedNews.length}개 뉴스 파싱 완료`);
      return parsedNews;

    } catch (error) {
      console.error(`[RSS ERROR] ${feed.sourceName} RSS 크롤링 실패:`, error);
      return [];
    }
  }


  // 조선일보 JSON 구조에서 본문 추출
  private extractFromChosunJSON(html: string): string {
    try {
      // window.Fusion.globalContent에서 JSON 데이터 추출
      const jsonMatch = html.match(/window\.Fusion\.globalContent\s*=\s*({.*?});/s);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData.content_elements) {
          const textElements = jsonData.content_elements
            .filter((el: any) => el.type === 'text')
            .map((el: any) => el.content)
            .filter((text: string) => text && text.length > 10)
            .join('\n\n');

          if (textElements.length > 100) {
            console.log(`[RSS DEBUG] 조선일보 JSON에서 ${textElements.length}자 추출 성공`);
            return textElements;
          }
        }
      }
    } catch (error) {
      console.log('[RSS DEBUG] 조선일보 JSON 파싱 실패, HTML 방식으로 대체');
    }
    return '';
  }

  // 웹페이지에서 실제 본문 추출 (사이트별 맞춤 로직)
  private async extractContentFromURL(url: string, sourceName: string): Promise<{ content: string; imageUrl?: string; journalist?: string }> {
    try {
      console.log(`[RSS DEBUG] ${sourceName} 본문 추출 시작: ${url}`);

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // 사이트별 맞춤 추출 로직
      switch (sourceName) {
        case '한겨레':
          return await this.extractFromHani(response.data, url);
        case '경향신문':
          return await this.extractFromKhan(response.data, url);
        case '동아일보':
          return await this.extractFromDonga(response.data, url);
        case '조선일보':
          return await this.extractFromChosun(response.data, url);
        default:
          return await this.extractFromGeneric(response.data, url, sourceName);
      }

    } catch (error) {
      console.log(`[RSS DEBUG] ${sourceName} 본문 추출 실패: ${error}`);
      return { content: '' };
    }
  }

  // 한겨레 전용 추출 함수
  private async extractFromHani(html: string, url: string): Promise<{ content: string; imageUrl?: string; journalist?: string }> {
    const $ = cheerio.load(html);

    // 한겨레 본문 선택자 (HTML 구조 분석 결과에 따라 정확한 선택자 사용)
    const selectors = ['.article-text', '.article_text', '#article-text', '.content-text', '.article-body', '.article_body', '#contents'];
    let content = '';

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        // 한겨레 전용 - 불필요한 요소 제거
        element.find('script, style, .ad, .share, .related, .comment, .reporter-box, .copyright').remove();
        content = element.text().trim();
        console.log(`[RSS DEBUG] 한겨레 선택자 ${selector}에서 ${content.length}자 추출`);
        if (content.length > 100) break;
      }
    }

    return {
      content: this.cleanArticleContent(content),
      imageUrl: this.extractImage($, url),
      journalist: this.extractJournalist($, content)
    };
  }

  // 경향신문 전용 추출 함수
  private async extractFromKhan(html: string, url: string): Promise<{ content: string; imageUrl?: string; journalist?: string }> {
    const $ = cheerio.load(html);

    // 경향신문 본문 선택자 (HTML 구조 분석 결과: .art_body, #articleBody)
    const selectors = ['.art_body', '#articleBody', '#artCont', '.article_body'];
    let content = '';

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        // 경향신문 전용 - UI 요소 제거
        element.find('script, style, .ad, .share, .related, .article-util, .reporter-info').remove();
        content = element.text().trim();
        console.log(`[RSS DEBUG] 경향신문 선택자 ${selector}에서 ${content.length}자 추출`);
        if (content.length > 100) break;
      }
    }

    return {
      content: this.cleanArticleContent(content),
      imageUrl: this.extractImage($, url),
      journalist: this.extractJournalist($, content)
    };
  }

  // 동아일보 전용 추출 함수 (HTML 구조 분석 결과: section.news_view)
  private async extractFromDonga(html: string, url: string): Promise<{ content: string; imageUrl?: string; journalist?: string }> {
    const $ = cheerio.load(html);

    let content = '';

    // section.news_view 찾기
    const newsSection = $('section.news_view');

    if (newsSection.length > 0) {
      // 광고 및 불필요한 요소 모두 제거 (강화)
      newsSection.find('.view_ad06, .view_m_adA, .view_m_adB, .view_m_adK, .view_m_adI, .a1, #div-gpt-ad, script, style, .img_cont, figure, figcaption').remove();
      newsSection.find('div[id*="div-gpt-ad"]').remove();
      newsSection.find('div[class*="view_ad"]').remove();
      newsSection.find('div[class*="view_m_ad"]').remove();
      newsSection.find('.byline, .caution_text, .article_end, #poll_content, .poll_form_sec').remove();
      newsSection.find('#is_relation_m, #is_trend_m, .is_relation_parent, .is_trend_parent').remove();

      // HTML을 한번 정리하고 다시 로드
      const cleanedHTML = newsSection.html() || '';
      const $clean = cheerio.load(cleanedHTML);

      // <br> 태그를 줄바꿈으로 변환하여 문단 구분 유지
      const htmlWithBreaks = $clean.html()?.replace(/<br\s*\/?>/gi, '\n') || '';
      const $final = cheerio.load(htmlWithBreaks);

      // 텍스트 추출
      content = $final('body').text().trim() || $final.root().text().trim();

      // 연속된 줄바꿈을 문단 구분으로 정리
      content = content.replace(/\n{3,}/g, '\n\n');

      console.log(`[RSS DEBUG] 동아일보 section.news_view에서 ${content.length}자 추출`);
    }

    // 본문이 너무 짧으면 fallback
    if (content.length < 100) {
      console.log('[RSS DEBUG] 동아일보 본문이 짧아서 fallback 시도');
      // 기본 article 내용 시도
      const article = $('article');
      if (article.length > 0) {
        article.find('script, style, .ad, .a1, #div-gpt-ad').remove();
        content = article.text().trim();
      }
    }

    return {
      content: this.cleanArticleContent(content),
      imageUrl: this.extractImage($, url),
      journalist: this.extractJournalist($, content)
    };
  }

  // 조선일보 전용 추출 함수
  private async extractFromChosun(html: string, url: string): Promise<{ content: string; imageUrl?: string; journalist?: string }> {
    const $ = cheerio.load(html);

    // 먼저 JSON 구조에서 추출 시도 (React 기반)
    let content = this.extractFromChosunJSON(html);

    // JSON 추출 실패 시 HTML 선택자 사용
    if (!content || content.length < 100) {
      const selectors = [
        '.par',                    // 조선일보 단락
        '.story-body',            // 스토리 본문
        '#article-body',          // 기본 기사 본문
        'article p',              // article 태그 내 단락들
        '.content p',             // content 영역 단락들
        '.article-body p',        // 기사 본문 단락들
        '#fusion-app .content'    // React 컨테이너 내 콘텐츠
      ];

      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          // 조선일보 전용 - 불필요한 요소 제거
          elements.find('script, style, .ad, .share, .article-util, .social-share').remove();
          if (selector === '.par' || selector.includes('p')) {
            // 단락별로 추출하여 합치기
            content = elements.map((_, el) => $(el).text().trim()).get().filter(text => text.length > 0).join('\n\n');
          } else {
            content = elements.text().trim();
          }
          console.log(`[RSS DEBUG] 조선일보 선택자 ${selector}에서 ${content.length}자 추출`);
          if (content.length > 100) break;
        }
      }
    }

    return {
      content: this.cleanArticleContent(content),
      imageUrl: this.extractImage($, url),
      journalist: this.extractJournalist($, content)
    };
  }

  // 범용 추출 함수 (기타 언론사용)
  private async extractFromGeneric(html: string, url: string, sourceName: string): Promise<{ content: string; imageUrl?: string; journalist?: string }> {
    const $ = cheerio.load(html);

    // 범용 선택자들
    const selectors = [
      '#articleBody', '#artCont', '.article-text', '.article-body',
      '#articleText', '.news-body', '.article-content', '#article_body',
      'article', 'main article'
    ];

    let content = '';

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        element.find('script, style, .ad, .share, .related').remove();
        content = element.text().trim();
        console.log(`[RSS DEBUG] ${sourceName} 선택자 ${selector}에서 ${content.length}자 추출`);
        if (content.length > 100) break;
      }
    }

    return {
      content: this.cleanArticleContent(content),
      imageUrl: this.extractImage($, url),
      journalist: this.extractJournalist($, content)
    };
  }

  // 이미지 추출 공통 함수
  private extractImage($: any, url: string): string | undefined {
    const imgSelectors = ['meta[property="og:image"]', '.article img', '.news_body img', 'img[src*="jpg"]', 'img[src*="png"]'];

    for (const selector of imgSelectors) {
      const img = $(selector);
      if (img.length > 0) {
        let imageUrl = img.attr('content') || img.attr('src') || '';
        if (imageUrl) {
          // 상대 경로면 절대 경로로 변환
          if (imageUrl.startsWith('/')) {
            const urlObj = new URL(url);
            imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
          }
          return imageUrl;
        }
      }
    }
    return undefined;
  }

  // 기자명 추출 공통 함수 (Cheerio 오류 수정)
  private extractJournalist($: any, content: string): string | undefined {
    try {
      // DOM에서 먼저 추출 시도
      const journalistSelectors = ['.reporter', '.writer', '.author', '[class*="reporter"]', '[class*="writer"]'];
      for (const selector of journalistSelectors) {
        const reporterEl = $(selector);
        if (reporterEl && reporterEl.length > 0) {
          const journalist = this.cleanJournalistName(reporterEl.text());
          if (journalist.length > 1 && journalist.length < 20) {
            return journalist;
          }
        }
      }
    } catch (error) {
      console.log('[RSS DEBUG] DOM 기자명 추출 중 오류:', error);
    }

    // 본문에서 "기자" 패턴 분석
    if (content) {
      const patterns = [
        /([가-힣]{2,4})\s*기자/g,
        /([가-힣]{2,4})\s+기자/g,
        /([가-힣]{2,4})\n기자/g
      ];

      for (const pattern of patterns) {
        const matches = [...content.matchAll(pattern)];
        for (const match of matches) {
          if (match[1].length >= 2 && match[1].length <= 4) {
            return match[1];
          }
        }
      }
    }

    return undefined;
  }

  // 기사 본문 정리 함수 (JavaScript 코드 제거 강화)
  private cleanArticleContent(content: string): string {
    if (!content) return '';

    let cleaned = content;

    // 1. JavaScript/jQuery 코드 블록 완전 제거 (재강화)
    cleaned = cleaned
      // document.write 및 DOM 조작
      .replace(/document\.write\s*\([^)]*\)/gs, '')
      .replace(/document\.[a-zA-Z]+\s*\([^)]*\)/gs, '')
      .replace(/createElement\s*\([^)]*\)/gs, '')
      .replace(/appendChild\s*\([^)]*\)/gs, '')
      .replace(/getElementById\s*\([^)]*\)/gs, '')
      // 함수 표현식 및 즉시실행함수
      .replace(/\(function\s*\([^)]*\)[^}]*\}\s*\)\s*\([^)]*\)/gs, '')
      .replace(/function\s*\([^)]*\)\s*\{[^}]*\}/gs, '')
      .replace(/\([a-zA-Z,\s]*\)\s*=>\s*\{[^}]*\}/gs, '')
      // 객체 및 배열
      .replace(/\{[^{}]*:[^{}]*\}/gs, '')
      .replace(/\[[^\[\]]*\]/gs, '')
      // 변수 선언 및 할당
      .replace(/(var|let|const)\s+[^;=]*\s*=\s*[^;]*;?/gs, '')
      .replace(/[a-zA-Z_$][\w$]*\s*=\s*[^;]*;?/gs, '')
      // 메서드 체이닝
      .replace(/[a-zA-Z_$][\w$]*\.[a-zA-Z_$][\w$]*\([^)]*\)/gs, '')
      .replace(/\$\([^)]*\)\.[^;]*;?/gs, '')
      .replace(/jQuery\([^)]*\)\.[^;]*;?/gs, '')
      // Google Analytics/Tag Manager
      .replace(/googletag\.[^;]*;?/gs, '')
      .replace(/gtag\([^)]*\)/gs, '')
      .replace(/ga\([^)]*\)/gs, '')
      // 일반적인 JavaScript 키워드 패턴
      .replace(/(if|else|for|while|switch|case|break|continue|return|try|catch|finally|throw)\s*[^;{]*[;{][^}]*}?/gs, '')
      // 특수 문자 및 연산자
      .replace(/[{}();,]/g, ' ')
      .replace(/\+\+|--|==|!=|<=|>=|&&|\|\||!/g, ' ')
      // JavaScript 식별자 패턴
      .replace(/\b[a-zA-Z_$][\w$]*\b/g, (match) => {
        // JavaScript 예약어 및 일반적인 JS 함수명 제거
        const jsKeywords = ['function', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'return', 'new', 'this', 'true', 'false', 'null', 'undefined', 'console', 'window', 'document', 'parseInt', 'parseFloat', 'isNaN', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'addEventListener', 'removeEventListener', 'preventDefault', 'stopPropagation'];
        return jsKeywords.includes(match.toLowerCase()) ? '' : match;
      })

    // 2. 공유/소셜 미디어 및 사이트 기능 블록 완전 제거
    cleaned = cleaned
      .replace(/공유하기\s*공유하기\s*카카오톡으로\s*공유하기[^]*?창\s*닫기/gs, '')
      .replace(/window\.snsShare.*?break\s*\}/gs, '')
      .replace(/snsShare\.\w+\([^)]*\)/gs, '')
      .replace(/카카오톡으로\s*공유하기/g, '')
      .replace(/페이스북으로\s*공유하기/g, '')
      .replace(/트위터로\s*공유하기/g, '')
      .replace(/URL\s*복사/g, '')
      // 추가 소셜 미디어 기능
      .replace(/공유하기[^\n]*/g, '')
      .replace(/SNS\s*공유/g, '')
      .replace(/바로가기/g, '')
      .replace(/똑같이\s*보기/g, '')
      .replace(/추천\s*기사/g, '')
      .replace(/많이\s*본\s*기사/g, '')
      .replace(/많이\s*읽은\s*기사/g, '')
      .replace(/인기\s*기사/g, '')
      .replace(/추천\s*콘텐츠/g, '')
      .replace(/TOP\s*댓글/g, '')
      .replace(/추천\s*기사/g, '')
      .replace(/실시간\s*뉴스/g, '')

    // 3. 저작권 및 재배포 관련
    cleaned = cleaned
      .replace(/Copyright\s*.*?\s*reserved\.\s*무단\s*전재,?\s*재배포\s*및?\s*AI학습\s*이용\s*금지/gs, '')
      .replace(/무단\s*전재.*?금지/gs, '')
      .replace(/재판매.*?금지/gs, '')
      .replace(/All\s*rights\s*reserved/gi, '')

    // 4. 뉴스 사이트 공통 UI 요소 및 인터페이스 요소 강화
    cleaned = cleaned
      .replace(/기사\s*인쇄하기/g, '')
      .replace(/글자\s*사이즈\s*줄이기/g, '')
      .replace(/글자\s*사이즈\s*키우기/g, '')
      .replace(/기사를\s*읽어드립니다/g, '')
      .replace(/Your\s*browser\s*does\s*not\s*support\s*theaudio\s*element\./g, '')
      .replace(/\d+:\d+\d+일\s*/g, '') // "0:0024일" 같은 패턴
      .replace(/Seoul\s*[가-힣]+\s*기자\s*작성\s*\d{4}\.\d{2}\.\d{2}\s*\d+/g, '')
      .replace(/[가-힣]+연예뉴스\s*[가-힣]+\s*기자/g, '')
      .replace(/작성\s*\d{4}\.\d{2}\.\d{2}\s*\d+/g, '')
      .replace(/주요\s*뉴스/g, '')
      .replace(/많이\s*본\s*기사/g, '')
      .replace(/오늘의\s*핫이슈/g, '')
      .replace(/연예\s*랭킹/g, '')
      .replace(/해외\s*토픽/g, '')
      .replace(/스타들의\s*SNS\s*소식/g, '')
      .replace(/연예인\s*재테크/g, '')
      .replace(/TV종합/g, '')
      .replace(/포토/g, '')
      // 추가 UI 요소 강화 제거
      .replace(/이전\s*기사/g, '')
      .replace(/다음\s*기사/g, '')
      .replace(/기사\s*목록/g, '')
      .replace(/스크랩/g, '')
      .replace(/댓글\s*\d+/g, '')
      .replace(/좋아요\s*\d+/g, '')
      .replace(/공유하기/g, '')
      .replace(/더보기/g, '')
      .replace(/접기/g, '')
      .replace(/펼치기/g, '')
      .replace(/전체보기/g, '')
      .replace(/축소보기/g, '')
      .replace(/확대보기/g, '')
      .replace(/이미지\s*확대/g, '')
      .replace(/사진\s*보기/g, '')
      .replace(/동영상\s*재생/g, '')
      .replace(/음성\s*듣기/g, '')
      .replace(/팟캐스트/g, '')
      .replace(/뉴스레터/g, '')
      .replace(/구독하기/g, '')
      .replace(/알림설정/g, '')
      .replace(/북마크/g, '')
      .replace(/즐겨찾기/g, '')
      .replace(/메뉴/g, '')
      .replace(/검색/g, '')
      .replace(/로그인/g, '')
      .replace(/회원가입/g, '')

    // 5. 광고, 코드 및 기술적 콘텐츠 제거 강화
    cleaned = cleaned
      .replace(/googletag\.cmd\.push.*?\);/gs, '')
      .replace(/window\._taboola.*?\);/gs, '')
      .replace(/\b광고\b/g, '')
      .replace(/\bAD\b/gi, '')
      .replace(/advertisement/gi, '')
      // 코드 및 기술적 표현 제거
      .replace(/[{}();]/g, ' ')
      // CSS 클래스명 및 스타일 코드 제거
      .replace(/\.css-[a-zA-Z0-9]+(\s+\.css-[a-zA-Z0-9]+)*/g, '')
      .replace(/\.css-[a-zA-Z0-9-]+/g, '')
      .replace(/media\s+screen\s+and\s+\([^)]+\)/g, '')
      .replace(/@media[^{]+\{[^}]*\}/g, '')
      .replace(/\.(article-photo-news|css-\w+)[\w\s.-]*\{[^}]*\}/g, '')
      .replace(/\b(function|var|let|const|if|else|for|while|switch|case|break|return|new)\b/g, '')
      .replace(/\w+\s*[=:]\s*[^\s;,}]+[;,}]/g, '')
      .replace(/\w+\.[\w.]+/g, '')
      // 날짜/시간 타임스탬프 제거
      .replace(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/g, '')
      .replace(/\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}/g, '')
      .replace(/\b\d{6,}\b/g, '') // 6자리 이상 숫자 (타임스탬프 등)
      // 미디어 플레이어 관련 제거
      .replace(/\d{1,2}:\d{2}/g, '') // 0:00, 1:23 같은 시간 표시
      .replace(/재생시간\s*\d+:\d+/g, '')
      .replace(/동영상\s*재생/g, '')
      .replace(/오디오\s*재생/g, '')
      .replace(/플레이어\s*로딩/g, '')
      .replace(/음성\s*재생/g, '')
      .replace(/비디오\s*재생/g, '')
      // 이메일 또는 도메인 형태 제거
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
      .replace(/\w+\.(com|co\.kr|kr|net|org)[^\s]*/g, '')

    // 6. 숫자로만 이루어진 라인 제거 (가격, 순위 등)
    cleaned = cleaned.replace(/^\d+\s*$/gm, '');

    // 7. 단일 문자나 의미없는 문자열 제거
    cleaned = cleaned.replace(/^[가-힣]\s*$/gm, '');

    // 8. 기사와 무관한 연예/스포츠 헤드라인들 제거
    cleaned = cleaned.replace(/\d+\s*[가-힣\s]+(비키니|파격|대박|충격|터졌다|오열|폭발)[^.]*$/gm, '');

    // 9. 중복된 본문 제거 (같은 내용이 두 번 나오는 경우)
    const contentLines = cleaned.split('\n');
    const uniqueLines: string[] = [];
    const seenLines = new Set<string>();

    for (const line of contentLines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && !seenLines.has(trimmed)) {
        seenLines.add(trimmed);
        uniqueLines.push(line);
      } else if (trimmed.length <= 10 && trimmed.length > 0) {
        uniqueLines.push(line); // 짧은 라인은 중복 제거하지 않음
      }
    }
    cleaned = uniqueLines.join('\n');

    // 10. URL 및 이메일 주소 제거
    cleaned = cleaned
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
      .replace(/www\.[^\s]+/g, '');

    // 11. 중간 정리 - 비정상적인 공백 및 기호 제거
    cleaned = cleaned
      .replace(/\s{4,}/g, ' ') // 4개 이상 연속 공백
      .replace(/[\r\n]{4,}/g, '\n\n') // 4개 이상 연속 줄바꿈
      .replace(/\t+/g, ' ') // 탭 문자
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // 보이지 않는 문자
      .replace(/[\u0000-\u001F]/g, '') // 제어 문자
      .replace(/[\u007F-\u009F]/g, '') // 확장 ASCII 제어 문자
      // 비어있는 라인 제거
      .replace(/^\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n');

    // 12. 시작부/끝부 정리
    cleaned = cleaned
      .replace(/^[.,:;!?\-\s\n]+/, '') // 시작 부분 불필요한 구두점
      .replace(/[.,:;!?\-\s\n]+$/, '') // 끝 부분 불필요한 구두점
      .trim();

    // 13. 본문이 기자명으로 끝나는 경우 정리
    const lines = cleaned.split('\n').filter(line => line.trim().length > 0);
    const lastLine = lines[lines.length - 1]?.trim();
    if (lastLine && lastLine.length < 20 && (
      lastLine.includes('기자') ||
      lastLine.includes('연합뉴스') ||
      lastLine.includes('개기자') ||
      lastLine.includes('입력') ||
      /^[가-힣]{2,4}\s*[가-힣]{2,4}$/.test(lastLine) // "김철수 기자" 형태
    )) {
      lines.pop();
      cleaned = lines.join('\n');
    }

    // 14. 문단 구분 개선
    // 마침표나 물음표 다음에 대문자로 시작하는 경우 문단 구분
    cleaned = cleaned
      .replace(/([.!?])\s+([A-Z가-힣])/g, '$1\n\n$2')
      .replace(/\n{3,}/g, '\n\n') // 3개 이상 연속 줄바꿈을 2개로
      .replace(/^\n+|\n+$/g, '') // 시작/끝 줄바꿈 제거
      .trim();

    return cleaned;
  }

  // RSS 아이템을 뉴스 객체로 파싱 (실제 본문 추출 포함)
  private async parseRSSItem(item: RSSItem, feed: RSSFeed): Promise<ParsedRSSNews | null> {
    try {
      const title = this.cleanText(item.title?.[0] || '');
      const link = item.link?.[0] || '';
      const description = this.cleanText(item.description?.[0] || '');

      if (!title || !link) {
        return null;
      }

      // 웹페이지에서 실제 본문 추출
      const extracted = await this.extractContentFromURL(link, feed.sourceName);

      // 본문이 추출되지 않으면 RSS description 사용
      const content = extracted.content || description;

      if (content.length < 50) {
        console.log(`[RSS DEBUG] ${feed.sourceName} 본문이 너무 짧음: ${title}`);
        return null;
      }

      // 날짜 파싱
      let pubDate = new Date();
      const dateString = item.pubDate?.[0] || item['dc:date']?.[0];
      if (dateString) {
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
          pubDate = parsedDate;
        }
      }

      // 기자 이름 (RSS에서 먼저, 없으면 본문에서)
      let journalist = item['dc:creator']?.[0] || item.author?.[0] || extracted.journalist || '';
      journalist = this.extractValidJournalistNames(journalist);

      // 이미지 URL (본문에서 먼저, 없으면 RSS description에서)
      let imageUrl = extracted.imageUrl || '';
      if (!imageUrl) {
        const imgMatch = description.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }

      // URL에서 실제 언론사 추출 및 매핑 (RSS 피드와 다를 수 있음)
      const actualSource = this.extractActualSourceFromURL(link);

      // URL에서 소스를 찾지 못한 경우 RSS 피드의 sourceId를 직접 사용
      let finalSourceId: number;
      let finalSourceName: string;

      if (actualSource) {
        // URL에서 언론사를 찾은 경우 매핑
        finalSourceId = this.mapSourceToId(actualSource);
        finalSourceName = actualSource;
      } else {
        // URL에서 못 찾은 경우 RSS 피드 정보 사용
        finalSourceId = feed.sourceId;
        finalSourceName = feed.sourceName;
      }

      console.log(`[RSS DEBUG] URL: ${link}`);
      console.log(`[RSS DEBUG] RSS 피드: ${feed.sourceName} (ID: ${feed.sourceId})`);
      console.log(`[RSS DEBUG] URL에서 추출된 실제 소스: ${actualSource}`);
      console.log(`[RSS DEBUG] 최종 매핑될 소스: ${finalSourceName} (ID: ${finalSourceId})`);

      return {
        title,
        content,
        journalist: journalist || undefined,
        mediaSource: finalSourceName,
        pubDate,
        imageUrl: imageUrl || undefined,
        url: link,
        sourceId: finalSourceId
      };

    } catch (error) {
      console.log(`[RSS DEBUG] RSS 아이템 파싱 오류:`, error);
      return null;
    }
  }

  // 기자 이름 정리 (UI 오염 문제 해결)
  private cleanJournalistName(name: string): string {
    if (!name) return '';

    return name
      // UI 관련 텍스트 패턴 제거
      .replace(/다른\s*기사\s*어떠세요/g, '')
      .replace(/구독/g, '')
      .replace(/공유하기/g, '')
      .replace(/페이스북/g, '')
      .replace(/트위터/g, '')
      .replace(/카카오톡/g, '')
      .replace(/네이버/g, '')
      .replace(/댓글/g, '')
      .replace(/좋아요/g, '')
      .replace(/더보기/g, '')
      .replace(/이전글/g, '')
      .replace(/다음글/g, '')
      .replace(/목록/g, '')
      .replace(/프린트/g, '')
      .replace(/스크랩/g, '')

      // 이메일 및 연락처 제거
      .replace(/[가-힣]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
      .replace(/\d{2,4}-\d{2,4}-\d{4}/g, '') // 전화번호

      // 직책 관련 단어 제거
      .replace(/\s*기자\s*/g, '')
      .replace(/\s*특파원\s*/g, '')
      .replace(/\s*편집위원\s*/g, '')
      .replace(/\s*논설위원\s*/g, '')
      .replace(/\s*작성자\s*/g, '')

      // 괄호 내용 제거
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')

      // 반복 패턴 제거 (예: "이우연신소윤이우연신소윤" -> "이우연신소윤")
      .replace(/([가-힣]{2,4})\1+/g, '$1')

      // 특수문자 정리
      .replace(/[^\w\s가-힣]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

      // 최대 20자로 제한 (DB 제한 고려)
      .substring(0, 20);
  }

  // 기자명에서 실제 이름만 추출하는 함수
  private extractValidJournalistNames(rawName: string): string {
    if (!rawName) return '';

    const cleaned = this.cleanJournalistName(rawName);

    // 한글 이름 패턴 찾기 (2-4글자)
    const nameMatches = cleaned.match(/[가-힣]{2,4}/g);

    if (nameMatches) {
      // 중복 제거하고 최대 2명까지만
      const uniqueNames = [...new Set(nameMatches)]
        .filter(name => name.length >= 2 && name.length <= 4) // 길이 재확인
        .slice(0, 2);

      let result = uniqueNames.join(' ');

      // 마지막에 붙은 불완전한 글자 제거 (예: "이우연 신소윤이" → "이우연 신소윤")
      result = result.replace(/\s[가-힣]$/, ''); // 공백 + 한 글자로 끝나는 경우 제거

      return result.trim();
    }

    return '';
  }

  // URL에서 실제 언론사 추출 (RSS 피드와 실제 기사 URL이 다를 수 있음)
  private extractActualSourceFromURL(url: string): string {
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
        'joongang.co.kr': '중앙일보',
        'yna.co.kr': '연합뉴스',
        'yonhapnews.co.kr': '연합뉴스',
        'hankyung.com': '한국경제',
        'mt.co.kr': '머니투데이',
        'kmib.co.kr': '국민일보',
        'ytn.co.kr': 'YTN',
        'star.ytn.co.kr': 'YTN',
        'news.mtn.co.kr': '머니투데이'
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

      console.log(`[RSS DEBUG] 알 수 없는 도메인: ${domain}`);
      return '';
    } catch (error) {
      console.log(`[RSS DEBUG] URL 파싱 오류: ${url}`);
      return '';
    }
  }

  // 언론사명을 DB ID로 매핑
  private mapSourceToId(sourceName: string): number {
    const sourceIdMap: { [key: string]: number } = {
      '연합뉴스': 1,
      '동아일보': 20,
      '문화일보': 21,
      '세계일보': 22,
      '조선일보': 23,
      '중앙일보': 25,
      '한겨레': 28,
      '경향신문': 32,
      '한국일보': 55,
      '매일경제': 56,
      '한국경제': 214,
      '머니투데이': 421,
      'YTN': 437,
      'JTBC': 448,
      '국민일보': 1, // 매핑되지 않은 경우 연합뉴스로
      '스타투데이': 1 // 기본값으로 연합뉴스 사용
    };

    return sourceIdMap[sourceName] || 1; // 매핑되지 않은 경우 기본값
  }

  // 텍스트 정리 함수
  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/&nbsp;/g, ' ') // &nbsp; 처리
      .replace(/&quot;/g, '"') // &quot; 처리
      .replace(/&amp;/g, '&') // &amp; 처리
      .replace(/&lt;/g, '<') // &lt; 처리
      .replace(/&gt;/g, '>') // &gt; 처리
      .replace(/\s+/g, ' ') // 연속 공백 정리
      .trim();
  }


  // 뉴스를 데이터베이스에 저장
  private async saveNewsToDatabase(newsList: ParsedRSSNews[]): Promise<number> {
    if (newsList.length === 0) {
      return 0;
    }

    try {
      const repository = AppDataSource.getRepository(NewsArticle);
      let savedCount = 0;

      for (const news of newsList) {
        try {
          // 중복 확인 (URL 기준)
          const existing = await repository.findOne({
            where: { url: news.url }
          });

          if (existing) {
            console.log(`[RSS DEBUG] 중복 뉴스 스킵: ${news.title}`);
            continue;
          }

          // 카테고리 ID는 임시로 1 설정 (추후 개선)
          const article = repository.create({
            title: news.title,
            content: news.content,
            url: news.url,
            imageUrl: news.imageUrl,
            sourceId: news.sourceId,
            categoryId: 1,
            journalist: news.journalist,
            pubDate: news.pubDate
          });

          await repository.save(article);
          savedCount++;
          console.log(`[RSS DEBUG] 저장 완료: ${news.mediaSource} - ${news.title}`);

        } catch (error) {
          console.error(`[RSS ERROR] 뉴스 저장 실패:`, error);
        }
      }

      return savedCount;
    } catch (error) {
      console.error('[RSS ERROR] 데이터베이스 저장 중 오류:', error);
      return 0;
    }
  }

  // 모든 RSS 피드 크롤링
  public async crawlAllRSSFeeds(limitPerFeed: number = 4): Promise<{ [sourceName: string]: number }> {
    console.log('📰 RSS 크롤링 시작...');
    const results: { [sourceName: string]: number } = {};

    for (const feed of RSS_FEEDS) {
      try {
        const newsList = await this.fetchNewsFromRSS(feed, limitPerFeed);
        const savedCount = await this.saveNewsToDatabase(newsList);
        results[feed.sourceName] = savedCount;

        console.log(`✅ ${feed.sourceName}: ${savedCount}개 저장 완료`);

        // 각 피드 사이에 1초 딜레이
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ ${feed.sourceName} 크롤링 실패:`, error);
        results[feed.sourceName] = 0;
      }
    }

    const totalSaved = Object.values(results).reduce((sum, count) => sum + count, 0);
    console.log(`📊 RSS 크롤링 완료 - 총 ${totalSaved}개 저장`);

    return results;
  }

  // 지원하는 RSS 피드 목록 반환
  public getSupportedFeeds(): string[] {
    return RSS_FEEDS.map(feed => feed.sourceName);
  }
}

export const rssCrawlerService = new RSSCrawlerService();