import dotenv from 'dotenv';
import path from 'path';
import logger from './logger';

// Load environment variables as early as possible
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  logger.error('Failed to load .env file:', result.error.message);
} else {
  logger.info('[ENV] Environment variables loaded successfully');
}

// ================================
// 환경 변수 검증 및 타입 정의
// ================================

interface EnvConfig {
  // 환경 구분
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;
  HOST: string;

  // Database
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SCHEMA: string;  // development, production

  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;

  // AI Services
  SUMMARIZE_AI_URL: string;
  BIAS_ANALYSIS_AI_URL: string;
  CLASSIFICATION_AI_URL?: string;

  // Session
  SESSION_SECRET: string;

  // Logging
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

  // CORS
  CORS_ORIGIN?: string;
}

// 필수 환경 변수 목록
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_SCHEMA',
  'REDIS_HOST',
  'REDIS_PORT',
  'SUMMARIZE_AI_URL',
  'BIAS_ANALYSIS_AI_URL',
  'SESSION_SECRET',
  'LOG_LEVEL'
] as const;

// 환경 변수 검증 함수
function validateEnv(): EnvConfig {
  const errors: string[] = [];

  // 필수 환경 변수 체크
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // NODE_ENV 검증
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !['development', 'staging', 'production'].includes(nodeEnv)) {
    errors.push(`Invalid NODE_ENV: ${nodeEnv} (must be: development, staging, or production)`);
  }

  // DB_SCHEMA 검증
  const dbSchema = process.env.DB_SCHEMA;
  if (dbSchema && !['development', 'production', 'public'].includes(dbSchema)) {
    errors.push(`Invalid DB_SCHEMA: ${dbSchema} (must be: development, production, or public)`);
  }

  // SESSION_SECRET 길이 체크
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret && sessionSecret.length < 32) {
    errors.push(`SESSION_SECRET must be at least 32 characters (current: ${sessionSecret.length})`);
  }

  // PORT 숫자 검증
  const port = parseInt(process.env.PORT || '0');
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT: ${process.env.PORT} (must be a number between 1-65535)`);
  }

  // DB_PORT 숫자 검증
  const dbPort = parseInt(process.env.DB_PORT || '0');
  if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
    errors.push(`Invalid DB_PORT: ${process.env.DB_PORT} (must be a number between 1-65535)`);
  }

  // REDIS_PORT 숫자 검증
  const redisPort = parseInt(process.env.REDIS_PORT || '0');
  if (isNaN(redisPort) || redisPort < 1 || redisPort > 65535) {
    errors.push(`Invalid REDIS_PORT: ${process.env.REDIS_PORT} (must be a number between 1-65535)`);
  }

  // URL 검증
  const urlVars = ['SUMMARIZE_AI_URL', 'BIAS_ANALYSIS_AI_URL'];
  for (const urlVar of urlVars) {
    const url = process.env[urlVar];
    if (url && !url.match(/^https?:\/\/.+/)) {
      errors.push(`Invalid ${urlVar}: ${url} (must be a valid HTTP/HTTPS URL)`);
    }
  }

  // 에러가 있으면 프로세스 종료
  if (errors.length > 0) {
    logger.error('❌ Environment validation failed:');
    errors.forEach((error) => logger.error(`  - ${error}`));
    process.exit(1);
  }

  // 검증된 환경 변수 반환
  const config: EnvConfig = {
    NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
    PORT: port,
    HOST: process.env.HOST || '0.0.0.0',

    DB_HOST: process.env.DB_HOST!,
    DB_PORT: dbPort,
    DB_USERNAME: process.env.DB_USERNAME!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
    DB_NAME: process.env.DB_NAME!,
    DB_SCHEMA: process.env.DB_SCHEMA || 'public',

    REDIS_HOST: process.env.REDIS_HOST!,
    REDIS_PORT: redisPort,

    SUMMARIZE_AI_URL: process.env.SUMMARIZE_AI_URL!,
    BIAS_ANALYSIS_AI_URL: process.env.BIAS_ANALYSIS_AI_URL!,
    CLASSIFICATION_AI_URL: process.env.CLASSIFICATION_AI_URL,

    SESSION_SECRET: process.env.SESSION_SECRET!,

    LOG_LEVEL: (process.env.LOG_LEVEL as EnvConfig['LOG_LEVEL']) || 'info',

    CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
  };

  // 검증 성공 로그
  logger.info(`✓ Environment validated: ${config.NODE_ENV}`);
  logger.info(`  - DB: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME} (schema: ${config.DB_SCHEMA})`);
  logger.info(`  - Redis: ${config.REDIS_HOST}:${config.REDIS_PORT}`);
  logger.info(`  - Port: ${config.PORT}`);

  return config;
}

// 환경 변수 검증 실행
let envConfig: EnvConfig;

try {
  envConfig = validateEnv();
} catch (error) {
  logger.error('Failed to validate environment variables:', error);
  process.exit(1);
}

// 검증된 환경 변수 export
export const env = envConfig;

// 기존 호환성을 위해 default export도 유지
export default result;
