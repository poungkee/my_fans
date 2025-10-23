# FANS 프로젝트 Makefile
# 환경별 빠른 실행을 위한 명령어 모음

.PHONY: help env-local env-ecs env-eks start-local start-ecs start-eks stop logs clean

# 기본 타겟
help:
	@echo "FANS 프로젝트 - 사용 가능한 명령어"
	@echo ""
	@echo "환경 전환:"
	@echo "  make env-local    - 로컬 개발 환경으로 전환"
	@echo "  make env-ecs      - ECS 배포 환경으로 전환"
	@echo "  make env-eks      - EKS 배포 환경으로 전환"
	@echo ""
	@echo "Docker Compose 실행:"
	@echo "  make start-local  - 로컬 환경으로 시작"
	@echo "  make start-ecs    - ECS 시뮬레이션 시작"
	@echo "  make start-eks    - EKS 시뮬레이션 시작"
	@echo "  make stop         - 모든 서비스 중지"
	@echo ""
	@echo "유틸리티:"
	@echo "  make logs         - 전체 로그 확인"
	@echo "  make logs-api     - API 로그만 확인"
	@echo "  make clean        - 중지 및 볼륨 삭제"
	@echo ""
	@echo "현재 환경 확인:"
	@echo "  make current-env  - 현재 .env 파일 환경 확인"

# 환경 전환
env-local:
	@bash scripts/switch-env.sh local

env-ecs:
	@bash scripts/switch-env.sh ecs

env-eks:
	@bash scripts/switch-env.sh eks

# Docker Compose 시작 (환경별)
start-local: env-local
	@bash scripts/docker-start.sh

start-ecs: env-ecs
	@bash scripts/docker-start.sh

start-eks: env-eks
	@bash scripts/docker-start.sh

# 빠른 시작 (자동 감지)
start:
	@bash scripts/docker-start.sh

# 중지
stop:
	@docker-compose down

# 로그
logs:
	@docker-compose logs -f

logs-api:
	@docker-compose logs -f main-api

logs-ai:
	@docker-compose logs -f summarize-ai bias-analysis-ai

logs-crawler:
	@docker-compose logs -f unified-crawler

# 정리
clean:
	@docker-compose down -v
	@echo "✅ 모든 컨테이너 및 볼륨 삭제 완료"

# 현재 환경 확인
current-env:
	@echo "현재 .env 파일 상태:"
	@if [ -f .env.local ] && diff -q .env .env.local > /dev/null 2>&1; then \
		echo "  🟢 LOCAL 환경"; \
	elif [ -f .env.ecs ] && diff -q .env .env.ecs > /dev/null 2>&1; then \
		echo "  🔵 ECS 환경"; \
	elif [ -f .env.eks ] && diff -q .env .env.eks > /dev/null 2>&1; then \
		echo "  🟣 EKS 환경"; \
	else \
		echo "  ⚠️  알 수 없음 (커스텀 .env)"; \
	fi

# 개발용 - 전체 재시작
restart: stop start

# 빌드 (이미지 재빌드)
build-local:
	@DEPLOY_ENV=local docker-compose build

build-ecs:
	@DEPLOY_ENV=ecs docker-compose build

build-eks:
	@DEPLOY_ENV=eks docker-compose build
