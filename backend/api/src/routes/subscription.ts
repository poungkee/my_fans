import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { UserPreference } from '../entities/UserPreference';
import { Source } from '../entities/Source';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

// 사용자의 구독 목록 조회
router.get('/subscriptions', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
        const userId = req.user.userId;

        const userPreference = await AppDataSource.getRepository(UserPreference)
            .findOne({ where: { userId } });

        if (!userPreference || !userPreference.preferredSources) {
            return res.json({ ok: true, subscriptions: [] });
        }

        // preferredSources에서 구독된 source ID들 추출
        const subscribedSourceIds = userPreference.preferredSources as number[];

        if (!Array.isArray(subscribedSourceIds) || subscribedSourceIds.length === 0) {
            return res.json({ ok: true, subscriptions: [] });
        }

        // 구독된 언론사 정보 가져오기
        const sources = await AppDataSource.getRepository(Source)
            .findByIds(subscribedSourceIds);

        res.json({
            ok: true,
            subscriptions: sources.map(source => ({
                id: source.id,
                name: source.name,
                url: source.url,
                logoUrl: source.logoUrl
            }))
        });

    } catch (error) {
        console.error('구독 목록 조회 실패:', error);
        res.status(500).json({ ok: false, error: '구독 목록 조회에 실패했습니다.' });
    }
});

// 언론사 구독하기
router.post('/subscribe', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
        const userId = req.user.userId;
        const { sourceName } = req.body;

        if (!sourceName) {
            return res.status(400).json({ ok: false, error: '언론사 이름이 필요합니다.' });
        }

        // 언론사 찾기
        const source = await AppDataSource.getRepository(Source)
            .findOne({ where: { name: sourceName } });

        if (!source) {
            return res.status(404).json({ ok: false, error: '언론사를 찾을 수 없습니다.' });
        }

        // 기존 사용자 선호도 가져오기 또는 생성
        let userPreference = await AppDataSource.getRepository(UserPreference)
            .findOne({ where: { userId } });

        if (!userPreference) {
            userPreference = new UserPreference();
            userPreference.userId = userId;
            userPreference.preferredSources = [];
        }

        // 현재 구독 목록 가져오기
        let subscribedSources = userPreference.preferredSources as number[] || [];

        // 이미 구독된 경우 체크
        if (subscribedSources.includes(source.id)) {
            return res.json({ ok: true, message: '이미 구독 중인 언론사입니다.' });
        }

        // 구독 추가
        subscribedSources.push(source.id);
        userPreference.preferredSources = subscribedSources;

        await AppDataSource.getRepository(UserPreference).save(userPreference);

        res.json({
            ok: true,
            message: `${sourceName} 구독이 완료되었습니다.`,
            source: {
                id: source.id,
                name: source.name,
                url: source.url,
                logoUrl: source.logoUrl
            }
        });

    } catch (error) {
        console.error('구독 추가 실패:', error);
        res.status(500).json({ ok: false, error: '구독에 실패했습니다.' });
    }
});

// 언론사 구독 취소하기
router.delete('/unsubscribe', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
        const userId = req.user.userId;
        const { sourceName } = req.body;

        if (!sourceName) {
            return res.status(400).json({ ok: false, error: '언론사 이름이 필요합니다.' });
        }

        // 언론사 찾기
        const source = await AppDataSource.getRepository(Source)
            .findOne({ where: { name: sourceName } });

        if (!source) {
            return res.status(404).json({ ok: false, error: '언론사를 찾을 수 없습니다.' });
        }

        // 사용자 선호도 가져오기
        const userPreference = await AppDataSource.getRepository(UserPreference)
            .findOne({ where: { userId } });

        if (!userPreference || !userPreference.preferredSources) {
            return res.status(404).json({ ok: false, error: '구독 정보를 찾을 수 없습니다.' });
        }

        // 현재 구독 목록에서 제거
        let subscribedSources = userPreference.preferredSources as number[] || [];
        subscribedSources = subscribedSources.filter(id => id !== source.id);

        userPreference.preferredSources = subscribedSources;

        await AppDataSource.getRepository(UserPreference).save(userPreference);

        res.json({
            ok: true,
            message: `${sourceName} 구독이 취소되었습니다.`
        });

    } catch (error) {
        console.error('구독 취소 실패:', error);
        res.status(500).json({ ok: false, error: '구독 취소에 실패했습니다.' });
    }
});

// 구독 상태 확인
router.get('/status/:sourceName', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
        const userId = req.user.userId;
        const { sourceName } = req.params;

        // 언론사 찾기
        const source = await AppDataSource.getRepository(Source)
            .findOne({ where: { name: sourceName } });

        if (!source) {
            return res.status(404).json({ ok: false, error: '언론사를 찾을 수 없습니다.' });
        }

        // 사용자 선호도 확인
        const userPreference = await AppDataSource.getRepository(UserPreference)
            .findOne({ where: { userId } });

        let isSubscribed = false;

        if (userPreference && userPreference.preferredSources) {
            const subscribedSources = userPreference.preferredSources as number[] || [];
            isSubscribed = subscribedSources.includes(source.id);
        }

        res.json({
            ok: true,
            isSubscribed,
            source: {
                id: source.id,
                name: source.name
            }
        });

    } catch (error) {
        console.error('구독 상태 확인 실패:', error);
        res.status(500).json({ ok: false, error: '구독 상태 확인에 실패했습니다.' });
    }
});

export default router;