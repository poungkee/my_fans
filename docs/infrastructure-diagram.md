# FANS 프로젝트 인프라 아키텍처

## 1. 전체 아키텍처 (EKS + S3/CloudFront 하이브리드)

```mermaid
graph TB
    subgraph Internet["인터넷"]
        User[사용자]
        ExternalAPI[외부 API<br/>Naver/Daum/Kakao]
    end

    subgraph Route53["Route 53"]
        DNS_FE[www.fans.ai.kr<br/>프론트엔드]
        DNS_API[api.fans.ai.kr<br/>백엔드 API]
    end

    subgraph CloudFront["CloudFront CDN"]
        CF[Distribution<br/>d2iwlion0vtxvr]
    end

    subgraph S3["S3 정적 호스팅"]
        S3_FE[fans-profile-images<br/>프론트엔드 + 이미지]
    end

    subgraph VPC["VPC: 10.0.0.0/16"]
        subgraph PublicSubnets["퍼블릭 서브넷"]
            subgraph AZ1Public["AZ-2a: 10.0.0.0/19"]
                NAT1[NAT Gateway]
            end
            subgraph AZ2Public["AZ-2b: 10.0.64.0/19"]
                NAT2[NAT Gateway]
            end
            subgraph AZ3Public["AZ-2c: 10.0.32.0/19"]
                ALB[Application<br/>Load Balancer<br/>백엔드용]
            end
        end

        subgraph PrivateSubnets["프라이빗 서브넷"]
            subgraph AZ1Private["AZ-2a: 10.0.96.0/19"]
                Node1[EKS Worker<br/>Node 1-2]
            end
            subgraph AZ2Private["AZ-2b: 10.0.160.0/19"]
                Node2[EKS Worker<br/>Node 3-4]
            end
            subgraph AZ3Private["AZ-2c: 10.0.128.0/19"]
                Node3[EKS Worker<br/>Node 5-6]
            end
        end

        subgraph EKS["EKS 클러스터: fans-cluster"]
            ControlPlane[EKS Control Plane<br/>Kubernetes 1.31]
        end
    end

    subgraph Storage["스토리지"]
        EBS[EBS Volumes<br/>gp3 30GB]
    end

    User -->|프론트엔드| DNS_FE
    User -->|API 호출| DNS_API
    DNS_FE -->|HTTPS| CF
    CF -->|Origin| S3_FE
    DNS_API -->|Route| ALB
    ALB -->|Forward| Node1
    ALB -->|Forward| Node2
    ALB -->|Forward| Node3

    Node1 -.->|외부 통신| NAT1
    Node2 -.->|외부 통신| NAT2
    Node3 -.->|외부 통신| NAT1

    NAT1 -->|크롤링| ExternalAPI
    NAT2 -->|크롤링| ExternalAPI

    Node1 -.->|관리| ControlPlane
    Node2 -.->|관리| ControlPlane
    Node3 -.->|관리| ControlPlane

    Node1 -->|이미지 저장| S3_FE
    Node1 -.->|볼륨| EBS
```

## 2. EKS 파드 배포 구성 (프론트엔드 S3로 이동)

```mermaid
graph TB
    subgraph CloudFront_S3["CloudFront + S3"]
        FE[Frontend<br/>S3 정적 호스팅<br/>CloudFront CDN]
    end

    subgraph Namespace["Namespace: fans"]
        subgraph Backend["백엔드 서비스"]
            API[Main API Pod<br/>Node.js:3000<br/>Replicas: 2]
            Crawler[Crawler Pod<br/>Puppeteer:4003<br/>Replicas: 1]
            Scheduler[Scheduler Pod<br/>Node.js<br/>Replicas: 1]
            Classifier[Classifier API<br/>Python:5000<br/>Replicas: 1]
        end

        subgraph AI["AI 서비스"]
            Summarize[Summarize AI<br/>Python:8000<br/>Replicas: 1]
            Bias[Bias Analysis AI<br/>Python:8002<br/>Replicas: 1]
        end

        subgraph Database["데이터베이스"]
            Postgres[(PostgreSQL<br/>5432<br/>StatefulSet)]
            Redis[(Redis<br/>6379<br/>StatefulSet)]
        end

        subgraph Storage["영구 스토리지"]
            PVC1[PVC: postgres-data<br/>gp3 20Gi]
            PVC2[PVC: redis-data<br/>gp3 5Gi]
        end
    end

    FE -->|API 호출| API
    API -->|데이터 조회/저장| Postgres
    API -->|캐시| Redis
    API -->|AI 요약| Summarize
    API -->|편향 분석| Bias
    API -->|분류| Classifier

    Crawler -->|Raw 데이터 저장| Postgres
    Scheduler -->|뉴스 처리| Postgres
    Scheduler -->|AI 호출| Summarize

    Postgres -.->|마운트| PVC1
    Redis -.->|마운트| PVC2
```

## 3. 데이터 흐름도 (S3 + CloudFront 프론트엔드)

```mermaid
sequenceDiagram
    participant User as 사용자
    participant CF as CloudFront
    participant S3_FE as S3 (Frontend)
    participant API as Main API (EKS)
    participant Auth as 카카오 OAuth
    participant Crawler as Crawler
    participant Scheduler as Scheduler
    participant AI as AI Services
    participant DB as PostgreSQL
    participant Cache as Redis
    participant S3_IMG as S3 (Images)

    Note over Crawler: 30초마다 실행
    Crawler->>ExternalAPI: 뉴스 크롤링
    ExternalAPI-->>Crawler: HTML/JSON 데이터
    Crawler->>DB: raw_news_data 테이블에 저장

    Note over Scheduler: 10분마다 실행
    Scheduler->>DB: raw_news_data 조회
    Scheduler->>AI: 뉴스 요약 요청
    AI-->>Scheduler: 요약 결과
    Scheduler->>DB: news_articles 테이블에 저장

    User->>CF: www.fans.ai.kr 접속
    CF->>S3_FE: 프론트엔드 요청
    S3_FE-->>CF: React 앱 (HTML/JS/CSS)
    CF-->>User: 프론트엔드 전달

    User->>API: api.fans.ai.kr API 요청

    alt 로그인 요청
        API->>Auth: OAuth 인증
        Auth-->>API: 사용자 정보
        API->>DB: 사용자 저장
    end

    alt 뉴스 조회
        API->>Cache: 캐시 확인
        alt 캐시 히트
            Cache-->>API: 캐시된 데이터
        else 캐시 미스
            API->>DB: 뉴스 조회
            DB-->>API: 뉴스 데이터
            API->>Cache: 캐시 저장
        end
    end

    alt 프로필 업로드
        API->>S3_IMG: profile-images/ 경로에 업로드
        S3_IMG-->>API: 이미지 URL
        API->>DB: URL 저장
    end

    API-->>User: JSON 응답
```

## 4. 네트워크 구성

```mermaid
graph LR
    subgraph Internet["인터넷<br/>0.0.0.0/0"]
        IGW[Internet Gateway]
    end

    subgraph VPC["VPC: 10.0.0.0/16"]
        subgraph PublicRT["Public Route Table"]
            PubRoute[0.0.0.0/0 → IGW]
        end

        subgraph PrivateRT1["Private RT 1"]
            PrivRoute1[0.0.0.0/0 → NAT-1]
        end

        subgraph PrivateRT2["Private RT 2"]
            PrivRoute2[0.0.0.0/0 → NAT-2]
        end

        subgraph PublicSub["퍼블릭 서브넷 ×3"]
            Pub1[10.0.0.0/19<br/>AZ-2a]
            Pub2[10.0.64.0/19<br/>AZ-2b]
            Pub3[10.0.32.0/19<br/>AZ-2c]
        end

        subgraph PrivateSub["프라이빗 서브넷 ×3"]
            Priv1[10.0.96.0/19<br/>AZ-2a]
            Priv2[10.0.160.0/19<br/>AZ-2b]
            Priv3[10.0.128.0/19<br/>AZ-2c]
        end
    end

    IGW -.->|연결| PublicRT
    PublicRT -.->|적용| Pub1
    PublicRT -.->|적용| Pub2
    PublicRT -.->|적용| Pub3

    Pub1 -->|NAT 1 배치| PrivateRT1
    Pub2 -->|NAT 2 배치| PrivateRT2

    PrivateRT1 -.->|적용| Priv1
    PrivateRT1 -.->|적용| Priv3
    PrivateRT2 -.->|적용| Priv2
```

## 5. 보안 그룹 구성

```mermaid
graph TB
    subgraph SG_ALB["SG: ALB Security Group"]
        ALB_IN[Inbound<br/>80: 0.0.0.0/0<br/>443: 0.0.0.0/0]
        ALB_OUT[Outbound<br/>All: 0.0.0.0/0]
    end

    subgraph SG_Node["SG: EKS Node Security Group"]
        Node_IN[Inbound<br/>All: 자체 SG<br/>443: Control Plane<br/>1025-65535: ALB SG]
        Node_OUT[Outbound<br/>All: 0.0.0.0/0]
    end

    subgraph SG_Control["SG: EKS Control Plane"]
        CP_IN[Inbound<br/>443: Node SG]
        CP_OUT[Outbound<br/>All: Node SG]
    end

    subgraph SG_DB["SG: Database (개념적)"]
        DB_IN[Inbound<br/>5432: Node SG only<br/>6379: Node SG only]
        DB_OUT[Outbound<br/>None]
    end

    SG_ALB -->|트래픽 전달| SG_Node
    SG_Node -->|API 호출| SG_Control
    SG_Node -->|DB 접근| SG_DB
```

## 6. 데이터베이스 ERD (주요 테이블)

```mermaid
erDiagram
    USERS ||--o{ NEWS_PREFERENCES : has
    USERS ||--o{ READING_HISTORY : has
    USERS {
        int id PK
        string kakao_id UK
        string email
        string nickname
        string profile_image_url
        timestamp created_at
        timestamp updated_at
    }

    NEWS_ARTICLES ||--o{ READING_HISTORY : tracks
    NEWS_ARTICLES ||--|| AI_SUMMARIES : has
    NEWS_ARTICLES {
        int id PK
        string title
        text content
        string url UK
        string category
        string source
        timestamp published_at
        timestamp created_at
    }

    RAW_NEWS_DATA ||--|| NEWS_ARTICLES : "processed into"
    RAW_NEWS_DATA {
        int id PK
        string url UK
        jsonb raw_data
        string source
        string status
        timestamp created_at
    }

    AI_SUMMARIES {
        int id PK
        int news_id FK
        text summary
        text key_points
        timestamp created_at
    }

    BIAS_ANALYSIS {
        int id PK
        int news_id FK
        float bias_score
        string bias_direction
        text analysis
        timestamp created_at
    }

    NEWS_PREFERENCES {
        int id PK
        int user_id FK
        string category
        boolean enabled
    }

    READING_HISTORY {
        int id PK
        int user_id FK
        int news_id FK
        timestamp read_at
    }

    NEWS_ARTICLES ||--o{ BIAS_ANALYSIS : has
```

## 7. ECS 아키텍처 (참고용 - 미사용)

```mermaid
graph TB
    subgraph ECS["ECS 클러스터 (참고용)"]
        subgraph Fargate["Fargate 컴퓨팅"]
            Task1[Task: API<br/>Fargate]
            Task2[Task: Crawler<br/>Fargate]
            Task3[Task: AI<br/>Fargate]
        end

        subgraph TaskDefinition["Task Definitions"]
            TD1[fans-api<br/>CPU: 256<br/>Memory: 512]
            TD2[fans-crawler<br/>CPU: 512<br/>Memory: 1024]
            TD3[fans-ai<br/>CPU: 1024<br/>Memory: 2048]
        end

        subgraph Service["ECS Services"]
            Svc1[API Service<br/>Desired: 2]
            Svc2[Crawler Service<br/>Desired: 1]
            Svc3[AI Service<br/>Desired: 1]
        end
    end

    subgraph Network["네트워킹"]
        TargetGroup[Target Group]
        ALB2[Application LB]
    end

    Note1[현재 미사용<br/>EKS 사용 중]

    TD1 -.->|정의| Task1
    TD2 -.->|정의| Task2
    TD3 -.->|정의| Task3

    Svc1 -.->|관리| Task1
    Svc2 -.->|관리| Task2
    Svc3 -.->|관리| Task3

    ALB2 -.->|라우팅| TargetGroup
    TargetGroup -.->|연결| Task1

    Note1 -.->|참고| ECS
```

## 8. CI/CD 파이프라인

```mermaid
graph LR
    subgraph Dev["개발 환경"]
        Code[소스 코드 수정]
    end

    subgraph Build["빌드"]
        Docker[Docker Build]
        ECR[ECR Push<br/>907123164281.dkr.ecr...com]
    end

    subgraph Deploy["배포"]
        K8s[kubectl rollout restart]
        EKS[EKS 클러스터]
    end

    subgraph Monitor["모니터링"]
        Logs[CloudWatch Logs]
        Metrics[Container Insights]
    end

    Code -->|git push| Docker
    Docker -->|이미지 푸시| ECR
    ECR -->|이미지 pull| K8s
    K8s -->|배포| EKS
    EKS -->|로그/메트릭| Logs
    EKS -->|모니터링| Metrics
```

## 주요 구성 요약

### 컴퓨팅
- **EKS 클러스터**: fans-cluster (Kubernetes 1.31)
- **노드 그룹**:
  - Medium (t3.medium × 3)
  - Large (t3.large × 3)
- **총 노드**: 6개 (3개 AZ 분산)

### 네트워킹
- **VPC**: 10.0.0.0/16
- **서브넷**: 퍼블릭 3개 + 프라이빗 3개
- **NAT Gateway**: 2개 (고가용성)
- **Load Balancer**: ALB 1개

### 스토리지
- **EBS**: gp3 볼륨 (PostgreSQL, Redis)
- **S3**: fans-profile-images-907123164281

### 보안
- **IAM 역할**: Node 역할에 S3 접근 정책
- **보안 그룹**: ALB, Node, Control Plane 분리
- **네트워크**: 프라이빗 서브넷에서 노드 실행

### 데이터베이스
- **PostgreSQL**: 5432 (StatefulSet)
- **Redis**: 6379 (캐시)
- **주요 테이블**: users, news_articles, raw_news_data, ai_summaries
