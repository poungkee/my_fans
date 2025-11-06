# PostgreSQL 데이터 마이그레이션 계획

## 목표
All-in-one EC2 인스턴스의 PostgreSQL 데이터를 RDS PostgreSQL로 마이그레이션

## 배경
- 현재 EC2 인스턴스가 Public Subnet에 위치
- RDS는 Database Subnet (Private)에 위치
- 기사 ID 중복 문제 예상 → 새 ID로 자동 생성 필요

## 환경 정보

### EC2 인스턴스 (All-in-one)
- Instance ID: `i-010a36e69445d59d0`
- Name: `fans-all-in-one`
- Current Subnet: `subnet-01cec901400165fb9` (fans-crawler-public-subnet)
- Current IP: `172.17.0.6` (Private), `13.125.91.107` (Public)
- Security Group: `sg-046560572ac9dc20a`
- Key Pair: `news_crawler.pem`

### RDS PostgreSQL
- Endpoint: `fans-cluster-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com`
- Port: `5432`
- Database Subnets:
  - `subnet-08d5554253d8d4a1f` (10.0.201.0/24, ap-northeast-2a)
  - `subnet-0641e37ff7925d4cd` (10.0.202.0/24, ap-northeast-2b)
- Security Group: `sg-03c0a46ac695995e3`
- Multi-AZ: 활성화됨

### 생성된 ENI (임시)
- ENI ID: `eni-0194e687bb7738fee`
- IP Address: `10.0.201.75`
- Subnet: `subnet-08d5554253d8d4a1f` (Database subnet, AZ 2a)
- Status: EC2 인스턴스에 연결됨 (eth1)

## 마이그레이션 전략

### 선택한 방법: Method 1 - ID 제외 후 자동 생성
- ID 컬럼을 제외하고 데이터 덤프
- RDS로 복원 시 PostgreSQL이 자동으로 새 ID 생성
- 장점: ID 중복 문제 완전 해결
- 단점: 기존 ID 기반 참조 관계가 있다면 수정 필요

## 작업 단계

### 1. ENI 생성 및 EC2 연결 ✅ 완료
```bash
# ENI 생성
aws ec2 create-network-interface \
  --subnet-id subnet-08d5554253d8d4a1f \
  --groups sg-03c0a46ac695995e3 \
  --description "Temporary ENI for DB migration" \
  --region ap-northeast-2

# EC2에 연결
aws ec2 attach-network-interface \
  --network-interface-id eni-0194e687bb7738fee \
  --instance-id i-010a36e69445d59d0 \
  --device-index 1 \
  --region ap-northeast-2
```

### 2. RDS 연결 확인 (진행 예정)
```bash
# EC2에서 RDS 연결 테스트
ssh -i ~/.ssh/news_crawler.pem ubuntu@13.125.91.107

# 네트워크 인터페이스 확인
ip addr show

# RDS 연결 테스트
nc -zv fans-cluster-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com 5432

# psql 클라이언트로 연결 테스트
psql -h fans-cluster-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com \
     -U postgres \
     -d fans_db \
     -c "SELECT version();"
```

### 3. PostgreSQL 데이터 덤프 (ID 제외)
```bash
# EC2에 접속
ssh -i ~/.ssh/news_crawler.pem ubuntu@13.125.91.107

# 테이블 목록 확인
psql -U postgres -d fans_db -c "\dt"

# news_articles 테이블 스키마 확인
psql -U postgres -d fans_db -c "\d news_articles"

# ID 제외하고 데이터 덤프
pg_dump -U postgres -d fans_db \
  --table=news_articles \
  --data-only \
  --column-inserts \
  --exclude-column=id \
  > /tmp/news_articles_data.sql

# 또는 COPY 방식 (더 빠름)
psql -U postgres -d fans_db -c "\COPY (SELECT column1, column2, ... FROM news_articles) TO '/tmp/news_articles.csv' CSV HEADER"

# 덤프 파일 크기 확인
ls -lh /tmp/news_articles_data.sql
```

### 4. RDS로 데이터 복원
```bash
# RDS에 데이터 복원 (INSERT 방식)
psql -h fans-cluster-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com \
     -U postgres \
     -d fans_db \
     -f /tmp/news_articles_data.sql

# 또는 COPY 방식
psql -h fans-cluster-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com \
     -U postgres \
     -d fans_db \
     -c "\COPY news_articles(column1, column2, ...) FROM '/tmp/news_articles.csv' CSV HEADER"
```

### 5. 데이터 검증
```bash
# EC2 PostgreSQL 데이터 개수
psql -U postgres -d fans_db -c "SELECT COUNT(*) FROM news_articles;"

# RDS PostgreSQL 데이터 개수
psql -h fans-cluster-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com \
     -U postgres \
     -d fans_db \
     -c "SELECT COUNT(*) FROM news_articles;"

# 샘플 데이터 확인
psql -h fans-cluster-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com \
     -U postgres \
     -d fans_db \
     -c "SELECT * FROM news_articles ORDER BY created_at DESC LIMIT 5;"

# ID가 새로 생성되었는지 확인
psql -h fans-cluster-postgres.cz884ewuuhlv.ap-northeast-2.rds.amazonaws.com \
     -U postgres \
     -d fans_db \
     -c "SELECT MIN(id), MAX(id), COUNT(*) FROM news_articles;"
```

### 6. ENI 제거 및 복구
```bash
# ENI 분리
aws ec2 detach-network-interface \
  --attachment-id eni-attach-0990ecacfdec6b875 \
  --region ap-northeast-2

# ENI 삭제
aws ec2 delete-network-interface \
  --network-interface-id eni-0194e687bb7738fee \
  --region ap-northeast-2

# EC2 상태 확인 (원래 서브넷으로 복구 확인)
aws ec2 describe-instances \
  --instance-ids i-010a36e69445d59d0 \
  --region ap-northeast-2 \
  --query 'Reservations[0].Instances[0].[InstanceId,SubnetId,PrivateIpAddress]'
```

## 주의사항

### 1. 데이터베이스 크기 확인
마이그레이션 전에 데이터베이스 크기를 확인하여 시간 예측:
```bash
psql -U postgres -d fans_db -c "SELECT pg_size_pretty(pg_database_size('fans_db'));"
```

### 2. 애플리케이션 중단 필요성
- 마이그레이션 중 새로운 데이터가 추가되면 누락될 수 있음
- 가능하면 크롤러/스케줄러를 일시 중지:
```bash
kubectl scale deployment/scheduler -n fans --replicas=0
kubectl scale deployment/api-crawler -n fans --replicas=0
```

### 3. 외래 키 제약 조건
- ID가 변경되면 외래 키 참조가 깨질 수 있음
- 다른 테이블에서 news_articles.id를 참조하는지 확인:
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'news_articles';
```

### 4. 시퀀스 초기화
복원 후 ID 시퀀스를 올바르게 설정:
```sql
SELECT setval('news_articles_id_seq', (SELECT MAX(id) FROM news_articles));
```

### 5. 백업
마이그레이션 전 RDS 스냅샷 생성:
```bash
aws rds create-db-cluster-snapshot \
  --db-cluster-snapshot-identifier fans-cluster-before-migration \
  --db-cluster-identifier fans-cluster \
  --region ap-northeast-2
```

## 대체 방안

### Method 2: ID 매핑 테이블 사용
ID 변경이 문제가 된다면:
1. 임시 매핑 테이블 생성: `old_id -> new_id`
2. 관련 테이블의 외래 키를 새 ID로 업데이트
3. 복잡도가 높아지므로 권장하지 않음

### Method 3: 전체 데이터베이스 덤프
```bash
# 전체 DB 덤프 (스키마 + 데이터, ID 포함)
pg_dump -U postgres -d fans_db > /tmp/full_backup.sql

# RDS에 복원 (ID 중복 가능성 있음)
psql -h fans-cluster-postgres... -U postgres -d fans_db -f /tmp/full_backup.sql
```

## 롤백 계획

문제 발생 시:
1. RDS 스냅샷으로 복원
2. ENI 제거
3. EC2는 원래 상태 유지 (데이터 손실 없음)

## 타임라인 예상

- ENI 생성/연결: 5분 ✅
- 연결 확인: 5분
- 데이터 덤프: 10-30분 (데이터 크기에 따라)
- 데이터 복원: 10-30분
- 검증: 10분
- ENI 제거: 5분

**총 예상 시간: 45분 ~ 1시간 30분**

## 현재 상태

- [x] ENI 생성 시도 (VPC 불일치로 실패)
- [x] 대체 방법: EKS Pod를 통한 마이그레이션
- [x] EC2에서 데이터 덤프
- [x] RDS로 데이터 복원
- [x] 검증 완료
- [x] 임시 리소스 정리 완료

## 실제 마이그레이션 결과 (완료)

### 실행 일시
2025-11-06

### 변경된 전략
초기 계획대로 ENI를 통한 직접 연결을 시도했으나, EC2와 RDS가 서로 다른 VPC에 위치하여 실패했습니다.
- EC2 VPC: vpc-07c7916b3cfd2e7f1
- RDS VPC: vpc-06c2252e398e9fc91 (EKS VPC)

**대체 방법:**
1. EC2에서 CSV로 데이터 export (ID 제외)
2. 로컬로 다운로드
3. EKS의 psql-restore pod를 통해 RDS에 import

### 데이터 마이그레이션 상세

```bash
# 1. EC2에서 데이터 export (ID 제외)
ssh -i ~/.ssh/news_crawler.pem ubuntu@13.125.91.107
docker exec -i fans-postgres psql -U fans_admin -d fans_db -c \
  "\COPY (SELECT title, content, ai_summary, url, image_url, source_id, category_id, journalist, pub_date, created_at, updated_at FROM news_articles) TO STDOUT CSV HEADER" > /tmp/news_articles_noID.csv

# 2. 로컬로 다운로드
scp -i ~/.ssh/news_crawler.pem ubuntu@13.125.91.107:/tmp/news_articles_noID.csv /tmp/

# 3. psql-restore pod 생성 및 파일 복사
kubectl apply -f /tmp/psql-restore-pod.yaml
kubectl cp /tmp/news_articles_noID.csv fans/psql-restore:/tmp/

# 4. 중복 제거 SQL 스크립트 실행
kubectl exec -n fans psql-restore -- psql -h fans-cluster-postgres... -U fans_user -d fans_db -f /tmp/import_unique_v2.sql
```

### 마이그레이션 결과
- **EC2 원본 데이터:** 61,566개 (61,564개 + 중복 2개)
- **RDS 기존 데이터:** 26,610개
- **추가된 신규 기사:** 42,853개
- **최종 RDS 데이터:** 69,540개 ✓

### 중복 처리 방식
```sql
-- DISTINCT ON으로 temp 테이블 내부 중복 제거
-- NOT EXISTS로 RDS와 중복 제거
SELECT DISTINCT ON (t.url)
  ...
FROM temp_import t
WHERE NOT EXISTS (
  SELECT 1 FROM news_articles n WHERE n.url = t.url
)
ORDER BY t.url, t.created_at DESC;
```

### 발견된 문제 및 해결
1. **VPC 불일치**: ENI 연결 실패 → EKS pod 방식으로 변경
2. **PostgreSQL 사용자**: `postgres` 대신 `fans_admin` 사용
3. **URL 중복**: 임시 테이블 내부에도 중복 URL 존재 → DISTINCT ON으로 해결

### 검증
```bash
# RDS 최종 기사 수 확인
kubectl exec -n fans psql-restore -- psql -h fans-cluster-postgres... -U fans_user -d fans_db \
  -c "SELECT COUNT(*) FROM news_articles;"
# 결과: 69,540

# 계산 검증
# 26,610 (기존) + 42,853 (추가) ≈ 69,540 (최종) ✓
```

### 정리된 리소스
- psql-restore pod 삭제
- 로컬 임시 파일 삭제:
  - /tmp/fans_db_dump.sql
  - /tmp/news_articles_noID.csv
  - /tmp/import_unique.sql
  - /tmp/import_unique_v2.sql
  - /tmp/psql-restore-pod.yaml
- ENI (eni-0194e687bb7738fee) 분리 및 삭제 완료

### 소요 시간
약 50분 (문제 해결 포함)

## 참고 문서

- docs/system_architecture: 데이터베이스/엔티티 정의
- CLAUDE.md: 프로젝트 아키텍처 및 포트 설정
