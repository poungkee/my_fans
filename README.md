# FANS - 뉴스 통합 플랫폼

## 🏗️ 프로젝트 구조

```
FANS/
├── 📁 services/              # 백엔드 서비스들
│   ├── 📁 ai-service/        # Python AI 요약 서비스 (포트 8001)
│   └── 📁 main-api/          # Node.js 메인 API (포트 8000)
├── 📁 frontend/              # React 프론트엔드 (포트 3000)
├── 📁 infrastructure/        # 인프라 설정
│   ├── 📁 terraform/         # AWS 인프라 코드
│   ├── 📁 docker/           # Docker 설정
│   └── 📁 k8s/              # Kubernetes 설정
├── 📁 docs/                 # 문서
│   ├── 📁 api/              # API 문서
│   └── 📁 deployment/       # 배포 가이드
├── 📄 docker-compose.yml    # 로컬 개발환경
└── 📄 README.md
```

## 🚀 개발환경 시작

```bash
# 전체 서비스 시작
docker-compose up -d

# 개별 서비스 개발
cd services/ai-service && python main.py
cd services/main-api && npm run dev
cd frontend && npm start
```

## 📊 아키텍처

- **AI Service**: Python FastAPI (포트 8001) - 뉴스 AI 요약
- **Main API**: Node.js + TypeORM (포트 8000) - 메인 API 서버
- **Frontend**: React + TypeScript (포트 3000) - 사용자 인터페이스
- **Database**: PostgreSQL (포트 5432) - 메인 데이터베이스

## 🛠️ 기술 스택

### Backend
- **AI Service**: Python 3.11, FastAPI, Transformers
- **Main API**: Node.js, TypeScript, TypeORM, PostgreSQL

### Frontend
- **Framework**: React + TypeScript
- **UI Library**: TBD (Material-UI/Tailwind/Ant Design)
- **State Management**: TBD (Context API/Zustand/Redux)

### Infrastructure
- **Cloud**: AWS (ECS/EKS)
- **Database**: RDS PostgreSQL
- **CI/CD**: GitHub Actions
- **IaC**: Terraform