import axios from 'axios';
import crypto from 'crypto';

// 카카오 OAuth Provider
export class KakaoOAuthProvider {
  // 카카오 인증 URL 생성
  static buildAuthorizeUrl(state: string) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.KAKAO_CLIENT_ID || '',
      redirect_uri: process.env.KAKAO_REDIRECT_URI || '',
      state,
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  // 콜백에서 받은 code로 토큰 교환
  static async exchangeToken(code: string, state: string) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_CLIENT_ID || '',
      client_secret: process.env.KAKAO_CLIENT_SECRET || '',
      code,
      state,
    });

    const { data } = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    return data;
  }

  // 액세스 토큰으로 사용자 프로필 조회
  static async getProfile(accessToken: string) {
    const { data } = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return data;
  }

  // CSRF 방지용 state 생성기
  static generateState() {
    return crypto.randomBytes(24).toString('hex');
  }
}

// 네이버 OAuth Provider
export class NaverOAuthProvider {
  // 네이버 인증 URL 생성
  static buildAuthorizeUrl(state: string) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.NAVER_CLIENT_ID || '',
      redirect_uri: process.env.NAVER_REDIRECT_URI || '',
      state,
    });
    return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
  }

  // 콜백에서 받은 code로 토큰 교환
  static async exchangeToken(code: string, state: string) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NAVER_CLIENT_ID || '',
      client_secret: process.env.NAVER_CLIENT_SECRET || '',
      code,
      state,
    });

    const { data } = await axios.post(
      'https://nid.naver.com/oauth2.0/token',
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    return data;
  }

  // 액세스 토큰으로 사용자 프로필 조회
  static async getProfile(accessToken: string) {
    const { data } = await axios.get('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (data.resultcode !== '00') {
      throw new Error(`Naver profile error: ${data.message}`);
    }
    return data.response;
  }

  // CSRF 방지용 state 생성기
  static generateState() {
    return crypto.randomBytes(24).toString('hex');
  }
}

