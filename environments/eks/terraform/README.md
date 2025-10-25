# FANS EKS Terraform 구성

이 디렉토리는 FANS 프로젝트의 EKS 클러스터를 Terraform으로 관리하기 위한 구성 파일입니다.

## ⚠️ 중요 사항

**현재 프로덕션 EKS 클러스터는 `eksctl`로 생성되어 운영 중입니다.**

이 Terraform 구성은:
- 참고용 및 향후 재구성을 위한 준비
- 실제 적용하지 않음 (기존 클러스터 유지)
- 나중에 클러스터 재구성이 필요할 때 사용

## 구성 파일

- `main.tf` - Provider 설정
- `variables.tf` - 변수 정의
- `vpc.tf` - VPC 및 네트워크 구성
- `eks.tf` - EKS 클러스터 및 노드 그룹
- `outputs.tf` - 출력 값

## 사용 방법 (미래 참고용)

### 1. 초기화
```bash
cd infra/terraform-eks
terraform init
```

### 2. 계획 확인
```bash
terraform plan
```

### 3. 적용 (⚠️ 주의: 현재는 실행하지 마세요)
```bash
# 기존 클러스터를 완전히 삭제한 후에만 실행
terraform apply
```

### 4. kubectl 설정
```bash
aws eks update-kubeconfig --region ap-northeast-2 --name fans-cluster
```

## 현재 운영 중인 클러스터

- 관리 도구: `eksctl`
- 설정 파일: `k8s/archive/eksctl/eks-cluster.yaml`
- CloudFormation 스택으로 관리됨

## 마이그레이션 시나리오

향후 Terraform으로 전환할 때:

1. **기존 클러스터 백업**
   - 중요 데이터 백업
   - 현재 설정 문서화

2. **기존 클러스터 삭제**
   ```bash
   eksctl delete cluster --name fans-cluster --region ap-northeast-2
   ```

3. **Terraform으로 생성**
   ```bash
   terraform apply
   ```

4. **애플리케이션 재배포**
   ```bash
   kubectl apply -f k8s/
   ```
