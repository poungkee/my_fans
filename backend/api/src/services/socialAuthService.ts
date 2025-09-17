import axios from 'axios';
import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { AuthService } from './authService';

export class SocialAuthService {
  private userRepository: Repository<User>;
  private authService: AuthService;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.authService = new AuthService();
  }

  // 카카오 로그인
  async kakaoLogin(accessToken: string): Promise<{ user: User; token: string; message: string }> {
    try {
      // 카카오 API로 사용자 정보 조회
      const kakaoUserInfo = await this.getKakaoUserInfo(accessToken);
      
      if (!kakaoUserInfo) {
        throw new Error('카카오 사용자 정보를 가져올 수 없습니다.');
      }

      // 기존 사용자 확인
      let user = await this.userRepository.findOne({
        where: { provider_id: kakaoUserInfo.id.toString() }
      });

      if (!user) {
        // 새 사용자 생성
        user = this.userRepository.create({
          username: `kakao_${kakaoUserInfo.id}`,
          email: kakaoUserInfo.kakao_account?.email || `${kakaoUserInfo.id}@kakao.com`,
          name: kakaoUserInfo.kakao_account?.profile?.nickname || '카카오 사용자',
          provider: 'kakao',
          provider_id: kakaoUserInfo.id.toString(),
          profile_image: kakaoUserInfo.kakao_account?.profile?.profile_image_url,
          email_verified: true, // 카카오는 이메일 인증 완료로 간주
          is_active: true
        });

        user = await this.userRepository.save(user);
      } else {
        // 기존 사용자 정보 업데이트
        user.profile_image = kakaoUserInfo.kakao_account?.profile?.profile_image_url;
        user.last_login = new Date();
        user = await this.userRepository.save(user);
      }

      // JWT 토큰 생성
      const token = this.generateJwtToken(user);

      return {
        user,
        token,
        message: '카카오 로그인 성공'
      };
    } catch (error) {
      console.error('카카오 로그인 에러:', error);
      throw new Error('카카오 로그인에 실패했습니다.');
    }
  }

  // 네이버 로그인
  async naverLogin(accessToken: string): Promise<{ user: User; token: string; message: string }> {
    try {
      // 네이버 API로 사용자 정보 조회
      const naverUserInfo = await this.getNaverUserInfo(accessToken);
      
      if (!naverUserInfo) {
        throw new Error('네이버 사용자 정보를 가져올 수 없습니다.');
      }

      // 기존 사용자 확인
      let user = await this.userRepository.findOne({
        where: { provider_id: naverUserInfo.id }
      });

      if (!user) {
        // 새 사용자 생성
        user = this.userRepository.create({
          username: `naver_${naverUserInfo.id}`,
          email: naverUserInfo.email || `${naverUserInfo.id}@naver.com`,
          name: naverUserInfo.name || '네이버 사용자',
          provider: 'naver',
          provider_id: naverUserInfo.id,
          profile_image: naverUserInfo.profile_image,
          email_verified: true, // 네이버는 이메일 인증 완료로 간주
          is_active: true
        });

        user = await this.userRepository.save(user);
      } else {
        // 기존 사용자 정보 업데이트
        user.profile_image = naverUserInfo.profile_image;
        user.last_login = new Date();
        user = await this.userRepository.save(user);
      }

      // JWT 토큰 생성
      const token = this.generateJwtToken(user);

      return {
        user,
        token,
        message: '네이버 로그인 성공'
      };
    } catch (error) {
      console.error('네이버 로그인 에러:', error);
      throw new Error('네이버 로그인에 실패했습니다.');
    }
  }

  // 카카오 사용자 정보 조회
  private async getKakaoUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await axios.get('https://kapi.kakao.com/v2/user/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        }
      });

      return response.data;
    } catch (error) {
      console.error('카카오 API 에러:', error);
      throw new Error('카카오 사용자 정보 조회에 실패했습니다.');
    }
  }

  // 네이버 사용자 정보 조회
  private async getNaverUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await axios.get('https://openapi.naver.com/v1/nid/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.response;
    } catch (error) {
      console.error('네이버 API 에러:', error);
      throw new Error('네이버 사용자 정보 조회에 실패했습니다.');
    }
  }

  // JWT 토큰 생성
  private generateJwtToken(user: User): string {
    const jwt = require('jsonwebtoken');
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '7d'
    });
  }
}

