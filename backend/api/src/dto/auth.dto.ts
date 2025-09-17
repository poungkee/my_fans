import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: '이름은 최소 2자 이상이어야 합니다.' })
  name: string;

  @IsString()
  @MinLength(3, { message: '아이디는 최소 3자 이상이어야 합니다.' })
  username: string;

  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password: string;

  @IsString()
  @MinLength(8, { message: '비밀번호 확인은 최소 8자 이상이어야 합니다.' })
  confirmPassword: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsNumber({}, { message: '나이는 숫자여야 합니다.' })
  age?: number;

  @IsOptional()
  @IsString()
  @IsIn(['남성', '여성', '기타'], { message: '성별은 남성, 여성, 기타 중 하나여야 합니다.' })
  gender?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class EmailVerificationDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;
}

export class VerifyCodeDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  code: string;
}

export class PasswordResetRequestDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;
}

export class PasswordResetDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  code: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  newPassword: string;
}

export class SocialLoginDto {
  @IsString()
  provider: string; // 'kakao', 'naver'

  @IsString()
  accessToken: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  age?: number;

  @IsOptional()
  preferred_categories?: string[];

  @IsOptional()
  preferred_media_sources?: string[];
}

export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  password?: string;
}

