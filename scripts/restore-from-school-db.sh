#!/bin/bash
# FANS 데이터베이스 복원 스크립트
# 학원 백업 DB → 로컬 DB로 데이터 복원

set -e

echo "========================================"
echo "FANS Database Restore from School Server"
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
RESTORE_FILE="fans_restore_${TIMESTAMP}.sql"
BACKUP_DIR="./backups"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

echo "⚠️  WARNING: 이 작업은 현재 development 스키마의 모든 데이터를 삭제합니다!"
echo "계속하려면 5초 내에 Ctrl+C로 취소하세요..."
sleep 5

echo ""
echo "1. 학원 DB에서 백업 데이터 다운로드 중..."
PGPASSWORD=$BACKUP_DB_PASSWORD pg_dump \
    -h $BACKUP_DB_HOST \
    -p $BACKUP_DB_PORT \
    -U $BACKUP_DB_USERNAME \
    -d $BACKUP_DB_NAME \
    --schema=fans_backup \
    --clean \
    --if-exists \
    > $BACKUP_DIR/$RESTORE_FILE

echo "✅ 다운로드 완료: $BACKUP_DIR/$RESTORE_FILE"
echo ""

echo "2. 로컬 DB 스키마 초기화 중..."
docker exec -i fans_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "DROP SCHEMA IF EXISTS development CASCADE;"
docker exec -i fans_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < backend/database/schemas/01_create_schemas.sql
docker exec -i fans_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < backend/database/schemas/02_development_tables.sql

echo "✅ 스키마 초기화 완료"
echo ""

echo "3. 백업 데이터 복원 중..."
docker exec -i fans_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < $BACKUP_DIR/$RESTORE_FILE

echo ""
echo "✅ 복원 완료!"
echo ""
echo "복원 정보:"
echo "  - 복원 파일: $BACKUP_DIR/$RESTORE_FILE"
echo "  - 소스: $BACKUP_DB_HOST:$BACKUP_DB_PORT (fans_backup 스키마)"
echo "  - 대상: localhost:5432 (development 스키마)"
echo ""
