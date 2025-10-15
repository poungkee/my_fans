import { AppDataSource } from '../config/database';
import logger from '../config/logger';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://summarize-ai:8000';

interface Article {
  id: number;
  title: string;
  content: string;
  category_id: number | null;
}

interface CategoryMap {
  [key: string]: number;
}

async function getCategoryId(categoryName: string, categoryMap: CategoryMap): Promise<number> {
  if (categoryMap[categoryName]) {
    return categoryMap[categoryName];
  }

  // 카테고리가 없으면 생성
  const result = await AppDataSource.query(
    `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id`,
    [categoryName]
  );

  categoryMap[categoryName] = result[0].id;
  return result[0].id;
}

async function classifyArticle(title: string, content: string): Promise<string> {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/ai/classify-category`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        content: content?.substring(0, 500) || '' // 처음 500자만 사용
      })
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.category || '기타';
  } catch (error) {
    logger.error('AI classification failed:', error);
    return '기타';
  }
}

async function reclassifyAllArticles() {
  try {
    logger.info('🔄 Starting article reclassification...');

    // 데이터베이스 연결
    await AppDataSource.initialize();
    logger.info('✅ Database connected');

    // 카테고리 맵 생성
    const categories = await AppDataSource.query(`SELECT id, name FROM categories`);
    const categoryMap: CategoryMap = {};
    categories.forEach((cat: any) => {
      categoryMap[cat.name] = cat.id;
    });

    // 모든 기사 가져오기
    const articles: Article[] = await AppDataSource.query(
      `SELECT id, title, content, category_id FROM news_articles ORDER BY id`
    );

    logger.info(`📊 Found ${articles.length} articles to reclassify`);

    let successCount = 0;
    let failCount = 0;
    let unchangedCount = 0;

    // 배치 처리 (한 번에 10개씩)
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      try {
        // AI로 카테고리 분류
        const newCategoryName = await classifyArticle(article.title, article.content || '');
        const newCategoryId = await getCategoryId(newCategoryName, categoryMap);

        // 카테고리가 변경된 경우에만 업데이트
        if (article.category_id !== newCategoryId) {
          await AppDataSource.query(
            `UPDATE news_articles SET category_id = $1 WHERE id = $2`,
            [newCategoryId, article.id]
          );

          logger.info(`✅ [${i + 1}/${articles.length}] Article ${article.id}: ${newCategoryName}`);
          successCount++;
        } else {
          unchangedCount++;
        }

        // API 과부하 방지를 위한 딜레이
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          logger.info(`⏸️  Progress: ${i}/${articles.length} processed...`);
        }

      } catch (error) {
        logger.error(`❌ Failed to classify article ${article.id}:`, error);
        failCount++;
      }
    }

    logger.info('🎉 Reclassification completed!');
    logger.info(`✅ Success: ${successCount}`);
    logger.info(`📌 Unchanged: ${unchangedCount}`);
    logger.info(`❌ Failed: ${failCount}`);

    // 카테고리별 통계
    const stats = await AppDataSource.query(
      `SELECT c.name, COUNT(*) as count
       FROM news_articles na
       LEFT JOIN categories c ON na.category_id = c.id
       GROUP BY c.name
       ORDER BY count DESC`
    );

    logger.info('📊 Category distribution:');
    stats.forEach((stat: any) => {
      logger.info(`   ${stat.name}: ${stat.count}`);
    });

    process.exit(0);

  } catch (error) {
    logger.error('❌ Reclassification failed:', error);
    process.exit(1);
  }
}

// 스크립트 실행
reclassifyAllArticles();
