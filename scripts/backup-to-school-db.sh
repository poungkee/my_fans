#!/bin/bash
# FANS 데이터베이스 백업 스크립트
# 로컬/EKS DB → 학원 백업 DB로 데이터 백업

set -e

echo "========================================"
echo "FANS Database Backup to School Server"
echo "========================================"

# 환경변수 로드
if [ -f "environments/local/.env" ]; then
    source environments/local/.env
fi

# 백업 활성화 확인
if [ "$BACKUP_DB_ENABLED" != "true" ]; then
    echo "❌ 백업이 비활성화되어 있습니다."
    echo "   BACKUP_DB_ENABLED=true로 설정하세요."
    exit 1
fi

# 변수 설정
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="fans_backup_${TIMESTAMP}.sql"
BACKUP_DIR="./backups"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

echo "1. 로컬 DB에서 데이터 덤프 중..."
docker exec fans_postgres pg_dump \
    -U $POSTGRES_USER \
    -d $POSTGRES_DB \
    --schema=development \
    --clean \
    --if-exists \
    > $BACKUP_DIR/$BACKUP_FILE

echo "✅ 덤프 완료: $BACKUP_DIR/$BACKUP_FILE"
echo ""

echo "2. 학원 DB로 백업 업로드 중..."
echo "   Target: $BACKUP_DB_HOST:$BACKUP_DB_PORT"

# 학원 DB에 백업 테이블 생성 및 데이터 삽입
PGPASSWORD=$BACKUP_DB_PASSWORD psql \
    -h $BACKUP_DB_HOST \
    -p $BACKUP_DB_PORT \
    -U $BACKUP_DB_USERNAME \
    -d $BACKUP_DB_NAME \
    -c "CREATE SCHEMA IF NOT EXISTS fans_backup;"

PGPASSWORD=$BACKUP_DB_PASSWORD psql \
    -h $BACKUP_DB_HOST \
    -p $BACKUP_DB_PORT \
    -U $BACKUP_DB_USERNAME \
    -d $BACKUP_DB_NAME \
    < $BACKUP_DIR/$BACKUP_FILE

echo "✅ 백업 완료!"
echo ""
echo "백업 정보:"
echo "  - 백업 파일: $BACKUP_DIR/$BACKUP_FILE"
echo "  - 백업 서버: $BACKUP_DB_HOST:$BACKUP_DB_PORT"
echo "  - 스키마: fans_backup"
echo ""
echo "복원 방법:"
echo "  psql -h $BACKUP_DB_HOST -p $BACKUP_DB_PORT -U $BACKUP_DB_USERNAME -d $BACKUP_DB_NAME < $BACKUP_DIR/$BACKUP_FILE"
echo ""
