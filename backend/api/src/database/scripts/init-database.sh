#!/bin/bash

# ======================================================
# FANS Database Initialization Script
# ======================================================
# Purpose: Initialize FANS database with schema and seed data
# Usage: ./init-database.sh [environment]
# Environment: development (default) | production | test
# ======================================================

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
ENV="${1:-development}"

# Database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-fans_db}"
DB_USER="${DB_USER:-fans_user}"
DB_PASSWORD="${DB_PASSWORD:-fans_password}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PostgreSQL is available
check_postgres() {
    log_info "PostgreSQL 연결 확인 중..."

    if command -v psql >/dev/null 2>&1; then
        log_success "psql 클라이언트가 설치되어 있습니다"
    else
        log_error "psql 클라이언트가 설치되어 있지 않습니다"
        echo "Ubuntu/Debian: sudo apt-get install postgresql-client"
        echo "macOS: brew install postgresql"
        exit 1
    fi

    # Test connection
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        log_success "데이터베이스 연결 성공"
    else
        log_error "데이터베이스 연결 실패"
        echo "확인사항:"
        echo "  - PostgreSQL 서버가 실행 중인지 확인"
        echo "  - 연결 정보가 올바른지 확인 (HOST: $DB_HOST, PORT: $DB_PORT, DB: $DB_NAME, USER: $DB_USER)"
        echo "  - Docker 컨테이너 실행: docker-compose up -d postgres"
        exit 1
    fi
}

# Execute SQL file
execute_sql() {
    local sql_file="$1"
    local description="$2"

    if [ ! -f "$sql_file" ]; then
        log_error "SQL 파일을 찾을 수 없습니다: $sql_file"
        return 1
    fi

    log_info "$description 실행 중: $(basename "$sql_file")"

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$sql_file"; then
        log_success "$description 완료"
        return 0
    else
        log_error "$description 실패"
        return 1
    fi
}

# Main initialization function
init_database() {
    log_info "FANS 데이터베이스 초기화 시작 (환경: $ENV)"

    # Check prerequisites
    check_postgres

    # Schema creation
    local schema_dir="$SCRIPT_DIR/../schemas"
    if [ -d "$schema_dir" ]; then
        log_info "데이터베이스 스키마 생성 중..."
        for sql_file in "$schema_dir"/*.sql; do
            if [ -f "$sql_file" ]; then
                execute_sql "$sql_file" "스키마 생성"
            fi
        done
    else
        log_warning "스키마 디렉토리를 찾을 수 없습니다: $schema_dir"
    fi

    # Seed data (only for development and test environments)
    if [ "$ENV" != "production" ]; then
        local seeds_dir="$SCRIPT_DIR/../seeds"
        if [ -d "$seeds_dir" ]; then
            log_info "초기 데이터 삽입 중..."
            for sql_file in "$seeds_dir"/*.sql; do
                if [ -f "$sql_file" ]; then
                    execute_sql "$sql_file" "시드 데이터 삽입"
                fi
            done
        else
            log_warning "시드 디렉토리를 찾을 수 없습니다: $seeds_dir"
        fi
    else
        log_info "운영 환경이므로 시드 데이터를 건너뜁니다"
    fi

    log_success "데이터베이스 초기화 완료!"
}

# Show usage
show_usage() {
    echo "사용법: $0 [environment]"
    echo ""
    echo "환경:"
    echo "  development  - 개발 환경 (기본값, 시드 데이터 포함)"
    echo "  production   - 운영 환경 (스키마만)"
    echo "  test         - 테스트 환경 (시드 데이터 포함)"
    echo ""
    echo "환경 변수:"
    echo "  DB_HOST      - 데이터베이스 호스트 (기본값: localhost)"
    echo "  DB_PORT      - 데이터베이스 포트 (기본값: 5432)"
    echo "  DB_NAME      - 데이터베이스 이름 (기본값: fans_db)"
    echo "  DB_USER      - 데이터베이스 사용자 (기본값: fans_user)"
    echo "  DB_PASSWORD  - 데이터베이스 비밀번호 (기본값: fans_password)"
    echo ""
    echo "예시:"
    echo "  $0                    # 개발 환경으로 초기화"
    echo "  $0 production         # 운영 환경으로 초기화"
    echo "  DB_HOST=postgres $0   # Docker 컨테이너 이름 사용"
}

# Handle command line arguments
case "$1" in
    -h|--help)
        show_usage
        exit 0
        ;;
    development|production|test|"")
        init_database
        ;;
    *)
        log_error "알 수 없는 환경: $1"
        show_usage
        exit 1
        ;;
esac