import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { RegisterDto, LoginDto, PasswordResetDto, DeleteAccountDto } from '../dto/auth.dto';
import { EmailService } from './emailService';
import { KakaoOAuthProvider, NaverOAuthProvider } from './oauthProviders';

type JwtPayload = {
  userId: number;
  username?: string;
  email?: string;
  iat?: number;
  exp?: number;
};

export class AuthService {
  private userRepository: Repository<User>;
  private emailService: EmailService;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.emailService = new EmailService();
  }

  private getKakaoRedirectUri(): string {
    const redirectUri = process.env.KAKAO_REDIRECT_URI;
    if (!redirectUri) {
      throw new Error('카카오 OAuth redirect URI가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
    }
    return redirectUri;
  }

  // ---------- JWT ----------
  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    if (!process.env.JWT_SECRET) {
      console.warn('[WARN] JWT_SECRET is not set. Using fallback dev secret.');
    }
    return secret;
  }

  private generateJwtToken(user: User, rememberMe?: boolean): string {
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
    };
    const expiresIn = rememberMe ? '30d' : '1d';
    return jwt.sign(payload, this.getJwtSecret(), { expiresIn });
  }

  public verifyTokenString(token: string): JwtPayload {
    return jwt.verify(token, this.getJwtSecret()) as JwtPayload;
  }

  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret()) as JwtPayload;
      const user = await this.userRepository.findOne({
        where: { id: decoded.userId, active: true },
      });
      if (!user) throw new Error('사용자를 찾을 수 없습니다.');
      return user;
    } catch {
      throw new Error('유효하지 않은 토큰입니다.');
    }
  }

  // ---------- 회원가입 ----------
  async register(registerData: RegisterDto): Promise<{ user: User; token: string; message: string }> {
    const { name, username, email, password, confirmPassword, phone, age, gender, location, provider, socialToken, profileImage } = registerData;

    if (password !== confirmPassword) throw new Error('비밀번호가 일치하지 않습니다.');

    const existingUser = await this.userRepository.findOne({
      where: [{ username }, { email }],
    });
    if (existingUser) {
      if (existingUser.username === username) throw new Error('이미 사용 중인 아이디입니다.');
      if (existingUser.email === email) throw new Error('이미 사용 중인 이메일입니다.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = this.userRepository.create({
      userName: name,
      username,
      email,
      passwordHash: passwordHash,
      tel: phone,
      provider: provider || 'local',
      socialToken: socialToken || undefined,
      profileImage: profileImage || undefined,
      active: true,
    });

    const savedUser = await this.userRepository.save(user);

    try {
      await this.emailService.sendWelcomeEmail(email, username);
    } catch (err) {
      console.error('환영 이메일 전송 실패:', err);
    }

    // 회원가입 후 자동 로그인을 위한 토큰 생성
    const token = this.generateJwtToken(savedUser, false);

    return {
      user: savedUser,
      token,
      message: '회원가입이 완료되었습니다. 프로필을 설정해주세요.'
    };
  }

  // ---------- 로그인 ----------
  async login(loginData: LoginDto): Promise<{ user: User; token: string; message: string }> {
    const { username, password, rememberMe } = loginData;

    const user = await this.userRepository.findOne({ where: { username, active: true } });
    if (!user) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    if (!user.passwordHash) throw new Error('일반 로그인을 사용할 수 없는 계정입니다.');

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');

    const token = this.generateJwtToken(user, rememberMe);

    user.lastLogin = new Date();
    await this.userRepository.save(user);

    return { user, token, message: '로그인 성공' };
  }

  // ---------- 카카오 로그인 ----------
  async startKakaoLogin(session: any): Promise<string> {
    const state = KakaoOAuthProvider.generateState();
    session.oauthState = state;

    const redirectUri = this.getKakaoRedirectUri();
    console.log('[DEBUG] Kakao start login → redirect_uri:', redirectUri);

    return KakaoOAuthProvider.buildAuthorizeUrl(state, redirectUri);
  }

  async handleKakaoCallback(
    session: any,
    code: string,
    state: string
  ): Promise<{ user: User; token: string; message: string }> {
    if (!session?.oauthState || session.oauthState !== state) {
      console.warn('[WARN] Kakao callback state mismatch', {
        expected: session?.oauthState,
        received: state,
      });
      throw new Error('Invalid OAuth state');
    }
    delete session.oauthState;

    console.log('[DEBUG] Kakao callback → code:', code, 'state:', state);

    const redirectUri = this.getKakaoRedirectUri();
    const token = await KakaoOAuthProvider.exchangeToken(code, redirectUri);
    const profile = await KakaoOAuthProvider.getProfile(token.access_token);

    const providerId = String(profile.id);
    const kakaoAcc = profile.kakao_account || {};
    const kakaoProf = kakaoAcc.profile || {};
    const props = profile.properties || {};

    const email: string | null = kakaoAcc.email || null;
    const name: string = kakaoProf.nickname || props.nickname || '카카오사용자';
    const profileImage: string | null =
      kakaoProf.profileImage_url ||
      props.profileImage ||
      kakaoProf.thumbnail_image_url ||
      null;

    let user = await this.userRepository.findOne({
      where: { provider: 'kakao', socialToken: providerId },
    });

    if (!user && email) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) {
        existing.provider = 'kakao';
        existing.socialToken = providerId;
        existing.userName = name || existing.userName;
        if (profileImage) existing.profileImage = profileImage;
        user = await this.userRepository.save(existing);
      }
    }

    if (!user) {
      // 신규 카카오 사용자인 경우 임시 데이터만 생성하고 등록 페이지로 리다이렉트
      throw new Error(`NEW_USER:${JSON.stringify({
        email: email || `kakao_${providerId || 'unknown'}@kakao.local`,
        name: name || '카카오사용자',
        profileImage: profileImage || null,
        provider: 'kakao',
        socialToken: providerId || undefined
      })}`);
    } else {
      let needsSave = false;
      if (name && name !== user.userName) {
        user.userName = name;
        needsSave = true;
      }
      if (profileImage && profileImage !== user.profileImage) {
        user.profileImage = profileImage;
        needsSave = true;
      }
      if (needsSave) await this.userRepository.save(user);
    }

    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const jwtToken = this.generateJwtToken(user, true);

    session.userId = user.id;
    session.isAuthenticated = true;

    return { user, token: jwtToken, message: '카카오 로그인 성공' };
  }

  // ---------- 네이버 로그인 ----------
  async startNaverLogin(session: any): Promise<string> {
    const state = NaverOAuthProvider.generateState();
    session.oauthState = state;

    const redirectUri = process.env.NAVER_REDIRECT_URI!;
    return NaverOAuthProvider.buildAuthorizeUrl(state);
  }

  async handleNaverCallback(
    session: any,
    code: string,
    state: string
  ): Promise<{ user: User; token: string; message: string }> {
    if (!session?.oauthState || session.oauthState !== state) {
      console.warn('[WARN] Kakao callback state mismatch', {
        expected: session?.oauthState,
        received: state,
      });
      throw new Error('Invalid OAuth state');
    }
    delete session.oauthState;

    const redirectUri = process.env.NAVER_REDIRECT_URI!;
    const token = await NaverOAuthProvider.exchangeToken(code, redirectUri);
    const profile = await NaverOAuthProvider.getProfile(token.access_token);

    const providerId: string = profile.id;
    const email: string | null = profile.email || null;
    const name: string = profile.name || '네이버사용자';
    const profileImage: string | null = profile.profileImage || null;

    let user = await this.userRepository.findOne({
      where: { provider: 'naver', socialToken: providerId },
    });

    if (!user && email) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) {
        existing.provider = 'naver';
        existing.socialToken = providerId;
        existing.userName = name || existing.userName;
        if (profileImage) existing.profileImage = profileImage;
        user = await this.userRepository.save(existing);
      }
    }

    if (!user) {
      // 신규 네이버 사용자인 경우 임시 데이터만 생성하고 등록 페이지로 리다이렉트
      throw new Error(`NEW_USER:${JSON.stringify({
        email: email || `naver_${providerId || 'unknown'}@naver.local`,
        name: name || '네이버사용자',
        profileImage: profileImage || null,
        provider: 'naver',
        socialToken: providerId || undefined
      })}`);
    } else {
      let needsSave = false;
      if (name && name !== user.userName) {
        user.userName = name;
        needsSave = true;
      }
      if (profileImage && profileImage !== user.profileImage) {
        user.profileImage = profileImage;
        needsSave = true;
      }
      if (needsSave) await this.userRepository.save(user);
    }

    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const jwtToken = this.generateJwtToken(user, true);

    session.userId = user.id;
    session.isAuthenticated = true;

    return { user, token: jwtToken, message: '네이버 로그인 성공' };
  }

  // ---------- 비밀번호 재설정 ----------
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email, active: true } });
    if (!user) throw new Error('해당 이메일로 등록된 계정을 찾을 수 없습니다.');

    // TODO: 실제 이메일 발송 로직 구현
    return { message: '비밀번호 재설정 이메일이 발송되었습니다.' };
  }

  async resetPassword(resetData: PasswordResetDto): Promise<{ message: string }> {
    // TODO: 토큰 검증 및 비밀번호 재설정 로직 구현
    return { message: '비밀번호가 성공적으로 재설정되었습니다.' };
  }

  // ---------- 프로필 관리 ----------
  async getUserProfile(userId: number): Promise<any | null> {
    const user = await this.userRepository.findOne({ where: { id: userId, active: true } });
    if (!user) return null;

    // user_preferences 데이터도 함께 가져오기
    const preferences = await this.getUserPreferences(userId);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.userName,
      phone: user.tel,
      profileImage: user.profileImage,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      // preferences 데이터 추가
      age: preferences?.age || null,
      gender: preferences?.gender || null,
      location: preferences?.location || null,
      preferredCategories: preferences?.preferred_categories || [],
      preferredSources: preferences?.preferred_sources || []
    };
  }

  async updateUserProfile(userId: number, updateData: any): Promise<User> {
    await this.userRepository.update(userId, updateData);
    const updatedUser = await this.userRepository.findOne({ where: { id: userId } });
    if (!updatedUser) throw new Error('사용자를 찾을 수 없습니다.');
    return updatedUser;
  }

  // ---------- 프로필 셋업 ----------
  async setupUserProfile(userId: number, profileData: {
    age?: number;
    gender?: string;
    location?: string;
    preferredCategories?: string[];
    preferredSources?: string[];
  }): Promise<any> {
    const { age, gender, location, preferredCategories, preferredSources } = profileData;

    // user_preferences 테이블에 데이터 삽입 또는 업데이트
    const query = `
      INSERT INTO user_preferences (user_id, age, gender, location, preferred_categories, preferred_sources, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        age = EXCLUDED.age,
        gender = EXCLUDED.gender,
        location = EXCLUDED.location,
        preferred_categories = EXCLUDED.preferred_categories,
        preferred_sources = EXCLUDED.preferred_sources,
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await AppDataSource.query(query, [
      userId,
      age || null,
      gender || null,
      location || null,
      preferredCategories ? JSON.stringify(preferredCategories) : null,
      preferredSources ? JSON.stringify(preferredSources) : null
    ]);

    return result[0];
  }

  async getUserPreferences(userId: number): Promise<any> {
    try {
      const query = `
        SELECT * FROM user_preferences WHERE user_id = $1;
      `;

      const result = await AppDataSource.query(query, [userId]);

      if (result.length === 0) {
        return null;
      }

      const preferences = result[0];

      // JSON 필드들을 안전하게 파싱
      return {
        ...preferences,
        preferred_categories: preferences.preferred_categories ?
          (typeof preferences.preferred_categories === 'string' ?
            JSON.parse(preferences.preferred_categories) : preferences.preferred_categories) : [],
        preferred_sources: preferences.preferred_sources ?
          (typeof preferences.preferred_sources === 'string' ?
            JSON.parse(preferences.preferred_sources) : preferences.preferred_sources) : [],
        preferred_keywords: preferences.preferred_keywords ?
          (typeof preferences.preferred_keywords === 'string' ?
            JSON.parse(preferences.preferred_keywords) : preferences.preferred_keywords) : [],
        preferred_time_slots: preferences.preferred_time_slots ?
          (typeof preferences.preferred_time_slots === 'string' ?
            JSON.parse(preferences.preferred_time_slots) : preferences.preferred_time_slots) : []
      };
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }

  async updateUserPreferences(userId: number, profileData: {
    age?: number;
    gender?: string;
    location?: string;
    preferredCategories?: string[];
    preferredSources?: string[];
  }): Promise<any> {
    return await this.setupUserProfile(userId, profileData);
  }

  // ---------- 이메일 인증 ----------
  private verificationCodes = new Map<string, { code: string; userId: number; type: 'password' | 'delete'; expiry: Date }>();

  async sendVerificationEmail(userId: number, type: 'password' | 'delete'): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId, active: true } });
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');

    // 6자리 랜덤 코드 생성
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();

    // 코드 만료 시간 (5분)
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    // 메모리에 저장 (실제 운영에서는 Redis 등 사용 권장)
    const key = `${user.email}_${type}`;
    this.verificationCodes.set(key, { code, userId, type, expiry });

    // 이메일 발송
    try {
      const subject = type === 'password' ? '비밀번호 변경 인증코드' : '회원탈퇴 인증코드';
      const message = `인증코드: ${code}\n5분 내에 입력해주세요.`;

      await this.emailService.sendVerificationEmail(user.email, subject, message, code);

      return { message: '인증코드가 이메일로 발송되었습니다.' };
    } catch (err) {
      console.error('이메일 발송 실패:', err);
      throw new Error('이메일 발송에 실패했습니다.');
    }
  }

  async verifyEmailCode(email: string, code: string, type: 'password' | 'delete'): Promise<{ valid: boolean; userId?: number }> {
    const key = `${email}_${type}`;
    const storedData = this.verificationCodes.get(key);

    if (!storedData) {
      return { valid: false };
    }

    // 만료 시간 확인
    if (new Date() > storedData.expiry) {
      this.verificationCodes.delete(key);
      return { valid: false };
    }

    // 코드 일치 확인
    if (storedData.code !== code.toUpperCase()) {
      return { valid: false };
    }

    // 인증 성공 시 코드 삭제
    this.verificationCodes.delete(key);
    return { valid: true, userId: storedData.userId };
  }

  // ---------- 비밀번호 변경 ----------
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId, active: true } });
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');

    // 소셜 로그인 사용자는 비밀번호 변경 불가
    if (user.provider !== 'local') {
      throw new Error('소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.');
    }

    // 현재 비밀번호 확인
    if (!user.passwordHash) {
      throw new Error('비밀번호가 설정되지 않은 계정입니다.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new Error('현재 비밀번호가 올바르지 않습니다.');
    }

    // 새 비밀번호 해시화
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // 이전 비밀번호 저장 (필요시)
    await this.userRepository.update(userId, {
      passwordHash: newPasswordHash,
      previousPw: user.passwordHash
    });

    return { message: '비밀번호가 성공적으로 변경되었습니다.' };
  }

  // ---------- 회원탈퇴 ----------
  async deleteAccount(userId: number, deleteData: DeleteAccountDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId, active: true } });
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');

    // 소프트 삭제 (active = false)
    await this.userRepository.update(userId, { active: false });
    return { message: '계정이 성공적으로 삭제되었습니다.' };
  }
}
