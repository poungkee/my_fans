# app/database.py
import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# 데이터베이스 설정
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://fans_user:fans_password@localhost:5432/fans_db"
)

# SQLAlchemy 엔진 생성
engine = create_engine(
    DATABASE_URL,
    # 연결 풀 설정
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,  # 30분마다 연결 재생성
    echo=True if os.getenv("DEBUG", "0") == "1" else False  # SQL 로그
)

# 세션 팩토리
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base 클래스
Base = declarative_base()

# 데이터베이스 연결 확인
def check_database_connection():
    """데이터베이스 연결 상태 확인"""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            return True
    except Exception as e:
        print(f"[DB] 연결 실패: {e}")
        return False

# 의존성 함수 (FastAPI용)
def get_db():
    """데이터베이스 세션 의존성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()