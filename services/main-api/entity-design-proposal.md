# TypeORM Entity 설계 제안서

> **목적**: 팀 논의용 Entity 클래스 설계안
> **작성일**: 2025-09-15
> **대상**: 사용자 맞춤 뉴스 추천 시스템

## 📋 요구사항 정리

### 핵심 기능
1. **사용자 기본 정보** (회원가입, 프로필)
2. **뉴스 상호작용** (스크랩, 좋아요, 싫어요)
3. **맞춤 뉴스 추천** (사용자 행동 기반)
4. **언론사별 뉴스 분류**
5. **카테고리 시스템**
6. **기자 정보 및 평판/성향 분석** (AI 기반)

## 🗂️ Entity 설계안

### 1. User (사용자)
```typescript
@Entity('users')
export class User {
  id: number;
  username: string;
  email: string;
  password_hash: string;

  // 개인정보 (추천용)
  age?: number;
  gender?: string;
  location?: string;
  occupation?: string;
  // 종합적인 성향 분석 (AI 기반)
  political_inclination?: string;  // 정치 성향 ('progressive', 'conservative', 'moderate')
  social_inclination?: string;     // 사회 성향 ('liberal', 'traditional', 'moderate')
  economic_inclination?: string;   // 경제 성향 ('capitalist', 'socialist', 'mixed')
  cultural_inclination?: string;   // 문화 성향 ('open', 'conservative', 'balanced')

  // 뉴스 선호도
  preferred_categories: string[];     // 선호 카테고리
  preferred_media_sources: string[];  // 선호 언론사
  preferred_reading_time?: string;    // 주요 독서 시간대

  // 계정 상태
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  last_login?: Date;
}
```

### 2. NewsArticle (뉴스 기사)
```typescript
@Entity('news_articles')
export class NewsArticle {
  id: number;
  title: string;
  content: string;
  summary?: string;           // 원본 요약
  ai_summary?: string;        // AI 생성 요약
  short_ai_summary?: string;  // 짧은 AI 요약 (40자)

  // 메타정보
  url: string;
  origin_url?: string;
  image_url?: string;
  video_url?: string;

  // 분류 정보
  category: string;           // 카테고리
  media_source_id: number;    // 언론사 ID (FK)
  journalist_id?: number;     // 기자 ID (FK)

  // 날짜
  pub_date: Date;
  created_at: Date;
  updated_at: Date;

  // 통계 (캐시용)
  view_count: number;
  like_count: number;
  dislike_count: number;
  scrap_count: number;
  comment_count: number;  // 댓글 수 (캐시용)
}
```

### 3. MediaSource (언론사)
```typescript
@Entity('media_sources')
export class MediaSource {
  id: number;
  name: string;               // 언론사명 (ex: '조선일보', 'KBS')
  domain: string;             // 도메인 (ex: 'chosun.com')
  logo_url?: string;          // 로고 이미지

  // AI 분석 결과
  political_bias?: string;    // 정치적 성향 ('left', 'center', 'right')
  credibility_score?: number; // 신뢰도 점수 (0-100)

  // 메타정보
  founded_year?: number;
  headquarters?: string;
  description?: string;

  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### 4. Journalist (기자)
```typescript
@Entity('journalists')
export class Journalist {
  id: number;
  name: string;
  email?: string;

  // 소속 정보
  media_source_id: number;    // 언론사 ID (FK)
  department?: string;        // 부서 (ex: '정치부', '경제부')
  position?: string;          // 직책 (ex: '기자', '편집장')

  // AI 분석 결과
  expertise_areas: string[];   // 전문 분야 (['정치', '경제'])
  writing_style_score?: number; // 문체 점수
  objectivity_score?: number;   // 객관성 점수 (0-100)
  political_inclination?: string; // 정치 성향
  credibility_score?: number;   // 개인 신뢰도 점수

  // 통계
  article_count: number;
  avg_article_rating?: number;

  created_at: Date;
  updated_at: Date;
}
```

### 5. UserNewsInteraction (사용자-뉴스 상호작용)
```typescript
@Entity('user_news_interactions')
export class UserNewsInteraction {
  id: number;
  user_id: number;           // 사용자 ID (FK)
  news_id: number;           // 뉴스 ID (FK)

  // 상호작용 타입
  interaction_type: string;   // 'view', 'like', 'dislike', 'scrap'

  // 추가 정보
  reading_duration?: number;  // 읽은 시간 (초)
  reading_percentage?: number; // 읽은 비율 (0-100)

  created_at: Date;
}
```

### 6. UserPreference (사용자 선호도)
```typescript
@Entity('user_preferences')
export class UserPreference {
  id: number;
  user_id: number;           // 사용자 ID (FK)

  preference_type: string;    // 'category', 'media_source', 'journalist', 'keyword'
  preference_value: string;   // 선호 대상 (ex: '정치', '조선일보', '김기자')
  preference_score: number;   // 선호도 점수 (-100 ~ 100)

  created_at: Date;
  updated_at: Date;
}
```

### 7. Category (카테고리)
```typescript
@Entity('categories')
export class Category {
  id: number;
  name: string;              // 카테고리명 ('정치', '경제', '기술', ...)
  slug: string;              // URL용 슬러그 ('politics', 'economy', ...)
  description?: string;
  color_code?: string;       // UI 색상 코드
  icon?: string;             // 아이콘

  parent_id?: number;        // 상위 카테고리 (계층 구조)
  sort_order: number;        // 정렬 순서
  is_active: boolean;

  created_at: Date;
}
```

### 8. Keyword (키워드)
```typescript
@Entity('keywords')
export class Keyword {
  id: number;
  keyword: string;           // 키워드
  frequency: number;         // 전체 빈도수

  // AI 분석 결과
  sentiment_score?: number;  // 감정 점수 (-100 ~ 100)
  importance_score?: number; // 중요도 점수 (0-100)

  created_at: Date;
}
```

### 9. Comment (댓글)
```typescript
@Entity('comments')
export class Comment {
  id: number;
  news_id: number;           // 뉴스 ID (FK)
  user_id: number;           // 사용자 ID (FK)
  parent_id?: number;        // 상위 댓글 ID (대댓글용, 자기 참조)

  // 댓글 내용
  content: string;           // 댓글 내용
  is_deleted: boolean;       // 삭제 여부 (소프트 삭제)

  // 통계
  like_count: number;
  dislike_count: number;
  reply_count: number;       // 대댓글 수

  // 날짜
  created_at: Date;
  updated_at: Date;
}
```

### 10. CommentInteraction (댓글 상호작용)
```typescript
@Entity('comment_interactions')
export class CommentInteraction {
  id: number;
  user_id: number;           // 사용자 ID (FK)
  comment_id: number;        // 댓글 ID (FK)

  interaction_type: string;   // 'like', 'dislike'
  created_at: Date;

  UNIQUE(user_id, comment_id) // 중복 방지
}
```

### 11. NewsKeyword (뉴스-키워드 관계)
```typescript
@Entity('news_keywords')
export class NewsKeyword {
  news_id: number;           // 뉴스 ID (FK)
  keyword_id: number;        // 키워드 ID (FK)
  relevance_score: number;   // 관련도 점수 (0-1)

  PRIMARY KEY (news_id, keyword_id)
}
```

## 🔄 관계 설정 및 외래키

### 주요 관계 (TypeORM 설정)

#### User 관련
- **User ↔ UserNewsInteraction**: 1:N (사용자 - 뉴스 상호작용)
  ```typescript
  @OneToMany(() => UserNewsInteraction, interaction => interaction.user)
  news_interactions: UserNewsInteraction[];
  ```

- **User ↔ UserPreference**: 1:N (사용자 - 선호도)
  ```typescript
  @OneToMany(() => UserPreference, preference => preference.user)
  preferences: UserPreference[];
  ```

- **User ↔ Comment**: 1:N (사용자 - 댓글)
  ```typescript
  @OneToMany(() => Comment, comment => comment.user)
  comments: Comment[];
  ```

#### NewsArticle 관련
- **NewsArticle ↔ MediaSource**: N:1 (뉴스 - 언론사)
  ```typescript
  @ManyToOne(() => MediaSource, media => media.articles)
  @JoinColumn({ name: 'media_source_id' })
  media_source: MediaSource;
  ```

- **NewsArticle ↔ Journalist**: N:1 (뉴스 - 기자)
  ```typescript
  @ManyToOne(() => Journalist, journalist => journalist.articles)
  @JoinColumn({ name: 'journalist_id' })
  journalist: Journalist;
  ```

- **NewsArticle ↔ Category**: N:1 (뉴스 - 카테고리)
  ```typescript
  @ManyToOne(() => Category, category => category.articles)
  @JoinColumn({ name: 'category_id' })
  category: Category;
  ```

- **NewsArticle ↔ Keyword**: N:M (뉴스 - 키워드)
  ```typescript
  @ManyToMany(() => Keyword, keyword => keyword.articles)
  @JoinTable({
    name: 'news_keywords',
    joinColumn: { name: 'news_id' },
    inverseJoinColumn: { name: 'keyword_id' }
  })
  keywords: Keyword[];
  ```

- **NewsArticle ↔ Comment**: 1:N (뉴스 - 댓글)
  ```typescript
  @OneToMany(() => Comment, comment => comment.news_article)
  comments: Comment[];
  ```

#### Comment 관련
- **Comment ↔ Comment**: 1:N (댓글 - 대댓글, 자기 참조)
  ```typescript
  @ManyToOne(() => Comment, comment => comment.replies, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Comment;

  @OneToMany(() => Comment, comment => comment.parent)
  replies: Comment[];
  ```

- **Comment ↔ CommentInteraction**: 1:N (댓글 - 상호작용)
  ```typescript
  @OneToMany(() => CommentInteraction, interaction => interaction.comment)
  interactions: CommentInteraction[];
  ```

### 외래키 제약조건

#### 필수 외래키 (NOT NULL)
- `user_news_interactions.user_id` → `users.id`
- `user_news_interactions.news_id` → `news_articles.id`
- `comments.user_id` → `users.id`
- `comments.news_id` → `news_articles.id`
- `comment_interactions.user_id` → `users.id`
- `comment_interactions.comment_id` → `comments.id`

#### 선택적 외래키 (NULLABLE)
- `news_articles.media_source_id` → `media_sources.id`
- `news_articles.journalist_id` → `journalists.id`
- `comments.parent_id` → `comments.id` (자기 참조)

## 🎯 추천 알고리즘 고려사항

### 사용자 프로필 기반
- 연령, 성별, 지역, 직업별 뉴스 선호도
- **종합적 성향 분석**에 따른 콘텐츠 필터링:
  - 정치 성향: 진보/보수/중도에 따른 언론사/기자 추천
  - 사회 성향: 자유주의/전통주의 관점의 기사 우선 노출
  - 경제 성향: 자본주의/사회주의 시각의 경제 기사 추천
  - 문화 성향: 개방적/보수적 문화 콘텐츠 맞춤형 제공

### 행동 기반
- 좋아요/싫어요 패턴 분석
- 읽기 시간, 완독률 분석
- 스크랩한 뉴스의 공통점 분석
- **댓글 활동 분석**: 자주 댓글을 다는 뉴스 유형, 댓글 내용의 감정 분석
- **댓글 상호작용**: 좋아요 받는 댓글 스타일 학습

### 콘텐츠 기반
- 선호 카테고리, 키워드 매칭
- 신뢰할 만한 언론사/기자 우선 노출
- AI 분석 결과 활용 (객관성, 신뢰도)

## ❓ 팀 논의 필요사항

1. **개인정보 수집 범위**: 어디까지 수집할 것인가?
2. **종합 성향 분석**: AI로 자동 분석 vs 사용자 직접 설정 vs 하이브리드
3. **기자 평판 시스템**: 공개 여부, 산정 기준
4. **댓글 시스템 정책**: 익명 댓글 허용 여부, 신고/차단 기능
5. **추천 알고리즘**: 협업 필터링 vs 콘텐츠 기반 vs 하이브리드
6. **데이터 보존 기간**: 사용자 행동 데이터 및 댓글 보관 기간
7. **마이페이지 기능 범위**: 내가 쓴 댓글, 좋아요한 댓글, 대댓글 알림 등

## 🚀 구현 우선순위

### Phase 1 (MVP)
- User, NewsArticle, MediaSource, Category
- 기본 CRUD 및 뉴스 목록/검색

### Phase 2 (상호작용)
- UserNewsInteraction, UserPreference
- 좋아요/싫어요/스크랩 기능
- **Comment, CommentInteraction 추가** (댓글 시스템)

### Phase 3 (고도화)
- Journalist, Keyword, NewsKeyword
- AI 기반 추천 시스템
- **마이페이지 고도화** (내 댓글 관리, 대댓글 알림)

### Phase 4 (개인화)
- **종합 성향 분석** 시스템 구축
- **댓글 기반 추천** 알고리즘 고도화