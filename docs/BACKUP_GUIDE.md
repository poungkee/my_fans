# 학원 백업 DB 연결 가이드

## 📋 개요

학원에서 제공하는 PostgreSQL 서버를 백업 DB로 사용하는 가이드입니다.

### 백업 DB 정보
- **호스트**: 211.46.52.151
- **포트**: 15432
- **사용자**: team1
- **비밀번호**: Gkrtod1@
- **데이터베이스**: postgres
- **백업 스키마**: fans_backup

---

## 🚀 로컬 환경 사용법

### 1. 환경변수 설정

`environments/local/.env` 파일에서 백업 활성화:

```bash
# Backup Database (학원 서버)
BACKUP_DB_HOST=211.46.52.151
BACKUP_DB_PORT=15432
BACKUP_DB_USERNAME=team1
BACKUP_DB_PASSWORD=Gkrtod1@
BACKUP_DB_NAME=postgres
BACKUP_DB_ENABLED=true  # false → true로 변경
```

### 2. 백업 실행

로컬 DB → 학원 DB로 백업:

```bash
make backup-to-school
```

실행 순서:
1. 로컬 Docker PostgreSQL에서 `development` 스키마 덤프
2. `./backups/` 디렉토리에 SQL 파일 저장
3. 학원 DB의 `fans_backup` 스키마로 업로드

### 3. 복원 실행

학원 DB → 로컬 DB로 복원:

```bash
make restore-from-school
```

⚠️ **주의**: 현재 로컬 `development` 스키마의 모든 데이터가 삭제됩니다!

### 4. 학원 DB 직접 접속

psql로 학원 DB에 접속:

```bash
make connect-school-db
```

또는 직접:

```bash
psql -h 211.46.52.151 -p 15432 -U team1 -d postgres
# 비밀번호: Gkrtod1@
```

---

## ☁️ EKS 환경 사용법

### 1. 백업 활성화

EKS Secrets에서 백업 활성화:

```bash
kubectl edit secret fans-secrets -n fans
```

다음 값을 변경:
```yaml
BACKUP_DB_ENABLED: "true"  # "false" → "true"로 변경
```

### 2. 자동 백업 (CronJob)

매일 새벽 2시에 자동으로 백업됩니다:

```bash
# CronJob 확인
kubectl get cronjob -n fans

# 수동으로 즉시 실행
kubectl create job --from=cronjob/db-backup-to-school manual-backup-$(date +%s) -n fans

# 백업 Job 로그 확인
kubectl logs -f job/manual-backup-xxxxx -n fans
```

### 3. 백업 스케줄 변경

`environments/eks/manifests/09-backup-cronjob.yaml` 수정:

```yaml
spec:
  schedule: "0 2 * * *"  # 매일 02:00 (Cron 표현식)
  # 예시:
  # "0 */6 * * *"  - 6시간마다
  # "0 0 * * 0"    - 매주 일요일 자정
  # "0 3 * * 1-5"  - 평일 새벽 3시
```

변경 후 적용:
```bash
kubectl apply -f environments/eks/manifests/09-backup-cronjob.yaml
```

---

## 🛠️ GUI 도구로 접속

### DBeaver 설정

1. **New Connection** → **PostgreSQL**
2. **연결 정보 입력**:
   - Host: `211.46.52.151`
   - Port: `15432`
   - Database: `postgres`
   - Username: `team1`
   - Password: `Gkrtod1@`
3. **Test Connection** → **OK**

### pgAdmin 설정

1. **Servers** → **Create** → **Server**
2. **General** 탭:
   - Name: `학원 백업 서버`
3. **Connection** 탭:
   - Host: `211.46.52.151`
   - Port: `15432`
   - Username: `team1`
   - Password: `Gkrtod1@`
4. **Save**

---

## 📊 백업 데이터 확인

### 로컬 백업 파일 확인

```bash
ls -lh backups/
```

### 학원 DB에서 백업 데이터 확인

```bash
# psql로 접속 후
\c postgres
\dn  # 스키마 목록 확인

# fans_backup 스키마의 테이블 확인
\dt fans_backup.*

# 데이터 조회 예시
SELECT COUNT(*) FROM fans_backup.news_articles;
```

---

## ⚠️ 주의사항

### 보안
- ✅ 백업 DB 비밀번호는 절대 GitHub에 커밋하지 마세요
- ✅ 환경변수 파일(`.env`)은 `.gitignore`에 포함되어 있습니다
- ✅ EKS Secrets는 Kubernetes 내부에서 암호화됩니다

### 용량 관리
- 로컬 백업 파일(`./backups/`)은 주기적으로 삭제하세요
- 학원 DB 용량 제한을 확인하세요
- 오래된 백업은 수동으로 정리하세요

### 네트워크
- 학원 서버가 외부 IP 접속을 허용해야 합니다
- EKS에서 접속 시 방화벽 규칙 확인이 필요합니다
- VPN 또는 특정 IP만 허용될 수 있습니다

---

## 🔧 문제 해결

### 연결 실패

```bash
# 연결 테스트
telnet 211.46.52.151 15432

# 방화벽 확인
curl -v telnet://211.46.52.151:15432
```

### 백업 실패

1. 로그 확인:
   ```bash
   kubectl logs -f cronjob/db-backup-to-school -n fans
   ```

2. 수동 실행으로 디버깅:
   ```bash
   make backup-to-school
   ```

3. 학원 DB 접속 확인:
   ```bash
   make connect-school-db
   ```

---

## 📌 참고

- 백업 파일은 Git에 추적되지 않습니다 (`.gitignore` 설정됨)
- 프로덕션 DB는 `production` 스키마를 백업합니다
- 개발 환경은 `development` 스키마를 백업합니다
