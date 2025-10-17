"""
⚠️ 이 파일은 더 이상 사용되지 않습니다 ⚠️

Spark ML API → Simple Classifier API(backend/simple-classifier)로 대체됨

실제로 이 API도 Spark ML을 사용하지 않고 있었습니다 (286줄 참조).
원본 카테고리를 그대로 사용하는 방식이었으므로,
Spark 의존성만 제거한 경량 버전으로 대체했습니다.

아래 코드는 참고용으로 주석 처리되었습니다.
필요 시 복구 가능하도록 코드를 삭제하지 않았습니다.
"""

'''
# ===== 아래 코드는 주석 처리됨 (Spark 대체) =====

"""
Spark ML 카테고리 분류 API 서비스
크롤러가 호출할 수 있는 REST API 제공
"""

from flask import Flask, request, jsonify
from pyspark.sql import SparkSession
from category_classifier import CategoryClassifier
import logging
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Spark 세션 전역 변수
spark = None
classifier = None

def init_spark():
    """Spark 세션 초기화"""
    global spark, classifier

    if spark is None:
        logger.info("🚀 Spark 세션 초기화 중...")
        # Use local mode to avoid distributed filesystem issues
        spark = SparkSession.builder \
            .appName("CategoryClassificationAPI") \
            .master("local[*]") \
            .config("spark.driver.memory", "2g") \
            .config("spark.sql.shuffle.partitions", "4") \
            .getOrCreate()

        logger.info("✅ Spark 세션 생성 완료")

        # 분류기 초기화
        classifier = CategoryClassifier(spark)

        # 모델 로드 또는 학습
        if not classifier.load_model():
            logger.info("🎓 모델이 없어서 학습합니다...")
            classifier.train_model()
        else:
            logger.info("✅ 모델 로드 완료")

@app.route('/health', methods=['GET'])
def health_check():
    """헬스 체크"""
    return jsonify({
        'status': 'healthy',
        'service': 'Spark ML Classification API',
        'spark_active': spark is not None
    })

@app.route('/classify', methods=['POST'])
def classify_news():
    """
    뉴스 카테고리 분류

    Request Body:
    {
        "title": "기사 제목",
        "content": "기사 본문"
    }

    Response:
    {
        "category_name": "경제",
        "category_id": 2,
        "confidence": 0.85
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        title = data.get('title', '')
        content = data.get('content', '')

        if not title and not content:
            return jsonify({'error': 'Title or content required'}), 400

        logger.info(f"📰 분류 요청: {title[:50]}...")

        # 분류 수행
        category_name, category_id, confidence = classifier.predict(title, content)

        logger.info(f"✅ 분류 완료: {category_name} (신뢰도: {confidence:.2f})")

        return jsonify({
            'category_name': category_name,
            'category_id': category_id,
            'confidence': confidence,
            'success': True
        })

    except Exception as e:
        logger.error(f"❌ 분류 실패: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/batch-classify', methods=['POST'])
def batch_classify():
    """
    여러 뉴스 동시 분류

    Request Body:
    {
        "articles": [
            {"title": "제목1", "content": "본문1"},
            {"title": "제목2", "content": "본문2"}
        ]
    }
    """
    try:
        data = request.get_json()
        articles = data.get('articles', [])

        if not articles:
            return jsonify({'error': 'No articles provided'}), 400

        logger.info(f"📚 배치 분류 요청: {len(articles)}개 기사")

        results = []
        for article in articles:
            title = article.get('title', '')
            content = article.get('content', '')

            try:
                category_name, category_id, confidence = classifier.predict(title, content)
                results.append({
                    'category_name': category_name,
                    'category_id': category_id,
                    'confidence': confidence,
                    'success': True
                })
            except Exception as e:
                logger.error(f"❌ 기사 분류 실패: {e}")
                results.append({
                    'error': str(e),
                    'success': False
                })

        logger.info(f"✅ 배치 분류 완료: {len(results)}개")

        return jsonify({
            'results': results,
            'total': len(results),
            'success': True
        })

    except Exception as e:
        logger.error(f"❌ 배치 분류 실패: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/retrain', methods=['POST'])
def retrain_model():
    """모델 재학습"""
    try:
        logger.info("🎓 모델 재학습 시작...")
        classifier.train_model()
        logger.info("✅ 모델 재학습 완료")

        return jsonify({
            'message': 'Model retrained successfully',
            'success': True
        })
    except Exception as e:
        logger.error(f"❌ 재학습 실패: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

def get_db_connection():
    """PostgreSQL 데이터베이스 연결"""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'postgres'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('POSTGRES_USER', 'fans_user'),
        password=os.getenv('POSTGRES_PASSWORD', 'fans_password'),
        database=os.getenv('POSTGRES_DB', 'fans_db')
    )

# 언론사 매핑
SOURCE_MAP = {
    '연합뉴스': 1, '동아일보': 20, '문화일보': 21,
    '세계일보': 22, '조선일보': 23, '중앙일보': 25,
    '한겨레': 28, '경향신문': 32, '한국일보': 55,
    '매일경제': 56, '한국경제': 214, '머니투데이': 421,
    'YTN': 437, 'JTBC': 448,
    '기타': 449
}

def classify_source(original_source):
    """언론사 텍스트를 source_id로 매핑"""
    if not original_source:
        return 449  # 기타

    # 완전 일치 검색
    if original_source in SOURCE_MAP:
        return SOURCE_MAP[original_source]

    # 부분 일치 검색
    for source_name, source_id in SOURCE_MAP.items():
        if source_name in original_source or original_source in source_name:
            return source_id

    return 449  # 기타

@app.route('/process-raw-news', methods=['POST'])
def process_raw_news():
    """
    raw_news_articles에서 미처리 기사를 읽어서 분류하고 news_articles로 이동

    Request Body (선택적):
    {
        "limit": 100  # 한 번에 처리할 기사 수 (기본값: 50)
    }
    """
    try:
        data = request.get_json() or {}
        limit = data.get('limit', 50)

        logger.info(f"🔄 원본 기사 처리 시작 (최대 {limit}개)...")

        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # 미처리 raw 기사 조회
        cursor.execute("""
            SELECT id, title, content, url, image_url, journalist, pub_date,
                   original_source, original_category
            FROM raw_news_articles
            WHERE processed = FALSE
            ORDER BY created_at ASC
            LIMIT %s
        """, (limit,))

        raw_articles = cursor.fetchall()

        if not raw_articles:
            logger.info("✅ 처리할 원본 기사가 없습니다")
            cursor.close()
            conn.close()
            return jsonify({
                'message': 'No raw articles to process',
                'processed': 0,
                'success': True
            })

        logger.info(f"📚 {len(raw_articles)}개 원본 기사 처리 중...")

        processed_count = 0
        failed_count = 0

        # 카테고리 ID 매핑
        category_map = {
            '정치': 1,
            '경제': 2,
            '사회': 3,
            '생활/문화': 4,
            'IT/과학': 5,
            '세계': 6,
            '스포츠': 7,
            '연예': 8
        }

        for raw_article in raw_articles:
            try:
                # Spark ML 사용 안함! 기사 페이지에서 파싱한 원본 카테고리 사용
                original_category = raw_article['original_category'] or '사회'
                category_id = category_map.get(original_category, 3)  # 기본값: 사회(3)

                # 언론사 분류
                source_id = classify_source(raw_article['original_source'])

                logger.info(f"✅ 카테고리 확정: {raw_article['title'][:50]}... -> {original_category} (언론사: {source_id})")

                # news_articles에 삽입
                cursor.execute("""
                    INSERT INTO news_articles
                    (title, content, url, image_url, journalist, pub_date, source_id, category_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (url) DO NOTHING
                """, (
                    raw_article['title'],
                    raw_article['content'],
                    raw_article['url'],
                    raw_article['image_url'],
                    raw_article['journalist'],
                    raw_article['pub_date'],
                    source_id,
                    category_id
                ))

                # raw_news_articles 상태 업데이트
                cursor.execute("""
                    UPDATE raw_news_articles
                    SET processed = TRUE, processed_at = %s
                    WHERE id = %s
                """, (datetime.now(), raw_article['id']))

                processed_count += 1

            except Exception as e:
                logger.error(f"❌ 기사 처리 실패 (ID: {raw_article['id']}): {e}")

                # 에러 기록
                cursor.execute("""
                    UPDATE raw_news_articles
                    SET processing_error = %s
                    WHERE id = %s
                """, (str(e), raw_article['id']))

                failed_count += 1

        conn.commit()
        cursor.close()
        conn.close()

        logger.info(f"✅ 처리 완료: {processed_count}개 성공, {failed_count}개 실패")

        return jsonify({
            'message': f'Processed {processed_count} articles successfully',
            'processed': processed_count,
            'failed': failed_count,
            'total': len(raw_articles),
            'success': True
        })

    except Exception as e:
        logger.error(f"❌ 원본 기사 처리 실패: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

if __name__ == '__main__':
    # Spark 초기화
    init_spark()

    # Flask 서버 시작
    port = int(os.getenv('CLASSIFICATION_API_PORT', 5000))
    logger.info(f"🌐 Classification API 서버 시작: 포트 {port}")
    app.run(host='0.0.0.0', port=port, debug=False)

# ===== 주석 처리 끝 =====
'''
