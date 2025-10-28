# GitHub Actions CI/CD 설정 가이드

## 개요

이 디렉토리는 FANS 프로젝트의 GitHub Actions CI/CD 파이프라인을 포함합니다.

## 워크플로우 목록

### 1. Backend API (`backend-api.yml`)
- **트리거**: `backend/api/**` 경로 변경 시
- **작업**: Main API를 ECR에 빌드/푸시 후 EKS에 배포
- **배포 대상**: `fans-main-api` (EKS Deployment)

### 2. Frontend (`frontend.yml`)
- **트리거**: `frontend/**` 경로 변경 시
- **작업**: React 앱 빌드 후 S3에 배포, CloudFront 캐시 무효화
- **배포 대상**: S3 `fans-frontend-907123164281`, CloudFront `E3VZKE0FYIK8JH`

### 3. AI Services (`ai-services.yml`)
- **트리거**: `backend/ai/**` 경로 변경 시
- **작업**: 3개 AI 서비스를 병렬로 빌드/배포
  - Summarize AI (`fans-summarize-ai`)
  - Bias Analysis AI (`fans-bias-analysis-ai`)
  - Classification API (`fans-classification-api`)

### 4. Crawler & Scheduler (`crawler-scheduler.yml`)
- **트리거**: `backend/crawler/**`, `backend/scheduler/**` 경로 변경 시
- **작업**: 크롤러와 스케줄러를 병렬로 빌드/배포
  - Unified Crawler (`fans-unified-crawler`)
  - Scheduler (`fans-scheduler`)

## GitHub Secrets 설정

GitHub 리포지토리에 다음 Secrets를 추가해야 합니다:

### 필수 Secrets

```
Settings → Secrets and variables → Actions → New repository secret
```

| Secret Name | 설명 | 예시 |
|------------|------|-----|
| `AWS_ACCESS_KEY_ID` | AWS IAM Access Key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Secret Key | `wJalr...` |

### AWS IAM 권한 요구사항

GitHub Actions에서 사용할 IAM 사용자에 다음 권한이 필요합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::fans-frontend-907123164281",
        "arn:aws:s3:::fans-frontend-907123164281/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::907123164281:distribution/E3VZKE0FYIK8JH"
    }
  ]
}
```

## 사용 방법

### 1. Secrets 설정
1. GitHub 리포지토리 → Settings → Secrets and variables → Actions
2. "New repository secret" 클릭
3. `AWS_ACCESS_KEY_ID` 와 `AWS_SECRET_ACCESS_KEY` 추가

### 2. 자동 배포
- `main` 브랜치에 푸시하면 자동으로 해당 서비스가 배포됩니다
- 예: `backend/api/src/app.ts` 수정 후 푸시 → Main API 자동 배포

### 3. 수동 배포
```bash
# GitHub Actions 탭에서 원하는 워크플로우 선택
# "Run workflow" 버튼 클릭
```

## 배포 프로세스

### Backend Services (API, AI, Crawler, Scheduler)
```
코드 푸시 → Docker 빌드 → ECR 푸시 → EKS 배포 → Rollout 확인
```

### Frontend
```
코드 푸시 → npm build → S3 업로드 → CloudFront 캐시 무효화
```

## ECR 리포지토리 목록

| 서비스 | ECR 리포지토리 | 컨테이너 이름 |
|--------|---------------|-------------|
| Main API | `fans-main-api` | `main-api` |
| Summarize AI | `fans-summarize-ai` | `summarize-ai` |
| Bias Analysis AI | `fans-bias-analysis-ai` | `bias-analysis-ai` |
| Classification API | `fans-classification-api` | `classification-api` |
| Unified Crawler | `fans-unified-crawler` | `unified-crawler` |
| Scheduler | `fans-scheduler` | `scheduler` |

## EKS 배포 확인

```bash
# EKS 클러스터 연결
aws eks update-kubeconfig --name fans-cluster --region ap-northeast-2

# Pod 상태 확인
kubectl get pods -n fans

# 배포 상태 확인
kubectl rollout status deployment/main-api -n fans

# 로그 확인
kubectl logs -f deployment/main-api -n fans
```

## 문제 해결

### 1. ECR 푸시 실패
- IAM 사용자의 ECR 권한 확인
- ECR 리포지토리가 존재하는지 확인

### 2. EKS 배포 실패
- IAM 사용자의 EKS 권한 확인
- NodeGroup이 실행 중인지 확인 (`kubectl get nodes`)
- ConfigMap, Secrets가 존재하는지 확인

### 3. Frontend 배포 실패
- S3 버킷 이름 확인
- CloudFront Distribution ID 확인
- IAM 사용자의 S3, CloudFront 권한 확인

## 비용 최적화

### NodeGroup 축소 후 CI/CD 테스트
```bash
# NodeGroup 축소 (비용 절감)
./environments/eks/scripts/scale-nodegroup.sh stop

# CI/CD 파이프라인은 계속 실행 가능
# ECR 빌드/푸시는 정상 작동
# EKS 배포는 NodeGroup 재시작 후 가능

# NodeGroup 재시작
./environments/eks/scripts/scale-nodegroup.sh start
```

## 참고사항

- 모든 워크플로우는 `main` 브랜치 푸시 시 자동 실행됩니다
- Pull Request 생성 시에도 빌드 테스트가 실행됩니다 (배포는 제외)
- 이미지 태그는 Git Commit SHA를 사용합니다 (`${{ github.sha }}`)
- `latest` 태그도 함께 업데이트됩니다

## 문의

문제가 발생하면 다음을 확인하세요:
1. GitHub Actions 탭에서 워크플로우 실행 로그 확인
2. AWS CloudWatch Logs에서 EKS Pod 로그 확인
3. `kubectl describe pod <pod-name> -n fans`로 Pod 상태 확인
