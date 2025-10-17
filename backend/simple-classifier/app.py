"""
간단한 뉴스 분류 API (Spark 대체)
Spark ML 없이 Flask로만 구현
"""

from flask import Flask, request, jsonify
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

@app.route('/health', methods=['GET'])
def health_check():
    """헬스 체크"""
    return jsonify({
        'status': 'healthy',
        'service': 'Simple Classification API (No Spark)',
    })

@app.route('/process-raw-news', methods=['POST'])
def process_raw_news():
    """
    raw_news_articles에서 미처리 기사를 읽어서 분류하고 news_articles로 이동

    ⚠️ Spark ML 사용 안함! 기사 페이지에서 파싱한 원본 카테고리 사용

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
                # ⚠️ Spark ML 사용 안함! 기사 페이지에서 파싱한 원본 카테고리 사용
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
    port = int(os.getenv('CLASSIFICATION_API_PORT', 5000))
    logger.info(f"🌐 Simple Classification API 서버 시작: 포트 {port}")
    logger.info("⚠️  Spark ML 사용 안함 - 원본 카테고리 그대로 사용")
    app.run(host='0.0.0.0', port=port, debug=False)
