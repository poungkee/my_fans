# FANS (Fast AI News Service)

## 소개
AI 기반 뉴스 큐레이션 플랫폼 사용자 맞춤형 뉴스 추천과 언론사 편향성 분석을 제공하는 뉴스 서비스

AWS EKS 기반 마이크로서비스 아키텍처로 일일 11,000+ 뉴스 자동 수집/분석

---

## 기간 / 인원
| 항목 | 내용 |
|------|------|
| **기간** | 8주 (2025-09-15 ~ 2025-11-11) |
| **인원** | 5명 |
| **역할** | 백엔드 개발 (인프라 & AI 파이프라인) |

---

## 기술스택
**Java, JavaScript, React.js(Redux, Router), Spring Framework, Spring Boot, Rest API, MySQL, MyBatis,, JPA, Spring Data JPA, TypeScript, Node.js, Express, Python, FastAPI, PostgreSQL, Redis, Docker, AWS EKS, Karpenter, Terraform, BullMQ, Puppeteer**

---

## 구성기능
**인증/인가**, **크롤링**, **AI 요약**, **편향성 분석**, **감정 분석**, **키워드 추출**, **개인화 추천**, **검색/필터링**, **북마크**, **좋아요/싫어요**

---

## 주요 기능

### 인프라 구축 (AWS EKS + Karpenter)
| 담당 여부 | 구현 내용 |
|----------|----------|
| ✅ **담당 역할** | • Terraform으로 EKS 클러스터 구축<br>• Karpenter 자동 스케일링 구현 (Spot Instance 활용)<br>• ALB Ingress Controller 설정<br>• ElastiCache Redis 통합 |

### AI 작업 큐 시스템 (BullMQ)
| 담당 여부 | 구현 내용 |
|----------|----------|
| ✅ **담당 역할** | • BullMQ + Redis 분산 작업 큐 구축<br>• 4개 Worker 분리 (Summary, Bias, Keyword, Recommendation)<br>• Rate Limiting 및 Retry 전략 구현<br>• 일일 11,000+ 뉴스 AI 처리 자동화 |

### 뉴스 크롤러 (Puppeteer)
| 담당 여부 | 구현 내용 |
|----------|----------|
| ✅ **담당 역할** | • Puppeteer 기반 다음/네이버 통합 크롤러<br>• JSON API + Meta Tag 파싱 전략<br>• 중복 제거 및 다중 인스턴스 지원<br>• CronJob 3분마다 자동 실행 |

### 인증/인가
| 담당 여부 | 구현 내용 |
|----------|----------|
| 공통 | • JWT 토큰 기반 인증<br>• 카카오/네이버 OAuth 2.0 소셜 로그인<br>• bcrypt 비밀번호 해싱 |

### 데이터베이스 설계
| 담당 여부 | 구현 내용 |
|----------|----------|
| ✅ **담당 역할** | • PostgreSQL 스키마 설계 (10개 테이블)<br>• TypeORM Entity/Repository 패턴<br>• 인덱스 최적화 (평균 쿼리 < 50ms) |

---

## 결과물
**GitHub**: https://github.com/poungkee/my_fans

**시연영상**: https://www.youtube.com/
