"""
데이터베이스 연결 모듈
PostgreSQL 연결 및 쿼리 실행
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
import logging
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.connection_params = {
            'host': os.getenv('DB_HOST', 'postgres'),
            'port': int(os.getenv('DB_PORT', '5432')),
            'database': os.getenv('DB_NAME', 'fans_db'),
            'user': os.getenv('DB_USERNAME', 'fans_user'),
            'password': os.getenv('DB_PASSWORD', 'fans_password'),
        }
        logger.info(f"Database configured: {self.connection_params['host']}:{self.connection_params['port']}")

    @contextmanager
    def get_connection(self):
        """데이터베이스 연결 Context Manager"""
        conn = None
        try:
            conn = psycopg2.connect(**self.connection_params)
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()

    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """쿼리 실행 및 결과 반환"""
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params or ())
                try:
                    result = cursor.fetchall()
                    return [dict(row) for row in result]
                except psycopg2.ProgrammingError:
                    # INSERT, UPDATE, DELETE 등 결과가 없는 경우
                    return []

    def execute_one(self, query: str, params: Optional[tuple] = None) -> Optional[Dict[str, Any]]:
        """단일 row 조회"""
        result = self.execute_query(query, params)
        return result[0] if result else None

# 싱글톤 인스턴스
db = Database()
