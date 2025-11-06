# Node Group 변경 사항 요약

## 변경 이유
기존 Karpenter 단독 구성에서 **고가용성(HA) + Karpenter 하이브리드 구성**으로 변경

**문제점**:
- Karpenter가 노드를 2a에만 집중 생성 (2a: 3개, 2b: 1개)
- AZ 장애 시 서비스 중단 위험
- 비용 효율적이지만 안정성 부족

**해결책**:
- **고정 Node Group 4개** (2a/2b 각 2개씩)
- **Karpenter는 추가 부하 시에만** 동작

---

## 새로운 구성

### 기본 Node Group (상시 운영)
| Node Group | 타입 | 개수 | AZ | 용도 | 월 비용 |
|-----------|------|------|----|----|--------|
| general-workers | t3.large | 2 | 2a/2b 각 1개 | main-api, scheduler, crawler | ~$120 |
| ai-workers | t3a.xlarge | 2 | 2a/2b 각 1개 | AI 서비스 (summarize, bias, worker) | ~$110 |
| **총계** | - | **4개** | - | - | **~$230/월** |

### Karpenter (동적 추가)
- 트래픽 증가 시에만 노드 추가
- Spot 인스턴스 사용 (60-90% 비용 절감)
- 유휴 시 자동 제거

---

## 파일 변경 사항

### 1. Terraform 코드 수정
**파일**: `environments/eks/terraform/eks.tf`

```diff
- main_workers = {
-   name = "fans-main-workers"
-   instance_types = ["t3.large"]
-   min_size = 2
-   max_size = 4
- }

+ general_workers = {
+   name = "fans-general-workers"
+   instance_types = ["t3.large"]
+   min_size = 2
+   max_size = 2  # 고정
+   labels = { workload = "general" }
+ }
+
+ ai_workers = {
+   name = "fans-ai-workers"
+   instance_types = ["t3a.xlarge"]
+   min_size = 2
+   max_size = 2  # 고정
+   labels = { workload = "ai" }
+ }
```

**변경 사항**:
- `main_workers` → `general_workers`, `ai_workers`로 분리
- 각 Node Group 크기 고정 (min=max=2)
- workload 레이블 추가

---

### 2. 실행 스크립트 추가
**파일**: `scripts/setup-node-groups.sh`

자동화 스크립트 (eksctl 사용):
- General Workers 생성
- AI Workers 생성
- Pod nodeSelector 자동 추가

**실행 방법**:
```bash
chmod +x scripts/setup-node-groups.sh
./scripts/setup-node-groups.sh
```

---

### 3. 가이드 문서 추가
**파일**: `docs/NODE_GROUP_SETUP.md`

상세 가이드:
- eksctl 설치 방법
- Node Group 생성 단계별 가이드
- Pod 재배치 방법
- 문제 해결 방법
- 롤백 방법

---

## 적용 방법

### 옵션 1: eksctl 사용 (권장, 빠름)
```bash
# 자동 스크립트 실행
./scripts/setup-node-groups.sh
```

### 옵션 2: Terraform 사용
```bash
cd environments/eks/terraform

# 변수 파일 생성 (필요 시)
cat > terraform.tfvars <<EOF
db_password = "your-db-password"
EOF

# 적용
terraform plan
terraform apply
```

**주의**: Terraform state가 없으므로 기존 리소스 import 필요

---

## 적용 후 확인

### 1. 노드 확인
```bash
kubectl get nodes -L role,workload,topology.kubernetes.io/zone
```

**기대 결과**:
```
NAME                   ROLE            WORKLOAD  ZONE
ip-10-0-1-xxx          general-worker  general   ap-northeast-2a
ip-10-0-2-xxx          general-worker  general   ap-northeast-2b
ip-10-0-1-yyy          ai-worker       ai        ap-northeast-2a
ip-10-0-2-yyy          ai-worker       ai        ap-northeast-2b
```

### 2. Pod 배치 확인
```bash
# General Workers에 배치된 Pod
kubectl get pods -n fans -o wide | grep -E "main-api|scheduler|crawler"

# AI Workers에 배치된 Pod
kubectl get pods -n fans -o wide | grep -E "summarize|bias|ai-worker"
```

### 3. 리소스 사용률 확인
```bash
kubectl describe nodes | grep -A 8 "Allocated resources"
```

---

## 기존 Karpenter 노드 제거

새 Node Group이 정상 작동하면:

```bash
# Karpenter 노드 목록
kubectl get nodes -l karpenter.sh/nodepool

# Drain & 삭제
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data --force
kubectl delete node <node-name>
```

---

## 롤백

문제 발생 시:

```bash
# Node Group 삭제
eksctl delete nodegroup --cluster=fans-cluster --name=fans-general-workers --region=ap-northeast-2
eksctl delete nodegroup --cluster=fans-cluster --name=fans-ai-workers --region=ap-northeast-2
```

Karpenter가 자동으로 필요한 노드를 다시 생성합니다.

---

## 비용 영향

### 이전 (Karpenter 단독)
- 가변적 (2-6개 노드)
- Spot 사용 시 ~$80-150/월
- 불안정 (Spot 중단 가능)

### 이후 (하이브리드)
- **고정**: ~$230/월 (4개 On-Demand)
- **가변**: Karpenter 추가 (필요 시만)
- 안정적 (고가용성 보장)

**추가 비용**: ~$80-150/월 증가 (안정성 향상 대가)

---

## Git Commit 메시지 예시

```
feat: EKS Node Group을 고가용성 구성으로 변경

- General Workers (t3.large × 2): 일반 서비스 전용
- AI Workers (t3a.xlarge × 2): AI 서비스 전용
- 2a/2b 각각 2개 노드로 HA 구성
- Karpenter는 추가 부하 시에만 동작

변경 파일:
- environments/eks/terraform/eks.tf
- scripts/setup-node-groups.sh (신규)
- docs/NODE_GROUP_SETUP.md (신규)
- docs/NODE_GROUP_CHANGES.md (신규)
```

---

## 참고

- Terraform 코드는 수정됨 (팀원이 apply 필요)
- 실제 적용은 eksctl 스크립트로 먼저 진행 권장
- 안정화 후 Terraform state import 고려
