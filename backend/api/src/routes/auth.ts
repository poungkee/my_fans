import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { AuthService } from '../services/authService';
import { SocialAuthService } from '../services/socialAuthService';
import { 
  RegisterDto, 
  LoginDto, 
  EmailVerificationDto, 
  VerifyCodeDto, 
  PasswordResetRequestDto, 
  PasswordResetDto,
  SocialLoginDto
} from '../dto/auth.dto';

const router = Router();
const authService = new AuthService();
const socialAuthService = new SocialAuthService();

// 회원가입
router.post('/register', async (req: Request, res: Response) => {
  try {
    const registerDto = new RegisterDto();
    Object.assign(registerDto, req.body);

    // 유효성 검사
    const errors = await validate(registerDto);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다.',
        details: errors.map(error => ({
          field: error.property,
          message: Object.values(error.constraints || {})[0]
        }))
      });
    }

    const result = await authService.register(registerDto);
    
    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          name: result.user.name,
          email_verified: result.user.email_verified
        }
      }
    });
  } catch (error) {
    console.error('회원가입 에러:', error);
    res.status(400).json({
      success: false,
      error: error.message || '회원가입 중 오류가 발생했습니다.'
    });
  }
});

// 로그인
router.post('/login', async (req: Request, res: Response) => {
  try {
    const loginDto = new LoginDto();
    Object.assign(loginDto, req.body);

    // 유효성 검사
    const errors = await validate(loginDto);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다.',
        details: errors.map(error => ({
          field: error.property,
          message: Object.values(error.constraints || {})[0]
        }))
      });
    }

    const result = await authService.login(loginDto);
    
    // 세션에 사용자 정보 저장
    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    req.session.isAuthenticated = true;

    res.json({
      success: true,
      message: result.message,
      data: {
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          name: result.user.name,
          email_verified: result.user.email_verified
        },
        token: result.token
      }
    });
  } catch (error) {
    console.error('로그인 에러:', error);
    res.status(401).json({
      success: false,
      error: error.message || '로그인 중 오류가 발생했습니다.'
    });
  }
});

// 로그아웃
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('세션 삭제 에러:', err);
      return res.status(500).json({
        success: false,
        error: '로그아웃 중 오류가 발생했습니다.'
      });
    }
    
    res.clearCookie('connect.sid'); // 세션 쿠키 삭제
    res.json({
      success: true,
      message: '로그아웃되었습니다.'
    });
  });
});

// 이메일 인증 코드 전송 (비활성화됨 - 가입 시 이메일 인증 제거)
router.post('/send-verification-code', async (req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: '이메일 인증 기능이 비활성화되었습니다. 회원가입 시 이메일 인증이 필요하지 않습니다.'
  });
});

// 이메일 인증 코드 확인 (비활성화됨 - 가입 시 이메일 인증 제거)
router.post('/verify-email', async (req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: '이메일 인증 기능이 비활성화되었습니다. 회원가입 시 이메일 인증이 필요하지 않습니다.'
  });
});

// 비밀번호 재설정 요청
router.post('/request-password-reset', async (req: Request, res: Response) => {
  try {
    const resetRequestDto = new PasswordResetRequestDto();
    Object.assign(resetRequestDto, req.body);

    const errors = await validate(resetRequestDto);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '올바른 이메일을 입력해주세요.'
      });
    }

    const result = await authService.requestPasswordReset(resetRequestDto.email);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('비밀번호 재설정 요청 에러:', error);
    res.status(400).json({
      success: false,
      error: error.message || '비밀번호 재설정 요청 중 오류가 발생했습니다.'
    });
  }
});

// 비밀번호 재설정 코드 검증
router.post('/verify-password-reset-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: '이메일과 인증 코드가 필요합니다.'
      });
    }

    const result = await authService.verifyPasswordResetCode(email, code);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('비밀번호 재설정 코드 검증 에러:', error);
    res.status(400).json({
      success: false,
      error: error.message || '인증 코드 검증 중 오류가 발생했습니다.'
    });
  }
});

// 비밀번호 재설정
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const resetDto = new PasswordResetDto();
    Object.assign(resetDto, req.body);

    const errors = await validate(resetDto);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다.',
        details: errors.map(error => ({
          field: error.property,
          message: Object.values(error.constraints || {})[0]
        }))
      });
    }

    const result = await authService.resetPassword(resetDto);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('비밀번호 재설정 에러:', error);
    res.status(400).json({
      success: false,
      error: error.message || '비밀번호 재설정 중 오류가 발생했습니다.'
    });
  }
});

// 현재 사용자 정보 조회
router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.session.isAuthenticated || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다.'
      });
    }

    const user = await authService.verifyToken(req.session.userId.toString());
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          phone: user.phone,
          email_verified: user.email_verified,
          created_at: user.created_at,
          last_login: user.last_login
        }
      }
    });
  } catch (error) {
    console.error('사용자 정보 조회 에러:', error);
    res.status(401).json({
      success: false,
      error: '인증이 필요합니다.'
    });
  }
});

// 프로필 업데이트
router.put('/update-profile', async (req: Request, res: Response) => {
  try {
    let userId: number;

    // 세션 기반 인증 확인
    if (req.session.isAuthenticated && req.session.userId) {
      userId = req.session.userId;
    } 
    // 토큰 기반 인증 확인
    else if (req.headers.authorization) {
      const token = req.headers.authorization.replace('Bearer ', '');
      const user = await authService.verifyToken(token);
      userId = user.id;
    }
    // 요청 본문에 토큰이 있는 경우
    else if (req.body.token) {
      const user = await authService.verifyToken(req.body.token);
      userId = user.id;
    }
    else {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다.'
      });
    }

    const updateData = req.body;
    const user = await authService.updateProfile(userId, updateData);
    
    res.json({
      success: true,
      message: '프로필이 성공적으로 업데이트되었습니다.',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
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
    res.status(400).json({
      success: false,
      error: error.message || '프로필 업데이트 중 오류가 발생했습니다.'
    });
  }
});

// 토큰 검증
router.post('/verify-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: '토큰이 필요합니다.'
      });
    }

    const user = await authService.verifyToken(token);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          email_verified: user.email_verified
        }
      }
    });
  } catch (error) {
    console.error('토큰 검증 에러:', error);
    res.status(401).json({
      success: false,
      error: '유효하지 않은 토큰입니다.'
    });
  }
});

// ==================== 소셜 로그인 엔드포인트들 ====================

// 카카오 로그인 시작
router.get('/kakao', async (req: Request, res: Response) => {
  try {
    const authUrl = await authService.startKakaoLogin(req.session);
    res.json({
      success: true,
      data: {
        authUrl
      }
    });
  } catch (error) {
    console.error('카카오 로그인 시작 에러:', error);
    res.status(400).json({
      success: false,
      error: error.message || '카카오 로그인 시작 중 오류가 발생했습니다.'
    });
  }
});

// 카카오 콜백 처리
router.get('/kakao/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: '인증 코드 또는 상태값이 없습니다.'
      });
    }

    const result = await authService.handleKakaoCallback(
      req.session, 
      code as string, 
      state as string
    );

    // 세션에 사용자 정보 저장
    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    req.session.isAuthenticated = true;

    // 프론트엔드로 리다이렉트 (성공 시)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login-success?token=${result.token}`);
  } catch (error) {
    console.error('카카오 콜백 에러:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login-error?error=${encodeURIComponent(error.message)}`);
  }
});

// 네이버 로그인 시작
router.get('/naver', async (req: Request, res: Response) => {
  try {
    const authUrl = await authService.startNaverLogin(req.session);
    res.json({
      success: true,
      data: {
        authUrl
      }
    });
  } catch (error) {
    console.error('네이버 로그인 시작 에러:', error);
    res.status(400).json({
      success: false,
      error: error.message || '네이버 로그인 시작 중 오류가 발생했습니다.'
    });
  }
});

// 네이버 콜백 처리
router.get('/naver/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: '인증 코드 또는 상태값이 없습니다.'
      });
    }

    const result = await authService.handleNaverCallback(
      req.session, 
      code as string, 
      state as string
    );

    // 세션에 사용자 정보 저장
    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    req.session.isAuthenticated = true;

    // 프론트엔드로 리다이렉트 (성공 시)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login-success?token=${result.token}`);
  } catch (error) {
    console.error('네이버 콜백 에러:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login-error?error=${encodeURIComponent(error.message)}`);
  }
});



export default router;
