# FANS AWS 배포 아키텍처

**ECS/EKS 프로덕션 배포 상세 가이드**
**작성일**: 2025-10-25
**버전**: 2.1

---

## 📋 목차

1. [AWS 아키텍처 개요](#aws-아키텍처-개요)
2. [ECS 아키텍처](#ecs-아키텍처)
3. [EKS 아키텍처](#eks-아키텍처)
4. [네트워크 구성](#네트워크-구성)
5. [보안 설정](#보안-설정)
6. [비용 분석](#비용-분석)
7. [모니터링 및 로깅](#모니터링-및-로깅)
8. [CI/CD 파이프라인](#cicd-파이프라인)

---

## AWS 아키텍처 개요

### 공통 AWS 서비스

| 서비스 | 용도 | 비고 |
|--------|------|------|
| **VPC** | 가상 네트워크 | 172.16.0.0/16 |
| **RDS PostgreSQL** | 데이터베이스 | db.t4g.micro |
| **ElastiCache Redis** | 캐싱 | cache.t3.micro |
| **ALB** | 로드밸런서 | Application Load Balancer |
| **Route 53** | DNS | fans.ai.kr |
| **ACM** | SSL/TLS 인증서 | *.fans.ai.kr |
| **ECR** | 컨테이너 레지스트리 | Docker 이미지 저장 |
| **Secrets Manager** | 비밀 관리 | DB 비밀번호, JWT Secret 등 |
| **CloudWatch** | 로깅/모니터링 | 로그 저장 및 메트릭 |

### ECS vs EKS 선택 기준

| 기준 | ECS | EKS |
|------|-----|-----|
| **복잡도** | 낮음 | 높음 |
| **관리 오버헤드** | 적음 | 많음 |
| **Kubernetes 지식** | 불필요 | 필수 |
| **비용** | 저렴 (Control Plane 무료) | 비쌈 ($73/월 + 노드) |
| **확장성** | 제한적 | 매우 높음 |
| **멀티 클라우드** | 불가 | 가능 |
| **추천 용도** | 소규모 프로젝트 | 대규모 엔터프라이즈 |

---

## ECS 아키텍처

### ECS 전체 구조도

```
┌────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                   Route 53 (fans.ai.kr)                         │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│         Application Load Balancer (fans-alb)                   │
│              HTTPS:443 → Target Groups                         │
├────────────────────────────────────────────────────────────────┤
│  listeners:                                                     │
│  - api.fans.ai.kr → main-api:3000                             │
│  - fans.ai.kr → frontend:80                                   │
└────────────────────────┬───────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌───────────────┐                 ┌──────────────┐
│ ECS Service   │                 │ ECS Service  │
│ (Frontend)    │                 │ (Main API)   │
│ - 2 Tasks     │                 │ - 2 Tasks    │
└───────────────┘                 └──────┬───────┘
                                         │
                     ┌───────────────────┼──────────────┐
                     │                   │              │
                     ▼                   ▼              ▼
              ┌──────────────┐    ┌──────────┐  ┌──────────┐
              │   RDS        │    │  Redis   │  │   AI     │
              │ PostgreSQL   │    │ElastiCache│ │ Services │
              │ (Private)    │    │ (Private)│  │ (ECS)    │
              └──────────────┘    └──────────┘  └────┬─────┘
                                                      │
                ┌─────────────────────────────────────┴──────┐
                │                                            │
                ▼                                            ▼
        ┌──────────────┐                            ┌───────────┐
        │ Summarize AI │                            │  Bias AI  │
        │ - 2 Tasks    │                            │ - 2 Tasks │
        └──────────────┘                            └───────────┘

┌────────────────────────────────────────────────────────────────┐
│              AWS Cloud Map (Service Discovery)                  │
│  - summarize-ai.fans.local                                     │
│  - bias-analysis-ai.fans.local                                │
│  - classification-api.fans.local                              │
└────────────────────────────────────────────────────────────────┘
```

### ECS 구성 요소

#### 1. ECS Cluster

```hcl
# Terraform 코드
resource "aws_ecs_cluster" "main" {
  name = "fans-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = "production"
    Project     = "FANS"
  }
}
```

#### 2. Task Definitions

**Main API Task**:
```json
{
  "family": "fans-main-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "main-api",
      "image": "123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/fans-api:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"},
        {"name": "DB_HOST", "value": "fans-db.c1a2b3.ap-northeast-2.rds.amazonaws.com"}
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:fans/db-password"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:fans/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/fans-main-api",
          "awslogs-region": "ap-northeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### 3. ECS Services

**Main API Service**:
```hcl
resource "aws_ecs_service" "main_api" {
  name            = "fans-main-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main_api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [
      aws_subnet.private_a.id,
      aws_subnet.private_b.id
    ]
    security_groups = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.main_api.arn
    container_name   = "main-api"
    container_port   = 3000
  }

  service_registries {
    registry_arn = aws_service_discovery_service.main_api.arn
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  depends_on = [aws_lb_listener.https]
}
```

#### 4. Service Discovery (AWS Cloud Map)

```hcl
# Private DNS Namespace
resource "aws_service_discovery_private_dns_namespace" "fans" {
  name = "fans.local"
  vpc  = aws_vpc.main.id
}

# Main API Service Discovery
resource "aws_service_discovery_service" "main_api" {
  name = "main-api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.fans.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}
```

**서비스 간 통신**:
```
http://main-api.fans.local:3000
http://summarize-ai.fans.local:8000
http://bias-analysis-ai.fans.local:8002
```

---

## EKS 아키텍처

### EKS 전체 구조도

```
┌────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌────────────────────────────────────────────────────────────────┐
│         AWS Load Balancer Controller (Ingress)                 │
│         ALB (fans-alb) - managed by K8s                        │
└────────────────────────┬───────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌───────────────┐                 ┌──────────────┐
│ K8s Service   │                 │ K8s Service  │
│ (Frontend)    │                 │ (Main API)   │
│ ClusterIP     │                 │ ClusterIP    │
└───────┬───────┘                 └──────┬───────┘
        │                                 │
        ▼                                 ▼
┌───────────────┐                 ┌──────────────┐
│ Deployment    │                 │ Deployment   │
│ - 2 Pods      │                 │ - 2 Pods     │
└───────────────┘                 └──────┬───────┘
                                         │
                     ┌───────────────────┼──────────────┐
                     │                   │              │
                     ▼                   ▼              ▼
              ┌──────────────┐    ┌──────────┐  ┌──────────┐
              │   RDS        │    │  Redis   │  │   AI     │
              │ PostgreSQL   │    │ElastiCache│ │Deployment│
              │ (External)   │    │ (External)│  │          │
              └──────────────┘    └──────────┘  └────┬─────┘
                                                      │
                ┌─────────────────────────────────────┴──────┐
                │                                            │
                ▼                                            ▼
        ┌──────────────┐                            ┌───────────┐
        │ Summarize AI │                            │  Bias AI  │
        │ - 2 Pods     │                            │ - 2 Pods  │
        └──────────────┘                            └───────────┘

┌────────────────────────────────────────────────────────────────┐
│           Kubernetes DNS (CoreDNS)                              │
│  - main-api.fans-svc.svc.cluster.local                        │
│  - summarize-ai.fans-svc.svc.cluster.local                    │
│  - bias-analysis-ai.fans-svc.svc.cluster.local                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│          EKS Worker Nodes (EC2)                                 │
│  - t3.large × 2 (Managed Node Group)                          │
│  - Auto Scaling: 1-4 nodes                                    │
└────────────────────────────────────────────────────────────────┘
```

### EKS 구성 요소

#### 1. EKS Cluster

```bash
# eksctl로 클러스터 생성
eksctl create cluster \
  --name fans-cluster \
  --region ap-northeast-2 \
  --version 1.28 \
  --nodegroup-name standard-workers \
  --node-type t3.large \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed

# 또는 Terraform
resource "aws_eks_cluster" "main" {
  name     = "fans-cluster"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.28"

  vpc_config {
    subnet_ids = [
      aws_subnet.private_a.id,
      aws_subnet.private_b.id
    ]
    endpoint_private_access = true
    endpoint_public_access  = true
  }
}
```

#### 2. Deployment

**Main API Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: main-api
  namespace: fans-svc
  labels:
    app: main-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: main-api
  template:
    metadata:
      labels:
        app: main-api
    spec:
      containers:
      - name: main-api
        image: 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/fans-api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: fans-config
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 500m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

#### 3. Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: main-api
  namespace: fans-svc
spec:
  selector:
    app: main-api
  ports:
  - protocol: TCP
    port: 3000
    targetPort: 3000
  type: ClusterIP
```

**Service DNS**:
```
main-api.fans-svc.svc.cluster.local
```

#### 4. Ingress (AWS Load Balancer Controller)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fans-ingress
  namespace: fans-svc
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:123456789012:certificate/...
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
spec:
  rules:
  - host: api.fans.ai.kr
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: main-api
            port:
              number: 3000
  - host: fans.ai.kr
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

#### 5. ConfigMap & Secrets

**ConfigMap**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fans-config
  namespace: fans-svc
data:
  NODE_ENV: "production"
  DB_HOST: "fans-db.c1a2b3.ap-northeast-2.rds.amazonaws.com"
  DB_PORT: "5432"
  DB_NAME: "fans_db"
  DB_USERNAME: "fans_user"
  AI_SERVICE_URL: "http://summarize-ai.fans-svc.svc.cluster.local:8000"
```

**Secrets**:
```bash
kubectl create secret generic db-credentials \
  --from-literal=password=YourStrongPassword123! \
  --namespace fans-svc
```

---

## 네트워크 구성

### VPC 설계

```
VPC: 172.16.0.0/16
├── Public Subnet A (ap-northeast-2a): 172.16.1.0/24
│   ├── Internet Gateway
│   └── NAT Gateway A
├── Public Subnet B (ap-northeast-2c): 172.16.2.0/24
│   └── NAT Gateway B
├── Private Subnet A (ap-northeast-2a): 172.16.11.0/24
│   ├── ECS Tasks / EKS Pods
│   └── RDS Primary
└── Private Subnet B (ap-northeast-2c): 172.16.12.0/24
    ├── ECS Tasks / EKS Pods
    └── RDS Standby (Multi-AZ)
```

### Security Groups

#### ALB Security Group

```hcl
resource "aws_security_group" "alb" {
  name   = "fans-alb-sg"
  vpc_id = aws_vpc.main.id

  # Inbound: HTTPS from Internet
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Inbound: HTTP (redirect to HTTPS)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound: All
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

#### ECS Tasks / EKS Nodes Security Group

```hcl
resource "aws_security_group" "ecs_tasks" {
  name   = "fans-ecs-tasks-sg"
  vpc_id = aws_vpc.main.id

  # Inbound: From ALB
  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Inbound: From same SG (inter-container)
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
  }

  # Outbound: All
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

#### RDS Security Group

```hcl
resource "aws_security_group" "rds" {
  name   = "fans-rds-sg"
  vpc_id = aws_vpc.main.id

  # Inbound: PostgreSQL from ECS/EKS
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  # No outbound rules needed
}
```

---

## 보안 설정

### IAM Roles

#### ECS Task Execution Role

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
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
```

#### ECS Task Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
```

### Secrets Manager

```bash
# DB 비밀번호
aws secretsmanager create-secret \
  --name fans/db-password \
  --secret-string "StrongPassword123!"

# JWT Secret
aws secretsmanager create-secret \
  --name fans/jwt-secret \
  --secret-string "$(openssl rand -base64 64)"

# Session Secret
aws secretsmanager create-secret \
  --name fans/session-secret \
  --secret-string "$(openssl rand -base64 64)"
```

---

## 비용 분석

### 월간 비용 (24/7 운영)

#### ECS 환경

| 리소스 | 스펙 | 시간당 | 월간 (730h) |
|--------|------|--------|------------|
| **Compute** |
| ECS Fargate vCPU | 2 vCPU × 8 tasks | $0.04048 × 2 × 8 | $473.01 |
| ECS Fargate Memory | 1GB × 8 tasks | $0.004445 × 8 × 8 | $207.16 |
| **Database** |
| RDS db.t4g.micro | 1 vCPU, 1GB | $0.021 | $15.33 |
| RDS Storage | 20GB gp3 | - | $2.00 |
| **Cache** |
| ElastiCache t3.micro | 2 vCPU, 0.5GB | $0.017 | $12.41 |
| **Network** |
| NAT Gateway | 2개 | $0.045 × 2 | $65.70 |
| ALB | 1개 | $0.0225 | $16.43 |
| **DNS** |
| Route53 Hosted Zone | 1개 | - | $0.50 |
| **Container Registry** |
| ECR Storage | 10GB | - | $1.00 |
| **총합** | | | **$793.54/월** |

#### EKS 환경

| 리소스 | 스펙 | 시간당 | 월간 (730h) |
|--------|------|--------|------------|
| **Kubernetes** |
| EKS Control Plane | - | $0.10 | $73.00 |
| **Compute** |
| EC2 t3.large | 2 vCPU, 8GB × 2 | $0.104 × 2 | $151.84 |
| **Database** |
| RDS db.t4g.micro | 1 vCPU, 1GB | $0.021 | $15.33 |
| **Cache** |
| ElastiCache t3.micro | - | $0.017 | $12.41 |
| **Network** |
| NAT Gateway | 2개 | $0.045 × 2 | $65.70 |
| ALB | 1개 | $0.0225 | $16.43 |
| **총합** | | | **$334.71/월** |

### 비용 최적화

#### Spot 인스턴스 (ECS)

```hcl
capacity_provider "FARGATE_SPOT" {
  fargate_spot = {}
}

# 70% 절감 가능
```

#### Reserved Instances (RDS)

```bash
# 1년 예약: 30% 할인
# 3년 예약: 50% 할인
```

---

## 모니터링 및 로깅

### CloudWatch Logs

```bash
# 로그 그룹 생성
aws logs create-log-group --log-group-name /ecs/fans-main-api
aws logs create-log-group --log-group-name /ecs/fans-crawler
aws logs create-log-group --log-group-name /ecs/fans-summarize-ai

# 로그 확인
aws logs tail /ecs/fans-main-api --follow
```

### CloudWatch Metrics

```hcl
# CPU 사용률 알람
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "fans-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "CPU usage is above 80%"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.main_api.name
  }
}
```

### Application Insights

```bash
# X-Ray 추적 (선택사항)
npm install aws-xray-sdk

# 코드에서 활성화
const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
```

---

**작성일**: 2025-10-23
**참고**: 실제 배포 시 비용 및 리소스는 트래픽에 따라 조정 필요
