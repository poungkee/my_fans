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
        where: { id: decoded.userId, is_active: true },
      });
      if (!user) throw new Error('사용자를 찾을 수 없습니다.');
      return user;
    } catch {
      throw new Error('유효하지 않은 토큰입니다.');
    }
  }

  // ---------- 회원가입 ----------
  async register(registerData: RegisterDto): Promise<{ user: User; message: string }> {
    const { name, username, email, password, confirmPassword, phone, age, gender, location } = registerData;

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
      name,
      username,
      email,
      password_hash: passwordHash,
      phone,
      age,
      gender,
      location,
      provider: 'local',
      email_verified: true,
      is_active: true,
    });

    const savedUser = await this.userRepository.save(user);

    try {
      await this.emailService.sendWelcomeEmail(email, username);
    } catch (err) {
      console.error('환영 이메일 전송 실패:', err);
    }

    return { user: savedUser, message: '회원가입이 완료되었습니다. 로그인해주세요.' };
  }

  // ---------- 로그인 ----------
  async login(loginData: LoginDto): Promise<{ user: User; token: string; message: string }> {
    const { username, password, rememberMe } = loginData;

    const user = await this.userRepository.findOne({ where: { username, is_active: true } });
    if (!user) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    if (!user.password_hash) throw new Error('일반 로그인을 사용할 수 없는 계정입니다.');

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');

    const token = this.generateJwtToken(user, rememberMe);

    user.last_login = new Date();
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
      kakaoProf.profile_image_url ||
      props.profile_image ||
      kakaoProf.thumbnail_image_url ||
      null;

    let user = await this.userRepository.findOne({
      where: { provider: 'kakao', provider_id: providerId },
    });

    if (!user && email) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) {
        existing.provider = 'kakao';
        existing.provider_id = providerId;
        existing.name = name || existing.name;
        if (profileImage) existing.profile_image = profileImage;
        user = await this.userRepository.save(existing);
      }
    }

    if (!user) {
      user = this.userRepository.create({
        username: `kakao_${providerId}`,
        email: email || `kakao_${providerId}@kakao.local`,
        name,
        provider: 'kakao',
        provider_id: providerId,
        profile_image: profileImage,
        email_verified: true,
        is_active: true,
      });
      user = await this.userRepository.save(user);
    } else {
      let needsSave = false;
      if (name && name !== user.name) {
        user.name = name;
        needsSave = true;
      }
      if (profileImage && profileImage !== user.profile_image) {
        user.profile_image = profileImage;
        needsSave = true;
      }
      if (needsSave) await this.userRepository.save(user);
    }

    user.last_login = new Date();
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
    const profileImage: string | null = profile.profile_image || null;

    let user = await this.userRepository.findOne({
      where: { provider: 'naver', provider_id: providerId },
    });

    if (!user && email) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) {
        existing.provider = 'naver';
        existing.provider_id = providerId;
        existing.name = name || existing.name;
        if (profileImage) existing.profile_image = profileImage;
        user = await this.userRepository.save(existing);
      }
    }

    if (!user) {
      user = this.userRepository.create({
        username: `naver_${providerId}`,
        email: email || `naver_${providerId}@naver.local`,
        name,
        provider: 'naver',
        provider_id: providerId,
        profile_image: profileImage,
        email_verified: true,
        is_active: true,
      });
      user = await this.userRepository.save(user);
    } else {
      let needsSave = false;
      if (name && name !== user.name) {
        user.name = name;
        needsSave = true;
      }
      if (profileImage && profileImage !== user.profile_image) {
        user.profile_image = profileImage;
        needsSave = true;
      }
      if (needsSave) await this.userRepository.save(user);
    }

    user.last_login = new Date();
    await this.userRepository.save(user);

    const jwtToken = this.generateJwtToken(user, true);

    session.userId = user.id;
    session.isAuthenticated = true;

    return { user, token: jwtToken, message: '네이버 로그인 성공' };
  }
}
