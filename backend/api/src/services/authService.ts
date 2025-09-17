// src/services/authService.ts
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

  // ---------- 공통 유틸 ----------
  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    if (!process.env.JWT_SECRET) {
      console.warn('[WARN] JWT_SECRET is not set. Using fallback dev secret.');
    }
    return secret;
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

  /** 프론트의 /api/auth/verify-token 용(형식 검증) */
  public verifyTokenString(token: string): JwtPayload {
    return jwt.verify(token, this.getJwtSecret()) as JwtPayload;
  }

  /** 강한 검증(DB 조회) */
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
      email_verification_code: null,
      email_verification_expires: null,
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

  // ---------- 이메일 인증 ----------
  async verifyEmail(email: string, code: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');
    if (user.email_verified) throw new Error('이미 인증된 이메일입니다.');
    if (!user.email_verification_code || !user.email_verification_expires)
      throw new Error('인증 코드가 만료되었습니다. 다시 요청해주세요.');
    if (user.email_verification_code !== code) throw new Error('인증 코드가 올바르지 않습니다.');
    if (new Date() > user.email_verification_expires)
      throw new Error('인증 코드가 만료되었습니다. 다시 요청해주세요.');

    user.email_verified = true;
    user.email_verification_code = null;
    user.email_verification_expires = null;
    await this.userRepository.save(user);

    return { message: '이메일 인증이 완료되었습니다.' };
  }

  // ---------- 비밀번호 재설정 ----------
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email, is_active: true } });
    if (!user) throw new Error('해당 이메일로 등록된 사용자를 찾을 수 없습니다.');

    const resetCode = this.generateVerificationCode();
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.password_reset_code = resetCode;
    user.password_reset_expires = resetExpires;
    await this.userRepository.save(user);

    console.log(`[비밀번호 재설정] ${email}로 새 코드 전송: ${resetCode}`);

    try {
      await this.emailService.sendPasswordResetCode(email, resetCode);
    } catch (error) {
      console.error('이메일 전송 실패:', error);
      throw new Error('이메일 전송에 실패했습니다. 다시 시도해주세요.');
    }

    return { message: '비밀번호 재설정 코드가 이메일로 전송되었습니다.' };
  }

  async verifyPasswordResetCode(email: string, code: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email, is_active: true } });
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');
    if (!user.password_reset_code || !user.password_reset_expires)
      throw new Error('비밀번호 재설정 코드가 만료되었습니다. 다시 요청해주세요.');
    if (user.password_reset_code !== code) throw new Error('인증 코드가 올바르지 않습니다.');
    if (new Date() > user.password_reset_expires)
      throw new Error('비밀번호 재설정 코드가 만료되었습니다. 다시 요청해주세요.');

    return { message: '인증 코드가 확인되었습니다.' };
  }

  async resetPassword(resetData: PasswordResetDto): Promise<{ message: string }> {
    const { email, code, newPassword } = resetData;

    const user = await this.userRepository.findOne({ where: { email, is_active: true } });
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');
    if (!user.password_reset_code || !user.password_reset_expires)
      throw new Error('비밀번호 재설정 코드가 만료되었습니다. 다시 요청해주세요.');
    if (user.password_reset_code !== code) throw new Error('인증 코드가 올바르지 않습니다.');
    if (new Date() > user.password_reset_expires)
      throw new Error('비밀번호 재설정 코드가 만료되었습니다. 다시 요청해주세요.');

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    if (user.password_hash) {
      const isSameAsCurrent = await bcrypt.compare(newPassword, user.password_hash);
      if (isSameAsCurrent) throw new Error('현재 사용 중인 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.');
    }
    if (user.previous_password_hash) {
      const isSameAsPrevious = await bcrypt.compare(newPassword, user.previous_password_hash);
      if (isSameAsPrevious) throw new Error('최근에 사용했던 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.');
    }

    user.previous_password_hash = user.password_hash;
    user.password_hash = newPasswordHash;
    user.password_reset_code = null;
    user.password_reset_expires = null;
    await this.userRepository.save(user);

    console.log(`[비밀번호 재설정] ${email} 비밀번호 재설정 완료`);
    return { message: '비밀번호가 성공적으로 재설정되었습니다.' };
  }

  // ---------- 프로필 ----------
  async getUserProfile(userId: number): Promise<User | null> {
    try {
      return await this.userRepository.findOne({ where: { id: userId, is_active: true } });
    } catch (error) {
      console.error('사용자 프로필 조회 에러:', error);
      throw new Error('사용자 프로필을 조회할 수 없습니다.');
    }
  }

  async updateUserProfile(userId: number, updateData: Partial<User>): Promise<User> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId, is_active: true } });
      if (!user) throw new Error('사용자를 찾을 수 없습니다.');
      Object.assign(user, updateData);
      return await this.userRepository.save(user);
    } catch (error) {
      console.error('사용자 프로필 업데이트 에러:', error);
      throw new Error('프로필 업데이트 중 오류가 발생했습니다.');
    }
  }

  // ---------- 회원탈퇴 ----------
  async deleteAccount(userId: number, deleteData: DeleteAccountDto): Promise<{ message: string }> {
    try {
      const { password } = deleteData;
      const user = await this.userRepository.findOne({ where: { id: userId, is_active: true } });
      if (!user) throw new Error('사용자를 찾을 수 없습니다.');

      const isSocialLogin = user.provider === 'kakao' || user.provider === 'naver';
      if (!isSocialLogin) {
        if (!password || !password.trim()) throw new Error('비밀번호를 입력해주세요.');
        if (!user.password_hash) throw new Error('비밀번호 확인이 필요합니다.');
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) throw new Error('비밀번호가 올바르지 않습니다.');
      }

      await AppDataSource.transaction(async (manager) => {
        await manager.query('DELETE FROM user_news_interactions WHERE user_id = $1', [userId]);
        await manager.query('DELETE FROM comments WHERE user_id = $1', [userId]);

        if (user.profile_image) {
          try {
            const fs = require('fs');
            const path = require('path');
            const imagePath = path.join(__dirname, '../../', user.profile_image);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
          } catch (fileError: any) {
            console.warn(`[회원탈퇴] 프로필 이미지 삭제 실패: ${fileError.message}`);
          }
        }

        await manager.delete(User, { id: userId });
      });

      console.log(`[회원탈퇴] 사용자 ${userId} (${user.provider}) 및 관련 데이터 완전 삭제 완료`);
      return { message: '회원탈퇴가 완료되었습니다.' };
    } catch (error: any) {
      console.error('회원탈퇴 에러:', error);
      throw new Error(error.message || '회원탈퇴 중 오류가 발생했습니다.');
    }
  }

  // ---------- 소셜 로그인 (카카오/네이버) ----------
  async startKakaoLogin(session: any): Promise<string> {
    const state = KakaoOAuthProvider.generateState();
    session.oauthState = state;
    return KakaoOAuthProvider.buildAuthorizeUrl(state);
  }

  async handleKakaoCallback(
    session: any,
    code: string,
    state: string
  ): Promise<{ user: User; token: string; message: string }> {
    if (!session?.oauthState || session.oauthState !== state) {
      throw new Error('Invalid OAuth state');
    }
    delete session.oauthState;

    const token = await KakaoOAuthProvider.exchangeToken(code, state);
    const profile = await KakaoOAuthProvider.getProfile(token.access_token);

    // ---- 카카오 프로필 파싱 (이미지/닉네임/이메일 모두 대응) ----
    const providerId = String(profile.id);
    const kakaoAcc = profile.kakao_account || {};
    const kakaoProf = kakaoAcc.profile || {};
    const props = profile.properties || {};

    const email: string | null = kakaoAcc.email || null;
    const name: string =
      kakaoProf.nickname || props.nickname || '카카오사용자';

    // 프로필 이미지 우선순위: kakao_account.profile.profile_image_url > properties.profile_image > kakao_account.profile.thumbnail_image_url
    const profileImage: string | null =
      kakaoProf.profile_image_url ||
      props.profile_image ||
      kakaoProf.thumbnail_image_url ||
      null;

    // ---- 사용자 찾기/연결/생성 ----
    let user = await this.userRepository.findOne({
      where: { provider: 'kakao', provider_id: providerId },
    });

    if (!user && email) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) {
        existing.provider = 'kakao';
        existing.provider_id = providerId;
        // 기존 사용자도 최신 프로필로 갱신
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
      // 로그인할 때도 최신 정보로 가볍게 동기화
      const needsSave =
        (name && name !== user.name) ||
        (profileImage && profileImage !== user.profile_image);

      if (needsSave) {
        if (name) user.name = name;
        if (profileImage) user.profile_image = profileImage;
        await this.userRepository.save(user);
      }
    }

    user.last_login = new Date();
    await this.userRepository.save(user);

    const jwtToken = this.generateJwtToken(user, true);

    session.userId = user.id;
    session.isAuthenticated = true;

    return { user, token: jwtToken, message: '카카오 로그인 성공' };
  }

  async startNaverLogin(session: any): Promise<string> {
    const state = NaverOAuthProvider.generateState();
    session.oauthState = state;
    return NaverOAuthProvider.buildAuthorizeUrl(state);
  }

  async handleNaverCallback(
    session: any,
    code: string,
    state: string
  ): Promise<{ user: User; token: string; message: string }> {
    if (!session?.oauthState || session.oauthState !== state) {
      throw new Error('Invalid OAuth state');
    }
    delete session.oauthState;

    const token = await NaverOAuthProvider.exchangeToken(code, state);
    const profile = await NaverOAuthProvider.getProfile(token.access_token);
    // 네이버는 { id, email, name, profile_image, ... }
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
      const needsSave =
        (name && name !== user.name) ||
        (profileImage && profileImage !== user.profile_image);

      if (needsSave) {
        if (name) user.name = name;
        if (profileImage) user.profile_image = profileImage;
        await this.userRepository.save(user);
      }
    }

    user.last_login = new Date();
    await this.userRepository.save(user);

    const jwtToken = this.generateJwtToken(user, true);

    session.userId = user.id;
    session.isAuthenticated = true;

    return { user, token: jwtToken, message: '네이버 로그인 성공' };
  }
}
