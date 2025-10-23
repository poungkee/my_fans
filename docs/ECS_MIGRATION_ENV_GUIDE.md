# ECS로 마이그레이션 시 .env 파일 변경 가이드

**날짜**: 2025-10-23
**목적**: Docker Compose → AWS ECS 마이그레이션

---

## 🔄 변경이 필요한 이유

현재 `.env` 파일은 **로컬 Docker Compose 환경**을 위한 설정입니다.
ECS로 전환 시 컨테이너 네트워크, DNS, 로드밸런서 주소가 변경됩니다.

---

## 📝 변경해야 하는 항목

### 1. 데이터베이스 연결 설정 (최우선)

#### 현재 (Docker Compose)
```env
# 로컬 Docker 네트워크 이름 사용
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=fans_user
DB_PASSWORD=fans_password
DB_NAME=fans_db
```

#### ECS로 변경
```env
# RDS 엔드포인트 사용
DB_HOST=${RDS_ENDPOINT}  # 예: fans-db.abc123.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=fans_user
DB_PASSWORD=${SECURE_PASSWORD}  # Secrets Manager 또는 Parameter Store 사용 권장
DB_NAME=fans_db
```

**변경 이유**:
- ECS에서는 Docker Compose 네트워크 DNS(`postgres`)가 작동하지 않음
- RDS를 사용하므로 RDS 엔드포인트로 변경 필요

**Terraform 출력값 활용**:
```bash
# Terraform apply 후
terraform output rds_endpoint
# 출력: fans-db.abc123.ap-northeast-2.rds.amazonaws.com

# .env에 설정
DB_HOST=fans-db.abc123.ap-northeast-2.rds.amazonaws.com
```

---

### 2. AI 서비스 URL (중요)

#### 현재 (Docker Compose)
```env
# Docker Compose 서비스 이름 사용
AI_SERVICE_URL=http://summarize-ai:8000
SUMMARIZE_AI_URL=http://summarize-ai:8000
BIAS_AI_URL=http://bias-analysis-ai:8002
```

#### ECS로 변경 (옵션 A: ALB 사용)
```env
# Application Load Balancer 내부 DNS 사용
AI_SERVICE_URL=http://summarize-ai.fans-internal.local:8000
SUMMARIZE_AI_URL=http://summarize-ai.fans-internal.local:8000
BIAS_AI_URL=http://bias-analysis-ai.fans-internal.local:8002
```

#### ECS로 변경 (옵션 B: Service Discovery 사용 - 권장)
```env
# ECS Service Discovery (AWS Cloud Map)
AI_SERVICE_URL=http://summarize-ai.fans.local:8000
SUMMARIZE_AI_URL=http://summarize-ai.fans.local:8000
BIAS_AI_URL=http://bias-analysis-ai.fans.local:8000
```

**변경 이유**:
- ECS 태스크 간 통신은 Service Discovery 또는 ALB를 통해 이루어짐
- Docker Compose의 내부 DNS와 다름

**Terraform 설정 예시**:
```hcl
# ECS Service Discovery
resource "aws_service_discovery_private_dns_namespace" "fans" {
  name = "fans.local"
  vpc  = aws_vpc.main.id
}
```

---

### 3. Frontend URL 및 CORS 설정

#### 현재 (로컬 개발)
```env
FRONTEND_URL=http://localhost:3001
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# React 환경변수
REACT_APP_API_BASE=http://localhost:3000
REACT_APP_API_URL=http://localhost:3000/api
```

#### ECS로 변경
```env
# 프로덕션 도메인 사용
FRONTEND_URL=https://fans.ai.kr
CORS_ALLOWED_ORIGINS=https://fans.ai.kr,https://www.fans.ai.kr,https://api.fans.ai.kr

# React 환경변수 (빌드 시점에 결정)
REACT_APP_API_BASE=https://api.fans.ai.kr
REACT_APP_API_URL=https://api.fans.ai.kr/api
REACT_APP_AI_SERVICE_URL=https://api.fans.ai.kr/ai
```

**변경 이유**:
- 로컬호스트 대신 실제 도메인 사용
- HTTPS 적용
- ALB를 통한 라우팅

**주의사항**:
- React 환경변수는 **빌드 시점**에 결정됨
- Docker 이미지 빌드 전에 설정 필요
- 또는 빌드 시 `--build-arg` 사용

---

### 4. OAuth Redirect URI

#### 현재 (로컬)
```env
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback
NAVER_REDIRECT_URI=http://localhost:3000/api/auth/naver/callback
```

#### ECS로 변경
```env
KAKAO_REDIRECT_URI=https://api.fans.ai.kr/api/auth/kakao/callback
NAVER_REDIRECT_URI=https://api.fans.ai.kr/api/auth/naver/callback
```

**추가 작업 필수**:
1. **카카오 개발자 콘솔** (https://developers.kakao.com)
   - 앱 설정 → Redirect URI 추가
   - `https://api.fans.ai.kr/api/auth/kakao/callback`

2. **네이버 개발자 센터** (https://developers.naver.com)
   - 애플리케이션 설정 → Callback URL 추가
   - `https://api.fans.ai.kr/api/auth/naver/callback`

---

### 5. 환경 변수 (Environment)

#### 현재
```env
NODE_ENV=development
```

#### ECS로 변경
```env
NODE_ENV=production
```

**변경 이유**:
- 프로덕션 최적화 활성화
- 디버그 로그 감소
- 보안 강화

---

### 6. 보안 관련 (매우 중요!)

#### 현재 (개발용 - 위험)
```env
JWT_SECRET=your-strong-random-jwt-secret-change-this-in-production
SESSION_SECRET=your-strong-random-session-secret-change-this-in-production
DB_PASSWORD=fans_password
```

#### ECS로 변경 (AWS Secrets Manager 사용 - 강력 권장)

**옵션 A: .env에 직접 설정 (비권장)**
```env
JWT_SECRET=aBcD1234...복잡한32자이상
SESSION_SECRET=XyZ9876...복잡한32자이상
DB_PASSWORD=매우복잡한비밀번호!@#$
```

**옵션 B: AWS Secrets Manager 사용 (권장)**
```env
# 참조만 표시, 실제 값은 Secrets Manager에서 가져옴
JWT_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:fans/jwt-secret
SESSION_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:fans/session-secret
DB_PASSWORD_ARN=arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:fans/db-password
```

**Terraform으로 Secrets Manager 생성**:
```hcl
resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "fans/jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}
```

**ECS Task Definition에서 사용**:
```json
{
  "secrets": [
    {
      "name": "JWT_SECRET",
      "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:fans/jwt-secret"
    }
  ]
}
```

---

### 7. 포트 설정 (내부 통신용)

#### 현재
```env
PORT=3000
SUMMARIZE_AI_PORT=8000
BIAS_ANALYSIS_AI_PORT=8002
```

#### ECS로 변경
```env
# 컨테이너 내부 포트 (변경 불필요)
PORT=3000
SUMMARIZE_AI_PORT=8000
BIAS_ANALYSIS_AI_PORT=8002

# 외부 접근은 ALB가 처리 (80 → 3000, 443 → 3000)
```

**변경 이유**:
- ECS에서는 ALB가 포트 매핑 처리
- 컨테이너 내부 포트는 동일하게 유지
- 외부 포트는 ALB 리스너 규칙에서 설정

---

## 📋 ECS용 .env 파일 전체 예시

```env
# ================================
# Core Service Configuration
# ================================
NODE_ENV=production
PORT=3000

# ================================
# Database Configuration (RDS)
# ================================
DB_HOST=fans-db.c1a2b3c4d5e6.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=fans_user
DB_PASSWORD=${SECURE_PASSWORD}  # Secrets Manager에서 주입
DB_NAME=fans_db

# ================================
# AI Services Configuration (Service Discovery)
# ================================
AI_SERVICE_URL=http://summarize-ai.fans.local:8000
SUMMARIZE_AI_URL=http://summarize-ai.fans.local:8000
BIAS_AI_URL=http://bias-analysis-ai.fans.local:8002
SUMMARIZE_AI_PORT=8000
BIAS_ANALYSIS_AI_PORT=8002

# AI Model Configuration
MODEL_NAME=eenzeenee/t5-base-korean-summarization
MAX_SUMMARY_LENGTH=100

# ================================
# Crawler Services Configuration
# ================================
API_CRAWLER_PORT=4003

# Crawler Settings
AUTO_CRAWL=true
CRAWL_INTERVAL=180000
CRAWL_INTERVAL_MINUTES=5
CRAWL_LIMIT_PER_CATEGORY=5

# ================================
# Frontend Configuration
# ================================
FRONTEND_URL=https://fans.ai.kr
CORS_ALLOWED_ORIGINS=https://fans.ai.kr,https://www.fans.ai.kr,https://api.fans.ai.kr

# React Environment Variables (빌드 시점)
REACT_APP_API_BASE=https://api.fans.ai.kr
REACT_APP_API_URL=https://api.fans.ai.kr/api
REACT_APP_AI_SERVICE_URL=https://api.fans.ai.kr/ai

# ================================
# OAuth Configuration (프로덕션)
# ================================
# Kakao Login
KAKAO_CLIENT_ID=a931fbb713e76936aa318cec623a33f4
KAKAO_CLIENT_SECRET=${KAKAO_SECRET}  # Secrets Manager
KAKAO_REDIRECT_URI=https://api.fans.ai.kr/api/auth/kakao/callback

# Naver Login
NAVER_CLIENT_ID=XqQjKhBGlQbHUwQzaXjX
NAVER_CLIENT_SECRET=${NAVER_SECRET}  # Secrets Manager
NAVER_REDIRECT_URI=https://api.fans.ai.kr/api/auth/naver/callback

# ================================
# Naver Search API
# ================================
NAVER_SEARCH_CLIENT_ID=XqQjKhBGlQbHUwQzaXjX
NAVER_SEARCH_CLIENT_SECRET=${NAVER_SEARCH_SECRET}

# Second Set for Load Balancing
NAVER_CLIENT_ID_2=Iph1VHODaCjmA4S7yvwZ
NAVER_CLIENT_SECRET_2=${NAVER_SECRET_2}

# ================================
# Security Configuration (Secrets Manager)
# ================================
JWT_SECRET=${JWT_SECRET}  # ARN으로 주입
SESSION_SECRET=${SESSION_SECRET}  # ARN으로 주입

# ================================
# Email Service Configuration
# ================================
EMAIL_USER=${EMAIL_USER}
EMAIL_PASSWORD=${EMAIL_PASSWORD}

# ================================
# Optional Configuration
# ================================
LOG_LEVEL=info
AWS_REGION=ap-northeast-2
```

---

## 🔧 Terraform으로 환경변수 자동화

### 1. Terraform Output 활용

```hcl
# outputs.tf
output "rds_endpoint" {
  description = "RDS PostgreSQL Endpoint"
  value       = aws_db_instance.main.endpoint
}

output "alb_dns_name" {
  description = "ALB DNS Name"
  value       = aws_lb.main.dns_name
}

output "service_discovery_namespace" {
  description = "Service Discovery Namespace"
  value       = aws_service_discovery_private_dns_namespace.fans.name
}
```

### 2. 자동으로 .env 생성 스크립트

```bash
#!/bin/bash
# scripts/generate-ecs-env.sh

# Terraform 출력값 가져오기
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
ALB_DNS=$(terraform output -raw alb_dns_name)

# .env.ecs 파일 생성
cat > .env.ecs <<EOF
NODE_ENV=production
DB_HOST=${RDS_ENDPOINT}
DB_PORT=5432
# ... 나머지 설정
EOF

echo ".env.ecs 파일이 생성되었습니다."
```

---

## ⚠️ 주의사항

### 1. 민감한 정보 보호
- **절대 Git에 커밋하지 말 것**
  ```bash
  # .gitignore에 추가
  .env.ecs
  .env.production
  ```

- **Secrets Manager 사용 강력 권장**
  - DB 비밀번호
  - JWT Secret
  - OAuth Client Secret
  - API Keys

### 2. 환경별 분리
```
.env              # 로컬 개발용
.env.ecs          # ECS 프로덕션용
.env.staging      # 스테이징용
```

### 3. ECS Task Definition에서 주입

**방법 1: 환경변수 직접 지정**
```json
{
  "environment": [
    {"name": "NODE_ENV", "value": "production"},
    {"name": "DB_HOST", "value": "fans-db.xxx.rds.amazonaws.com"}
  ]
}
```

**방법 2: Secrets Manager 사용 (권장)**
```json
{
  "secrets": [
    {
      "name": "DB_PASSWORD",
      "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:fans/db-password"
    }
  ]
}
```

**방법 3: Parameter Store 사용**
```json
{
  "secrets": [
    {
      "name": "DB_HOST",
      "valueFrom": "arn:aws:ssm:ap-northeast-2:123456789012:parameter/fans/db-host"
    }
  ]
}
```

---

## 🚀 마이그레이션 체크리스트

### 단계 1: 준비
- [ ] 현재 `.env` 파일 백업
- [ ] RDS 엔드포인트 확인
- [ ] ALB DNS 이름 확인
- [ ] Service Discovery 네임스페이스 확인

### 단계 2: .env 수정
- [ ] `DB_HOST` → RDS 엔드포인트로 변경
- [ ] AI 서비스 URL → Service Discovery 주소로 변경
- [ ] Frontend URL → 프로덕션 도메인으로 변경
- [ ] OAuth Redirect URI → 프로덕션 URL로 변경
- [ ] `NODE_ENV=production` 설정

### 단계 3: Secrets Manager 설정
- [ ] JWT Secret 생성
- [ ] Session Secret 생성
- [ ] DB Password 저장
- [ ] OAuth Secrets 저장

### 단계 4: OAuth 콘솔 업데이트
- [ ] 카카오 개발자 콘솔에서 Redirect URI 추가
- [ ] 네이버 개발자 센터에서 Callback URL 추가

### 단계 5: Docker 이미지 재빌드
- [ ] React 앱 빌드 (새 환경변수 포함)
- [ ] Docker 이미지 빌드
- [ ] ECR에 푸시

### 단계 6: ECS 배포
- [ ] Task Definition 업데이트
- [ ] Service 업데이트
- [ ] 헬스 체크 확인

---

## 📞 문제 해결

### 문제: 데이터베이스 연결 실패
```
Error: connect ECONNREFUSED
```

**해결**:
1. RDS Security Group에서 ECS 태스크 보안 그룹 허용 확인
2. `DB_HOST`가 올바른 RDS 엔드포인트인지 확인
3. VPC 내부에서 접근 가능한지 확인

### 문제: AI 서비스 통신 실패
```
Error: getaddrinfo ENOTFOUND summarize-ai
```

**해결**:
1. Service Discovery가 올바르게 설정되었는지 확인
2. ECS 서비스가 같은 VPC에 있는지 확인
3. DNS 네임스페이스가 올바른지 확인

### 문제: OAuth 리다이렉트 실패
```
redirect_uri_mismatch
```

**해결**:
1. 카카오/네이버 개발자 콘솔에서 Redirect URI 등록 확인
2. `.env`의 `KAKAO_REDIRECT_URI` 확인
3. HTTPS 사용 중인지 확인

---

**작성일**: 2025-10-23
**대상**: FANS 프로젝트 ECS 마이그레이션
**참고**: infra/terraform/ 디렉토리의 Terraform 코드와 함께 사용
