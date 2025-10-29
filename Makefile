# ================================
# FANS 프로젝트 환경 관리 Makefile
# 개발/운영 환경 자동 전환
# ================================

.PHONY: help dev prod-eks clean db-init db-reset logs status

# 기본 타겟: 도움말 출력
help:
	@echo "FANS Backend Environment Management"
	@echo ""
	@echo "Available commands:"
	@echo "  make dev          - Start development environment (Docker Compose)"
	@echo "  make prod-eks     - Deploy to production (AWS EKS)"
	@echo "  make db-init      - Initialize development database schemas"
	@echo "  make db-reset     - Reset development database (⚠️  Delete all data)"
	@echo "  make clean        - Stop all containers and clean volumes"
	@echo "  make logs         - Show logs (service=SERVICE_NAME)"
	@echo "  make status       - Show running containers status"
	@echo ""

# 개발 환경 시작
dev:
	@echo "🚀 Starting development environment..."
	@echo ""
	@echo "✓ Using DB_SCHEMA=development"
	@cd environments/local && docker-compose up -d
	@echo ""
	@echo "✅ Development environment is running:"
	@echo "  - API Server:    http://localhost:3000"
	@echo "  - Frontend:      http://localhost:3001"
	@echo "  - Database:      localhost:5432 (schema: development)"
	@echo "  - Redis:         localhost:6379"
	@echo ""
	@echo "📋 Useful commands:"
	@echo "  make logs service=main-api    - View API logs"
	@echo "  make status                   - Check status"
	@echo "  make clean                    - Stop all services"

# 운영 환경 배포 (EKS)
prod-eks:
	@echo "🚀 Deploying to production (EKS)..."
	@echo ""
	@echo "⚠️  WARNING: This will deploy to PRODUCTION environment!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@echo ""
	@echo "✓ Building Docker images..."
	@docker build -t fans-main-api:latest -f backend/api/Dockerfile backend/api
	@echo ""
	@echo "✓ Applying Kubernetes manifests..."
	@kubectl apply -f environments/eks/manifests/
	@echo ""
	@echo "✅ Deployment complete!"
	@echo "  Check status: kubectl get pods -n fans-svc"

# 데이터베이스 초기화 (개발)
db-init:
	@echo "🗄️  Initializing development database schemas..."
	@docker exec -i fans_postgres psql -U fans_user -d fans_db < backend/database/schemas/01_create_schemas.sql
	@docker exec -i fans_postgres psql -U fans_user -d fans_db < backend/database/schemas/02_development_tables.sql
	@echo "✅ Database initialized (development schema)"

# 데이터베이스 초기화 (운영)
db-init-prod:
	@echo "🗄️  Initializing production database schemas..."
	@echo "⚠️  WARNING: This will create production schema!"
	@docker exec -i fans_postgres psql -U fans_user -d fans_db < backend/database/schemas/01_create_schemas.sql
	@docker exec -i fans_postgres psql -U fans_user -d fans_db < backend/database/schemas/03_production_tables.sql
	@echo "✅ Production schema initialized"

# 데이터베이스 리셋 (개발)
db-reset:
	@echo "⚠️  WARNING: This will DELETE ALL DATA in development schema!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@docker exec -i fans_postgres psql -U fans_user -d fans_db -c "DROP SCHEMA IF EXISTS development CASCADE;"
	@docker exec -i fans_postgres psql -U fans_user -d fans_db < backend/database/schemas/01_create_schemas.sql
	@docker exec -i fans_postgres psql -U fans_user -d fans_db < backend/database/schemas/02_development_tables.sql
	@echo "✅ Database reset complete"

# 정리
clean:
	@echo "🧹 Stopping all containers..."
	@cd environments/local && docker-compose down
	@echo "✅ All containers stopped"

# 전체 정리 (볼륨 포함)
clean-all:
	@echo "🧹 Stopping all containers and removing volumes..."
	@echo "⚠️  WARNING: This will DELETE ALL DATA!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@cd environments/local && docker-compose down -v
	@echo "✅ All containers and volumes removed"

# 로그 확인
logs:
	@if [ -z "$(service)" ]; then \
		echo "Usage: make logs service=SERVICE_NAME"; \
		echo "Available services: main-api, postgres, redis, summarize-ai, bias-analysis-ai"; \
	else \
		cd environments/local && docker-compose logs -f $(service); \
	fi

# 상태 확인
status:
	@echo "📊 Container Status:"
	@docker ps --filter "name=fans_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 빌드
build:
	@echo "📦 Building Docker images..."
	@cd environments/local && docker-compose build

# 재시작
restart:
	@echo "🔄 Restarting services..."
	@cd environments/local && docker-compose restart
	@echo "✅ Services restarted"

# 특정 서비스만 시작
start-api:
	@cd environments/local && docker-compose up -d main-api

start-db:
	@cd environments/local && docker-compose up -d postgres redis

start-ai:
	@cd environments/local && docker-compose up -d summarize-ai bias-analysis-ai

# 테스트
test:
	@echo "🧪 Running tests..."
	@cd backend/api && npm test

# 타입 체크
typecheck:
	@echo "🔍 Running TypeScript type check..."
	@cd backend/api && npm run typecheck

# DB 스키마 확인
db-check:
	@echo "📊 Database Schemas:"
	@docker exec fans_postgres psql -U fans_user -d fans_db -c "\dn"
	@echo ""
	@echo "📋 Development Tables:"
	@docker exec fans_postgres psql -U fans_user -d fans_db -c "\dt development.*" | head -25
