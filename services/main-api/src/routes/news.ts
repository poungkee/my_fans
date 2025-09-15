import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { NewsArticle } from '../entities/NewsArticle';
import { MediaSource } from '../entities/MediaSource';
import { Category } from '../entities/Category';
import { Journalist } from '../entities/Journalist';
import { aiService } from '../services/aiService';

const router = Router();

router.get('/news', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, source, search } = req.query;
    const repository = AppDataSource.getRepository(NewsArticle);

    let queryBuilder = repository.createQueryBuilder('news')
      .leftJoinAndSelect('news.media_source', 'media_source')
      .leftJoinAndSelect('news.category', 'category')
      .leftJoinAndSelect('news.journalist', 'journalist')
      .orderBy('news.pub_date', 'DESC');

    if (category) {
      queryBuilder = queryBuilder.andWhere('category.name = :category', { category });
    }

    if (source) {
      queryBuilder = queryBuilder.andWhere('media_source.name = :source', { source });
    }

    if (search) {
      queryBuilder = queryBuilder.andWhere(
        '(news.title ILIKE :search OR news.content ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const skip = (Number(page) - 1) * Number(limit);
    queryBuilder = queryBuilder.skip(skip).take(Number(limit));

    const [articles, total] = await queryBuilder.getManyAndCount();

    res.json({
      articles,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('News List Error:', error);
    res.status(500).json({ error: '뉴스 목록 조회 중 오류가 발생했습니다' });
  }
});

router.get('/news/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const repository = AppDataSource.getRepository(NewsArticle);

    const article = await repository.findOne({
      where: { id: Number(id) },
      relations: ['media_source', 'category', 'journalist']
    });

    if (!article) {
      return res.status(404).json({ error: '뉴스 기사를 찾을 수 없습니다' });
    }

    res.json(article);
  } catch (error) {
    console.error('News Detail Error:', error);
    res.status(500).json({ error: '뉴스 상세 조회 중 오류가 발생했습니다' });
  }
});

router.post('/news', async (req, res) => {
  try {
    const { title, content, url, source, category, pub_date, journalist_name } = req.body;

    if (!title || !content || !url) {
      return res.status(400).json({ error: '제목, 내용, URL은 필수입니다' });
    }

    const repository = AppDataSource.getRepository(NewsArticle);
    const mediaSourceRepo = AppDataSource.getRepository(MediaSource);
    const categoryRepo = AppDataSource.getRepository(Category);
    const journalistRepo = AppDataSource.getRepository(Journalist);

    let mediaSource = null;
    if (source) {
      mediaSource = await mediaSourceRepo.findOne({ where: { name: source } });
      if (!mediaSource) {
        mediaSource = mediaSourceRepo.create({ name: source, url: '', description: '' });
        await mediaSourceRepo.save(mediaSource);
      }
    }

    let categoryEntity = null;
    if (category) {
      categoryEntity = await categoryRepo.findOne({ where: { name: category } });
      if (!categoryEntity) {
        categoryEntity = categoryRepo.create({ name: category, description: '' });
        await categoryRepo.save(categoryEntity);
      }
    }

    let journalist = null;
    if (journalist_name) {
      journalist = await journalistRepo.findOne({ where: { name: journalist_name } });
      if (!journalist) {
        journalist = journalistRepo.create({ name: journalist_name, email: '' });
        await journalistRepo.save(journalist);
      }
    }

    const article = repository.create({
      title,
      content,
      url,
      media_source: mediaSource,
      category: categoryEntity,
      journalist,
      pub_date: pub_date ? new Date(pub_date) : new Date()
    });

    const savedArticle = await repository.save(article);

    if (content.length >= 50) {
      try {
        const aiResult = await aiService.summarizeText(content);
        const shortSummary = aiResult.summary.length > 50
          ? aiResult.summary.substring(0, 47) + '...'
          : aiResult.summary;

        await repository.update(savedArticle.id, {
          ai_summary: aiResult.summary,
          short_ai_summary: shortSummary
        });

        const updatedArticle = await repository.findOne({
          where: { id: savedArticle.id },
          relations: ['media_source', 'category', 'journalist']
        });

        res.status(201).json({
          message: '뉴스가 성공적으로 생성되고 AI 요약이 완료되었습니다',
          article: updatedArticle
        });
      } catch (aiError) {
        console.error('AI Summarization Error:', aiError);
        res.status(201).json({
          message: '뉴스가 생성되었지만 AI 요약 중 오류가 발생했습니다',
          article: savedArticle
        });
      }
    } else {
      res.status(201).json({
        message: '뉴스가 성공적으로 생성되었습니다',
        article: savedArticle
      });
    }
  } catch (error) {
    console.error('News Creation Error:', error);
    res.status(500).json({ error: '뉴스 생성 중 오류가 발생했습니다' });
  }
});

router.put('/news/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, summary } = req.body;

    const repository = AppDataSource.getRepository(NewsArticle);

    const article = await repository.findOne({ where: { id: Number(id) } });
    if (!article) {
      return res.status(404).json({ error: '뉴스 기사를 찾을 수 없습니다' });
    }

    if (title) article.title = title;
    if (content) article.content = content;
    if (summary) article.summary = summary;

    const savedArticle = await repository.save(article);

    const updatedArticle = await repository.findOne({
      where: { id: Number(id) },
      relations: ['media_source', 'category', 'journalist']
    });

    res.json({
      message: '뉴스가 성공적으로 수정되었습니다',
      article: updatedArticle
    });
  } catch (error) {
    console.error('News Update Error:', error);
    res.status(500).json({ error: '뉴스 수정 중 오류가 발생했습니다' });
  }
});

router.delete('/news/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const repository = AppDataSource.getRepository(NewsArticle);

    const article = await repository.findOne({ where: { id: Number(id) } });
    if (!article) {
      return res.status(404).json({ error: '뉴스 기사를 찾을 수 없습니다' });
    }

    await repository.remove(article);

    res.json({ message: '뉴스가 성공적으로 삭제되었습니다' });
  } catch (error) {
    console.error('News Delete Error:', error);
    res.status(500).json({ error: '뉴스 삭제 중 오류가 발생했습니다' });
  }
});

export default router;