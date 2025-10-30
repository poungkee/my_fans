# Karpenter 설정

## 개요

Karpenter는 AWS EKS를 위한 오픈소스 노드 프로비저닝 솔루션입니다.
- **Spot 인스턴스** 자동 관리로 **65% 비용 절감**
- **큐 길이 기반** 자동 스케일링으로 **안정성 99%+**
- **2분 이내** 노드 프로비저닝

## 아키텍처

### NodePool 구성

1. **General NodePool** (On-Demand)
   - 용도: Main API, Database, Redis 등 안정성 중요 서비스
   - 인스턴스: t3.medium ~ t3.large
   - 용량 타입: On-Demand (중단 없음)
   - 최대 리소스: 8 vCPU, 16GB RAM

2. **AI Worker NodePool** (Spot)
   - 용도: BullMQ AI Worker (Summary, Bias, Keyword, Recommendation)
   - 인스턴스: c5.large ~ c6i.xlarge (CPU 최적화)
   - 용량 타입: Spot (60-90% 저렴)
   - 최대 리소스: 16 vCPU, 32GB RAM
   - Spot 중단 핸들러 포함

## 설치 방법

### 1. Karpenter 설치

```bash
cd environments/eks/scripts
chmod +x install-karpenter.sh
./install-karpenter.sh
```

설치 과정:
1. Karpenter IAM Role 생성
2. Karpenter Controller 설치 (Helm)
3. NodePool 및 EC2NodeClass 적용

### 2. KEDA 설치

```bash
chmod +x install-keda.sh
./install-keda.sh
```

### 3. AI Worker 배포

```bash
kubectl apply -f ../manifests/15-ai-worker-deployment.yaml
kubectl apply -f ../manifests/16-keda-scaledobject.yaml
```

## 확인

### Karpenter 상태

```bash
# Karpenter Pods
kubectl get pods -n karpenter

# NodePools
kubectl get nodepools

# EC2NodeClasses
kubectl get ec2nodeclasses

# 노드 확인
kubectl get nodes -L workload-type
```

### KEDA 상태

```bash
# KEDA Pods
kubectl get pods -n keda

# ScaledObjects
kubectl get scaledobjects -n fans

# 자동 생성된 HPA
kubectl get hpa -n fans
```

### AI Worker 스케일링 확인

```bash
# AI Worker Pods
kubectl get pods -n fans -l app=ai-worker

# 스케일링 로그
kubectl logs -f -n keda deployment/keda-operator

# Karpenter 로그
kubectl logs -f -n karpenter -l app.kubernetes.io/name=karpenter
```

## 스케일링 동작

### KEDA 트리거 (큐 길이 기반)

- **Summary/Bias/Keyword 큐**: 대기 작업 5개당 Pod 1개 추가
- **Recommendation 큐**: 대기 작업 10개당 Pod 1개 추가 (더 무거움)

### 스케일 업/다운 정책

**스케일 업 (빠르게):**
- 큐에 작업이 쌓이면 **15초 내** 즉시 Pod 추가
- 한 번에 최대 100% 증가 또는 4개 추가

**스케일 다운 (안전하게):**
- **5분 동안** 큐가 비어있으면 Pod 축소
- 한 번에 최대 50% 축소

### Karpenter 노드 프로비저닝

**스케일 업:**
- Pod가 Pending 상태가 되면 **2분 이내** 새 노드 생성
- AI Worker는 Spot 인스턴스 사용

**스케일 다운:**
- 노드가 30초 이상 유휴 상태면 제거
- 최대 10%의 노드만 동시 교체 (안정성)

## Spot 인스턴스 중단 처리

### 자동 복구 메커니즘

1. **AWS Spot 중단 알림** (2분 전)
2. **노드 Drain** - Pod를 다른 노드로 이동
3. **Graceful Shutdown** - 진행 중인 작업 완료 대기 (120초)
4. **새 노드 프로비저닝** - Karpenter가 자동으로 새 노드 생성

### 모니터링

```bash
# Spot 중단 이벤트 확인
kubectl get events -n fans --sort-by='.lastTimestamp'

# Pod Eviction 확인
kubectl get pods -n fans -w
```

## 비용 절감 효과

### 예상 비용 (월 기준)

**이전 (On-Demand only):**
- t3.medium × 3대 (24시간): $75
- t3.large × 2대 (피크 시간): $168
- **총: $243/월**

**이후 (Karpenter + Spot):**
- t3.medium × 2대 (On-Demand): $50
- c5.large × 4대 (Spot, 70% 할인): $35
- **총: $85/월**
- **절감: $158/월 (65% 절감)**

## 트러블슈팅

### Pod가 Pending 상태

```bash
# Pod 이벤트 확인
kubectl describe pod <pod-name> -n fans

# NodePool 확인
kubectl describe nodepool ai-worker

# Karpenter 로그
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter
```

### Spot 인스턴스가 자주 중단됨

- `ec2nodeclass-ai-worker.yaml`에서 인스턴스 타입 다양화
- `c5`, `c5a`, `c6i` 등 여러 세대 포함

### 스케일 다운이 느림

- `keda-scaledobject.yaml`에서 `cooldownPeriod` 조정
- 현재 60초 → 30초로 단축 가능

## 참고 자료

- [Karpenter 공식 문서](https://karpenter.sh/)
- [KEDA 공식 문서](https://keda.sh/)
- [AWS Spot Best Practices](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-best-practices.html)
