# FANS AWS EKS 배포

도메인: **fans.ai.kr**

## 🚀 빠른 시작

```bash
# 1. AWS 인프라 생성 (30분)
cd k8s
chmod +x *.sh
./setup-aws-infra.sh

# 2. Docker 이미지 빌드 및 푸시 (20분)
./build-and-push-images.sh

# 3. Secret 설정 (base/secret.yaml 편집)
# RDS, Redis 엔드포인트, JWT Secret, 카카오 API 키 등

# 4. Kubernetes 배포 (5분)
kubectl apply -k base/

# 5. Route 53 DNS 설정 (DEPLOYMENT_GUIDE.md 참고)
```

## 📁 파일 구조

```
k8s/
├── setup-aws-infra.sh           # AWS 인프라 자동 생성 스크립트
├── build-and-push-images.sh     # Docker 이미지 빌드/푸시 스크립트
├── DEPLOYMENT_GUIDE.md          # 상세 배포 가이드
├── README.md                    # 이 파일
└── base/
    ├── namespace.yaml           # fans 네임스페이스
    ├── configmap.yaml           # 환경 설정
    ├── secret.yaml              # 비밀 정보 (수정 필요)
    ├── main-api.yaml            # Main API Deployment + Service
    ├── frontend.yaml            # Frontend Deployment + Service
    ├── ai-services.yaml         # AI 서비스들 (Summarize, Bias Analysis)
    ├── crawler-and-scheduler.yaml # Crawler + Scheduler + Classification API
    ├── persistent-volume.yaml   # EBS 볼륨 (업로드 파일용)
    ├── ingress.yaml             # ALB Ingress (HTTPS + 도메인 라우팅)
    └── kustomization.yaml       # Kustomize 설정
```

## 🌐 도메인 구조

- `fans.ai.kr` → Frontend (React)
- `api.fans.ai.kr` → Main API (Node.js)
- `ai.fans.ai.kr/summarize` → Summarize AI
- `ai.fans.ai.kr/bias-analysis` → Bias Analysis AI

## 📊 인프라 구성

| 리소스 | 타입 | 수량 | 용도 |
|--------|------|------|------|
| EKS Cluster | 1.28 | 1 | Kubernetes 클러스터 |
| Node Group (일반) | t3.medium | 2-5 | API, Frontend, Crawler |
| Node Group (AI) | t3.large | 1-3 | AI 워크로드 |
| RDS PostgreSQL | db.t3.medium | 1 (Multi-AZ) | 데이터베이스 |
| ElastiCache Redis | cache.t3.medium | 1 | 캐시 |
| ALB | Application | 1 | Load Balancer |
| ACM Certificate | - | 1 | HTTPS 인증서 |
| ECR Repositories | - | 7 | Docker 이미지 저장소 |

## 💰 예상 비용 (월)

- EKS 클러스터: $73
- EC2 Nodes (5대): ~$150
- RDS (db.t3.medium Multi-AZ): ~$100
- ElastiCache: ~$50
- ALB: ~$20
- 데이터 전송: ~$50
- **총 예상: $443/월**

## 📝 배포 전 체크리스트

- [ ] AWS CLI 설치 및 설정
- [ ] kubectl 설치
- [ ] eksctl 설치
- [ ] Docker 설치
- [ ] Route 53에서 fans.ai.kr 호스팅 영역 생성
- [ ] 카카오 Developer 앱 설정
- [ ] Hugging Face API 토큰 발급

## 🔐 필요한 Secrets

`base/secret.yaml` 파일에 다음 정보를 base64로 인코딩하여 입력:

1. **데이터베이스**
   - DB_HOST (RDS 엔드포인트)
   - POSTGRES_PASSWORD

2. **Redis**
   - REDIS_HOST (ElastiCache 엔드포인트)

3. **JWT**
   - JWT_SECRET (랜덤 문자열)

4. **카카오 OAuth**
   - KAKAO_CLIENT_ID
   - KAKAO_CLIENT_SECRET

5. **AI**
   - HUGGING_FACE_API_KEY

## 🆘 문제 해결

### Pod이 시작되지 않을 때
```bash
kubectl get pods -n fans
kubectl describe pod <pod-name> -n fans
kubectl logs <pod-name> -n fans
```

### 도메인이 연결되지 않을 때
- Route 53 레코드 확인
- ACM 인증서 검증 상태 확인
- ALB 상태 확인

### 데이터베이스 연결 실패
- RDS 보안 그룹 확인 (EKS에서 5432 포트 허용)
- Secret의 DB 정보 확인

## 📚 참고 문서

- [상세 배포 가이드](./DEPLOYMENT_GUIDE.md)
- [AWS EKS 공식 문서](https://docs.aws.amazon.com/eks/)
- [Kubernetes 공식 문서](https://kubernetes.io/docs/)

## 🔄 업데이트

코드 변경 후:
```bash
./build-and-push-images.sh
kubectl rollout restart deployment/main-api -n fans
```

## 🗑️ 전체 삭제

```bash
kubectl delete -k base/
eksctl delete cluster --name fans-eks-cluster
# RDS, Redis 등도 AWS Console에서 수동 삭제
```
