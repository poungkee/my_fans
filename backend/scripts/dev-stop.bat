@echo off
echo 🛑 FANS 백엔드 개발환경 중지...

REM 개발환경 컨테이너 중지
docker-compose --profile dev down

echo.
echo ✅ 개발환경이 중지되었습니다!
echo.
echo 💡 데이터를 완전히 삭제하려면: docker-compose down -v
echo.
pause