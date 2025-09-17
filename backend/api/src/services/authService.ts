import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { RegisterDto, LoginDto, PasswordResetDto } from '../dto/auth.dto';
import { EmailService } from './emailService';
import { KakaoOAuthProvider, NaverOAuthProvider } from './oauthProviders';

export class AuthService {
  private userRepository: Repository<User>;
  private emailService: EmailService;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.emailService = new EmailService();
  }

  // 회원가입
  async register(registerData: RegisterDto): Promise<{ user: User; message: string }> {
    const { name, username, email, password, confirmPassword, phone } = registerData;

    // 비밀번호 확인
    if (password !== confirmPassword) {
      throw new Error('비밀번호가 일치하지 않습니다.');
    }

    // 중복 확인
    const existingUser = await this.userRepository.findOne({
      where: [
        { username },
        { email }
      ]
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new Error('이미 사용 중인 아이디입니다.');
      }
      if (existingUser.email === email) {
        throw new Error('이미 사용 중인 이메일입니다.');
      }
    }

    // 비밀번호 해시화
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 사용자 생성 (이메일 인증 없이 바로 활성화)
    const user = this.userRepository.create({
      name,
      username,
      email,
      password_hash: passwordHash,
      phone,
      provider: 'local',
      email_verified: true, // 이메일 인증 없이 바로 활성화
      email_verification_code: null,
      email_verification_expires: null,
      is_active: true
    });

    const savedUser = await this.userRepository.save(user);

    // 환영 이메일 전송
    try {
      await this.emailService.sendWelcomeEmail(email, username);
    } catch (error) {
      console.error('환영 이메일 전송 실패:', error);
      // 환영 이메일 전송 실패해도 회원가입은 성공으로 처리
    }

    return {
      user: savedUser,
      message: '회원가입이 완료되었습니다. 로그인해주세요.'
    };
  }

  // 로그인
  async login(loginData: LoginDto): Promise<{ user: User; token: string; message: string }> {
    const { username, password, rememberMe } = loginData;

    // 사용자 찾기
    const user = await this.userRepository.findOne({
      where: { username, is_active: true }
    });

    if (!user) {
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    // 비밀번호 확인
    if (!user.password_hash) {
      throw new Error('일반 로그인을 사용할 수 없는 계정입니다.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    // JWT 토큰 생성 (rememberMe에 따라 만료 시간 설정)
    const token = this.generateJwtToken(user, rememberMe);

    // 마지막 로그인 시간 업데이트
    user.last_login = new Date();
    await this.userRepository.save(user);

    return {
      user,
      token,
      message: '로그인 성공'
    };
  }

  // 이메일 인증 코드 확인
  async verifyEmail(email: string, code: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email }
    });

    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    if (user.email_verified) {
      throw new Error('이미 인증된 이메일입니다.');
    }

    if (!user.email_verification_code || !user.email_verification_expires) {
      throw new Error('인증 코드가 만료되었습니다. 다시 요청해주세요.');
    }

    if (user.email_verification_code !== code) {
      throw new Error('인증 코드가 올바르지 않습니다.');
    }

    if (new Date() > user.email_verification_expires) {
      throw new Error('인증 코드가 만료되었습니다. 다시 요청해주세요.');
    }

    // 이메일 인증 완료
    user.email_verified = true;
    user.email_verification_code = null;
    user.email_verification_expires = null;
    await this.userRepository.save(user);

    return { message: '이메일 인증이 완료되었습니다.' };
  }

  // 비밀번호 재설정 요청
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email, is_active: true }
    });

    if (!user) {
      throw new Error('해당 이메일로 등록된 사용자를 찾을 수 없습니다.');
    }

    // 매번 새로운 랜덤 6자리 코드 생성
    const resetCode = this.generateVerificationCode();
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료

    // 기존 코드가 있어도 새로운 코드로 덮어쓰기
    user.password_reset_code = resetCode;
    user.password_reset_expires = resetExpires;
    await this.userRepository.save(user);

    console.log(`[비밀번호 재설정] ${email}로 새 코드 전송: ${resetCode}`);

    // 이메일로 재설정 코드 전송
    try {
      await this.emailService.sendPasswordResetCode(email, resetCode);
    } catch (error) {
      console.error('이메일 전송 실패:', error);
      throw new Error('이메일 전송에 실패했습니다. 다시 시도해주세요.');
    }

    return { message: '비밀번호 재설정 코드가 이메일로 전송되었습니다.' };
  }

  // 비밀번호 재설정 코드 검증
  async verifyPasswordResetCode(email: string, code: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email, is_active: true }
    });

    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    if (!user.password_reset_code || !user.password_reset_expires) {
      throw new Error('비밀번호 재설정 코드가 만료되었습니다. 다시 요청해주세요.');
    }

    if (user.password_reset_code !== code) {
      throw new Error('인증 코드가 올바르지 않습니다.');
    }

    if (new Date() > user.password_reset_expires) {
      throw new Error('비밀번호 재설정 코드가 만료되었습니다. 다시 요청해주세요.');
    }

    return { message: '인증 코드가 확인되었습니다.' };
  }

  // 비밀번호 재설정
  async resetPassword(resetData: PasswordResetDto): Promise<{ message: string }> {
    const { email, code, newPassword } = resetData;

    const user = await this.userRepository.findOne({
      where: { email, is_active: true }
    });

    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    if (!user.password_reset_code || !user.password_reset_expires) {
      throw new Error('비밀번호 재설정 코드가 만료되었습니다. 다시 요청해주세요.');
    }

    if (user.password_reset_code !== code) {
      throw new Error('인증 코드가 올바르지 않습니다.');
    }

    if (new Date() > user.password_reset_expires) {
      throw new Error('비밀번호 재설정 코드가 만료되었습니다. 다시 요청해주세요.');
    }

    // 새 비밀번호 해시화
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 이전 비밀번호와 중복 확인
    if (user.password_hash) {
      const isSameAsCurrent = await bcrypt.compare(newPassword, user.password_hash);
      if (isSameAsCurrent) {
        throw new Error('현재 사용 중인 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.');
      }
    }

    // 이전 비밀번호와 중복 확인
    if (user.previous_password_hash) {
      const isSameAsPrevious = await bcrypt.compare(newPassword, user.previous_password_hash);
      if (isSameAsPrevious) {
        throw new Error('최근에 사용했던 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.');
      }
    }

    // 비밀번호 업데이트 (이전 비밀번호를 previous_password_hash로 저장)
    user.previous_password_hash = user.password_hash; // 현재 비밀번호를 이전 비밀번호로 저장
    user.password_hash = newPasswordHash; // 새 비밀번호로 업데이트
    user.password_reset_code = null;
    user.password_reset_expires = null;
    await this.userRepository.save(user);

    console.log(`[비밀번호 재설정] ${email} 비밀번호 재설정 완료`);

    return { message: '비밀번호가 성공적으로 재설정되었습니다.' };
  }

  // JWT 토큰 검증
  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      const user = await this.userRepository.findOne({
        where: { id: decoded.userId, is_active: true }
      });

      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      return user;
    } catch (error) {
      throw new Error('유효하지 않은 토큰입니다.');
    }
  }

  // 인증 코드 재전송
  async resendVerificationCode(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email }
    });

    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    if (user.email_verified) {
      throw new Error('이미 인증된 이메일입니다.');
    }

    // 새 인증 코드 생성
    const verificationCode = this.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000); // 5분 후 만료

    user.email_verification_code = verificationCode;
    user.email_verification_expires = verificationExpires;
    await this.userRepository.save(user);

    // 이메일 전송
    try {
      await this.emailService.sendVerificationCode(email, verificationCode);
    } catch (error) {
      console.error('이메일 전송 실패:', error);
      throw new Error('이메일 전송에 실패했습니다. 다시 시도해주세요.');
    }

    return { message: '인증 코드가 재전송되었습니다.' };
  }

  // 프로필 업데이트
  async updateProfile(userId: number, updateData: any): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, is_active: true }
    });

    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    // 업데이트할 필드들만 적용
    if (updateData.age !== undefined) user.age = updateData.age;
    if (updateData.gender !== undefined) user.gender = updateData.gender;
    if (updateData.location !== undefined) user.location = updateData.location;
    if (updateData.preferred_categories !== undefined) user.preferred_categories = updateData.preferred_categories;
    if (updateData.preferred_media_sources !== undefined) user.preferred_media_sources = updateData.preferred_media_sources;

    const updatedUser = await this.userRepository.save(user);
    return updatedUser;
  }


  // 유틸리티 메서드들
  private generateVerificationCode(): string {
    // 6자리 랜덤 숫자 생성 (100000 ~ 999999)
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateJwtToken(user: User, rememberMe?: boolean): string {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email
    };

    // rememberMe가 true면 30일, false면 1일 (브라우저 세션)
    const expiresIn = rememberMe ? '30d' : '1d';

    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn
    });
  }

  // ==================== 소셜 로그인 메서드들 ====================

  // 카카오 로그인 시작
  async startKakaoLogin(session: any): Promise<string> {
    const state = KakaoOAuthProvider.generateState();
    session.oauthState = state;
    return KakaoOAuthProvider.buildAuthorizeUrl(state);
  }

  // 카카오 콜백 처리
  async handleKakaoCallback(session: any, code: string, state: string): Promise<{ user: User; token: string; message: string }> {
    if (!session?.oauthState || session.oauthState !== state) {
      throw new Error('Invalid OAuth state');
    }
    delete session.oauthState;

    // 액세스 토큰 & 프로필
    const token = await KakaoOAuthProvider.exchangeToken(code, state);
    const profile = await KakaoOAuthProvider.getProfile(token.access_token);

    // 카카오 프로필에서 정보 추출
    const providerId = profile.id.toString();
    const email = profile.kakao_account?.email || null;
    const name = profile.kakao_account?.profile?.nickname || profile.properties?.nickname || '카카오사용자';

    // 기존 사용자 찾기
    let user = await this.userRepository.findOne({
      where: { provider: 'kakao', provider_id: providerId }
    });

    // 없으면 생성
    if (!user) {
      // 이메일이 있으면 이메일로도 확인 (기존 계정 연동)
      if (email) {
        const existingUser = await this.userRepository.findOne({
          where: { email }
        });
        if (existingUser) {
          // 기존 계정에 소셜 정보 연결
          existingUser.provider = 'kakao';
          existingUser.provider_id = providerId;
          user = await this.userRepository.save(existingUser);
        }
      }

      // 그래도 없으면 새로 생성
      if (!user) {
        user = this.userRepository.create({
          username: `kakao_${providerId}`,
          email: email || `kakao_${providerId}@kakao.local`,
          name: name,
          provider: 'kakao',
          provider_id: providerId,
          email_verified: true, // 소셜 로그인은 이메일 인증 완료로 간주
          is_active: true
        });
        user = await this.userRepository.save(user);
      }
    }

    // 마지막 로그인 시간 업데이트
    user.last_login = new Date();
    await this.userRepository.save(user);

    // JWT 토큰 생성 (소셜 로그인은 기본적으로 30일 유지)
    const jwtToken = this.generateJwtToken(user, true);

    return {
      user,
      token: jwtToken,
      message: '카카오 로그인 성공'
    };
  }

  // 네이버 로그인 시작
  async startNaverLogin(session: any): Promise<string> {
    const state = NaverOAuthProvider.generateState();
    session.oauthState = state;
    return NaverOAuthProvider.buildAuthorizeUrl(state);
  }

  // 네이버 콜백 처리
  async handleNaverCallback(session: any, code: string, state: string): Promise<{ user: User; token: string; message: string }> {
    if (!session?.oauthState || session.oauthState !== state) {
      throw new Error('Invalid OAuth state');
    }
    delete session.oauthState;

    // 액세스 토큰 & 프로필
    const token = await NaverOAuthProvider.exchangeToken(code, state);
    const profile = await NaverOAuthProvider.getProfile(token.access_token);

    // 네이버 프로필에서 정보 추출
    const providerId = profile.id;
    const email = profile.email || null;
    const name = profile.name || '네이버사용자';

    // 기존 사용자 찾기
    let user = await this.userRepository.findOne({
      where: { provider: 'naver', provider_id: providerId }
    });

    // 없으면 생성
    if (!user) {
      // 이메일이 있으면 이메일로도 확인 (기존 계정 연동)
      if (email) {
        const existingUser = await this.userRepository.findOne({
          where: { email }
        });
        if (existingUser) {
          // 기존 계정에 소셜 정보 연결
          existingUser.provider = 'naver';
          existingUser.provider_id = providerId;
          user = await this.userRepository.save(existingUser);
        }
      }

      // 그래도 없으면 새로 생성
      if (!user) {
        user = this.userRepository.create({
          username: `naver_${providerId}`,
          email: email || `naver_${providerId}@naver.local`,
          name: name,
          provider: 'naver',
          provider_id: providerId,
          email_verified: true, // 소셜 로그인은 이메일 인증 완료로 간주
          is_active: true
        });
        user = await this.userRepository.save(user);
      }
    }

    // 마지막 로그인 시간 업데이트
    user.last_login = new Date();
    await this.userRepository.save(user);

    // JWT 토큰 생성 (소셜 로그인은 기본적으로 30일 유지)
    const jwtToken = this.generateJwtToken(user, true);

    return {
      user,
      token: jwtToken,
      message: '네이버 로그인 성공'
    };
  }
}
