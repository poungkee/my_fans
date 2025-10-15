"""
뉴스 분류 파이프라인 DAG
Kafka -> Spark ML 분류 -> DB 저장
"""

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta
import sys
import os

# Spark 경로 추가
sys.path.insert(0, '/opt/airflow/recommendation')

default_args = {
    'owner': 'fans',
    'depends_on_past': False,
    'start_date': datetime(2025, 10, 14),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'news_classification_pipeline',
    default_args=default_args,
    description='뉴스 카테고리 분류 파이프라인',
    schedule_interval='*/10 * * * *',  # 10분마다 실행
    catchup=False,
    tags=['news', 'classification', 'spark'],
)

def train_classification_model():
    """Spark ML 모델 학습"""
    from pyspark.sql import SparkSession
    from category_classifier import CategoryClassifier

    print("🚀 Spark 세션 시작...")
    spark = SparkSession.builder \
        .appName("CategoryClassifierTraining") \
        .master("spark://spark-master:7077") \
        .config("spark.executor.memory", "1g") \
        .getOrCreate()

    try:
        print("🎓 모델 학습 시작...")
        classifier = CategoryClassifier(spark)
        classifier.train_model()
        print("✅ 모델 학습 완료!")
        return "success"
    except Exception as e:
        print(f"❌ 학습 실패: {e}")
        raise
    finally:
        spark.stop()

def classify_news_from_kafka():
    """Kafka에서 뉴스 읽어서 분류"""
    from pyspark.sql import SparkSession
    from pyspark.sql.functions import from_json, col
    from pyspark.sql.types import StructType, StructField, StringType, IntegerType
    from category_classifier import CategoryClassifier
    import psycopg2

    print("🚀 Spark Streaming 시작...")
    spark = SparkSession.builder \
        .appName("NewsClassification") \
        .master("spark://spark-master:7077") \
        .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0") \
        .config("spark.executor.memory", "1g") \
        .getOrCreate()

    try:
        # Kafka에서 읽기
        schema = StructType([
            StructField("id", IntegerType(), True),
            StructField("title", StringType(), True),
            StructField("content", StringType(), True),
            StructField("url", StringType(), True)
        ])

        df = spark \
            .read \
            .format("kafka") \
            .option("kafka.bootstrap.servers", "kafka:29092") \
            .option("subscribe", "news-raw") \
            .option("startingOffsets", "earliest") \
            .load()

        # JSON 파싱
        news_df = df.select(
            from_json(col("value").cast("string"), schema).alias("data")
        ).select("data.*")

        if news_df.count() == 0:
            print("📭 처리할 뉴스가 없습니다.")
            return "no_data"

        print(f"📰 {news_df.count()}개 뉴스 처리 중...")

        # 분류기 로드
        classifier = CategoryClassifier(spark)
        if not classifier.load_model():
            print("🎓 모델이 없어서 학습합니다...")
            classifier.train_model()

        # DB 연결
        conn = psycopg2.connect(
            host="postgres",
            database=os.getenv("POSTGRES_DB", "fans_db"),
            user=os.getenv("POSTGRES_USER", "fans_user"),
            password=os.getenv("POSTGRES_PASSWORD", "fans_password")
        )
        cursor = conn.cursor()

        # 각 뉴스 분류
        news_list = news_df.collect()
        classified_count = 0

        for news in news_list:
            try:
                # 분류
                category_name, category_id, confidence = classifier.predict(
                    news.title,
                    news.content
                )

                # DB 업데이트
                cursor.execute("""
                    UPDATE news_articles
                    SET category_id = %s
                    WHERE id = %s
                """, (category_id, news.id))

                classified_count += 1
                print(f"✅ ID {news.id}: {category_name} (신뢰도: {confidence:.2f})")

            except Exception as e:
                print(f"❌ ID {news.id} 분류 실패: {e}")
                continue

        conn.commit()
        cursor.close()
        conn.close()

        print(f"🎉 {classified_count}/{len(news_list)}개 뉴스 분류 완료!")
        return f"classified_{classified_count}"

    except Exception as e:
        print(f"❌ 처리 실패: {e}")
        raise
    finally:
        spark.stop()

# Task 정의
train_model_task = PythonOperator(
    task_id='train_classification_model',
    python_callable=train_classification_model,
    dag=dag,
)

classify_task = PythonOperator(
    task_id='classify_news',
    python_callable=classify_news_from_kafka,
    dag=dag,
)

# Task 순서
train_model_task >> classify_task
