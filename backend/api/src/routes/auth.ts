// routes/auth.ts
import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { AuthService } from '../services/authService';
import { 
  RegisterDto, 
  LoginDto, 
  PasswordResetRequestDto, 
  PasswordResetDto,
  DeleteAccountDto
} from '../dto/auth.dto';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const authService = new AuthService();

// ===== multer 설정 =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const okExt = allowed.test(path.extname(file.originalname).toLowerCase());
    const okMime = allowed.test(file.mimetype);
    if (okExt && okMime) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다.'));
  }
});

// ===== 유틸: 환경변수 점검 =====
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name}가 설정되지 않았습니다.`);
  return v;
}

// ===== 회원가입/로그인 =====
router.post('/register', async (req: Request, res: Response) => {
  try {
    const dto = Object.assign(new RegisterDto(), req.body);
    const errors = await validate(dto);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다.',
        details: errors.map(e => ({
          field: e.property,
          message: Object.values(e.constraints || {})[0]
        }))
      });
    }
    const result = await authService.register(dto);
    res.status(201).json({
      success: true,
      message: result.message,
      data: { user: result.user }
    });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || '회원가입 실패' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const dto = Object.assign(new LoginDto(), req.body);
    const errors = await validate(dto);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: '입력 데이터 오류' });
    }
    const result = await authService.login(dto);

    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    req.session.isAuthenticated = true;

    res.json({
      success: true,
      message: result.message,
      data: { user: result.user, token: result.token }
    });
  } catch (e: any) {
    res.status(401).json({ success: false, error: e.message || '로그인 실패' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false, error: '로그아웃 실패' });
    res.clearCookie('connect.sid');
    res.json({ success: true, message: '로그아웃 완료' });
  });
});

// ===== 비밀번호 재설정 =====
router.post('/request-password-reset', async (req, res) => {
  try {
    const dto = Object.assign(new PasswordResetRequestDto(), req.body);
    const errors = await validate(dto);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: '이메일 오류' });
    }
    const result = await authService.requestPasswordReset(dto.email);
    res.json({ success: true, message: result.message });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || '요청 실패' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const dto = Object.assign(new PasswordResetDto(), req.body);
    const errors = await validate(dto);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: '입력 오류' });
    }
    const result = await authService.resetPassword(dto);
    res.json({ success: true, message: result.message });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || '실패' });
  }
});

// ===== 소셜 로그인 =====
// ✅ 카카오 로그인 시작 → 바로 카카오로 redirect
router.get('/kakao', async (req, res) => {
  try {
    // 환경 변수 점검 (여기서 에러 나면 바로 알려줌)
    requireEnv('KAKAO_CLIENT_ID');
    requireEnv('KAKAO_REDIRECT_URI');

    const authUrl = await authService.startKakaoLogin(req.session);
    return res.redirect(authUrl);
  } catch (e: any) {
    console.error('카카오 로그인 시작 에러:', e);
    return res.status(500).send(`Kakao start error: ${e.message || e}`);
  }
});

router.get('/kakao/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing code/state');

    const result = await authService.handleKakaoCallback(req.session, code as string, state as string);

    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    req.session.isAuthenticated = true;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    // ✅ token을 URL에 안전하게 실어 보냄
    res.redirect(`${frontendUrl}/login-success?token=${encodeURIComponent(result.token)}`);
  } catch (e: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login-error?error=${encodeURIComponent(e.message || 'login failed')}`);
  }
});

// ✅ 네이버 로그인 시작 → 바로 네이버로 redirect
router.get('/naver', async (req, res) => {
  try {
    const authUrl = await authService.startNaverLogin(req.session);
    return res.redirect(authUrl);
  } catch (e: any) {
    console.error('네이버 로그인 시작 에러:', e);
    return res.status(500).send(`Naver start error: ${e.message || e}`);
  }
});

router.get('/naver/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send('Missing code');

    const result = await authService.handleNaverCallback(
      req.session,
      code as string,
      (state as string) || ''
    );

    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    req.session.isAuthenticated = true;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${frontendUrl}/login-success?token=${encodeURIComponent(result.token)}`);
  } catch (e: any) {
    console.error('네이버 콜백 에러:', e);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${frontendUrl}/login-error?error=${encodeURIComponent(e.message || 'callback error')}`);
  }
});

// ===== 프로필 관리 =====
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await authService.getUserProfile(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          phone: user.phone,
          profile_image: user.profile_image,
          age: user.age,
          gender: user.gender,
          location: user.location,
          preferred_categories: user.preferred_categories,
          preferred_media_sources: user.preferred_media_sources,
          email_verified: user.email_verified,
          provider: user.provider,
          provider_id: user.provider_id,
          created_at: user.created_at,
          last_login: user.last_login
        }
      }
    });
  } catch (error) {
    console.error('프로필 조회 에러:', error);
    res.status(500).json({ success: false, error: '프로필 조회 중 오류가 발생했습니다.' });
  }
});

router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const updateData = req.body;
    const user = await authService.updateUserProfile(userId, updateData);

    res.json({
      success: true,
      message: '프로필이 성공적으로 업데이트되었습니다.',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          phone: user.phone,
          profile_image: user.profile_image,
          age: user.age,
          gender: user.gender,
          location: user.location,
          preferred_categories: user.preferred_categories,
          preferred_media_sources: user.preferred_media_sources
        }
      }
    });
  } catch (error) {
    console.error('프로필 업데이트 에러:', error);
    res.status(400).json({ success: false, error: error.message || '프로필 업데이트 중 오류가 발생했습니다.' });
  }
});

// ===== 프로필 이미지 =====
router.post('/upload-profile-image', authenticateToken, upload.single('profileImage'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    if (!req.file) return res.status(400).json({ success: false, error: '이미지 필요' });

    const relativePath = `/uploads/profiles/${req.file.filename}`;
    const user = await authService.updateUserProfile(userId, { profile_image: relativePath });

    res.json({ success: true, data: { profile_image: relativePath, user } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || '업로드 실패' });
  }
});

router.delete('/delete-profile-image', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const user = await authService.getUserProfile(userId);

    if (user?.profile_image) {
      const imagePath = path.join(__dirname, '../../', user.profile_image);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await authService.updateUserProfile(userId, { profile_image: null });
    res.json({ success: true, message: '프로필 이미지 삭제 완료' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message || '삭제 실패' });
  }
});

// 회원탈퇴
router.delete('/delete-account', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const dto = Object.assign(new DeleteAccountDto(), req.body);
    
    const errors = await validate(dto);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다.',
        details: errors.map(e => ({
          field: e.property,
          message: Object.values(e.constraints || {})[0]
        }))
      });
    }

    const result = await authService.deleteAccount(userId, dto);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('회원탈퇴 에러:', error);
    res.status(400).json({
      success: false,
      error: error.message || '회원탈퇴 중 오류가 발생했습니다.'
    });
  }
});

export default router;
