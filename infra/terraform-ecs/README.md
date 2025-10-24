# FANS ECS Terraform 구성

이 디렉토리는 FANS 프로젝트에서 필요할 경우 ECS를 Terraform으로 관리하기 위한 구성 파일입니다.

## ⚠️ 중요 사항

**현재 FANS 프로젝트는 EKS를 사용하고 있으며, ECS는 사용하지 않습니다.**

이 Terraform 구성은:
- 참고용 및 향후 ECS 사용이 필요할 때를 위한 준비
- 실제 적용하지 않음
- 아키텍처 변경 시 참고자료로 활용

## 구성 파일

- `main.tf` - Provider 설정
- `variables.tf` - 변수 정의
- `ecs.tf` - ECS 클러스터, IAM 역할, CloudWatch 로그
- `outputs.tf` - 출력 값

## ECS vs EKS

### 현재 선택: EKS (Kubernetes)
**장점:**
- 복잡한 마이크로서비스 관리에 유리
- Kubernetes 생태계 활용
- Pod 간 네트워킹 용이
- StatefulSet으로 상태 관리

### ECS (대안)
**장점:**
- AWS 네이티브 서비스
- 설정이 간단
- Fargate로 서버리스 실행 가능
- AWS 서비스와의 통합 우수

## 사용 방법 (미래 참고용)

### 1. 초기화
```bash
cd infra/terraform-ecs
terraform init
```

### 2. 계획 확인
```bash
terraform plan
```

### 3. 적용
```bash
terraform apply
```

## ECS Task Definition 예제

```json
{
  "family": "fans-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/fans-ecs-cluster-task-role",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/fans-ecs-cluster-task-execution-role",
  "containerDefinitions": [
    {
      "name": "fans-api",
      "image": "ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/fans/main-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/fans-ecs-cluster",
          "awslogs-region": "ap-northeast-2",
          "awslogs-stream-prefix": "fans-api"
        }
      }
    }
  ]
}
```

## 참고사항

- 현재 프로젝트는 **EKS 기반**으로 운영 중
- ECS로 전환이 필요한 경우 이 구성을 참고
- Task Definition, Service 등은 별도로 정의 필요
