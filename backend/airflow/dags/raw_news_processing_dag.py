"""
⚠️ 이 파일은 더 이상 사용되지 않습니다 ⚠️

Airflow → Node.js 스케줄러(backend/scheduler)로 대체됨
Spark ML → Simple Classifier API(backend/simple-classifier)로 대체됨

아래 코드는 참고용으로 주석 처리되었습니다.
필요 시 복구 가능하도록 코드를 삭제하지 않았습니다.
"""

'''
# ===== 아래 코드는 주석 처리됨 (Airflow 대체) =====

"""
원본 기사 처리 파이프라인 DAG
raw_news_articles -> Spark ML 분류 -> news_articles
"""

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.http.operators.http import SimpleHttpOperator
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

default_args = {
    'owner': 'fans',
    'depends_on_past': False,
    'start_date': datetime(2025, 10, 15),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=3),
}

dag = DAG(
    'raw_news_processing_pipeline',
    default_args=default_args,
    description='원본 기사를 Spark ML로 분류하여 검증된 기사로 변환',
    schedule_interval='*/10 * * * *',  # 10분마다 실행
    catchup=False,
    tags=['news', 'classification', 'spark', 'raw'],
)

def check_raw_articles():
    """처리할 원본 기사가 있는지 확인"""
    import psycopg2
    import os

    logger.info("🔍 처리 대기 중인 원본 기사 확인...")

    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'postgres'),
            port=int(os.getenv('DB_PORT', 5432)),
            user=os.getenv('POSTGRES_USER', 'fans_user'),
            password=os.getenv('POSTGRES_PASSWORD', 'fans_password'),
            database=os.getenv('POSTGRES_DB', 'fans_db')
        )
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM raw_news_articles WHERE processed = FALSE")
        count = cursor.fetchone()[0]

        cursor.close()
        conn.close()

        logger.info(f"📊 처리 대기 중인 원본 기사: {count}개")

        if count == 0:
            logger.info("✅ 처리할 기사가 없습니다")
            return "no_articles"
        else:
            logger.info(f"🔄 {count}개 기사 처리 시작...")
            return f"found_{count}_articles"

    except Exception as e:
        logger.error(f"❌ 확인 실패: {e}")
        raise

def process_articles():
    """Spark API를 호출하여 원본 기사 처리"""
    import requests
    import os

    logger.info("🚀 Spark 분류 API 호출...")

    try:
        response = requests.post(
            'http://classification-api:5000/process-raw-news',
            json={'limit': 100},
            timeout=300  # 5분 타임아웃
        )

        if response.status_code == 200:
            result = response.json()
            logger.info(f"✅ 처리 완료: {result}")
            return result
        else:
            logger.error(f"❌ API 호출 실패: {response.status_code} - {response.text}")
            raise Exception(f"API call failed with status {response.status_code}")

    except requests.exceptions.Timeout:
        logger.error("⏰ API 호출 타임아웃")
        raise
    except Exception as e:
        logger.error(f"❌ 처리 실패: {e}")
        raise

def summarize_articles():
    """처리된 기사의 AI 요약 생성"""
    import psycopg2
    import requests
    import os

    logger.info("📝 AI 요약 생성 시작...")

    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'postgres'),
            port=int(os.getenv('DB_PORT', 5432)),
            user=os.getenv('POSTGRES_USER', 'fans_user'),
            password=os.getenv('POSTGRES_PASSWORD', 'fans_password'),
            database=os.getenv('POSTGRES_DB', 'fans_db')
        )
        cursor = conn.cursor()

        # AI 요약이 없는 기사 조회 (최근 처리된 것만)
        cursor.execute("""
            SELECT id, content
            FROM news_articles
            WHERE ai_summary IS NULL
              AND content IS NOT NULL
              AND LENGTH(content) >= 100
            ORDER BY created_at DESC
            LIMIT 50
        """)

        articles = cursor.fetchall()

        if not articles:
            logger.info("✅ 요약할 기사가 없습니다")
            cursor.close()
            conn.close()
            return "no_articles_to_summarize"

        logger.info(f"📚 {len(articles)}개 기사 요약 생성 중...")

        summarized_count = 0

        for article_id, content in articles:
            try:
                # AI 요약 API 호출
                response = requests.post(
                    'http://summarize-ai:8000/api/summarize',
                    json={'content': content},
                    timeout=10
                )

                if response.status_code == 200:
                    summary = response.json().get('summary', '')

                    # DB 업데이트
                    cursor.execute("""
                        UPDATE news_articles
                        SET ai_summary = %s
                        WHERE id = %s
                    """, (summary, article_id))

                    summarized_count += 1

            except Exception as e:
                logger.error(f"❌ 기사 ID {article_id} 요약 실패: {e}")
                continue

        conn.commit()
        cursor.close()
        conn.close()

        logger.info(f"✅ 요약 완료: {summarized_count}/{len(articles)}개")
        return f"summarized_{summarized_count}"

    except Exception as e:
        logger.error(f"❌ 요약 실패: {e}")
        raise

# Task 정의
check_task = PythonOperator(
    task_id='check_raw_articles',
    python_callable=check_raw_articles,
    dag=dag,
)

process_task = PythonOperator(
    task_id='process_raw_articles',
    python_callable=process_articles,
    dag=dag,
)

summarize_task = PythonOperator(
    task_id='summarize_articles',
    python_callable=summarize_articles,
    dag=dag,
)

# Task 순서: 확인 -> 처리 -> 요약
check_task >> process_task >> summarize_task

# ===== 주석 처리 끝 =====
'''
