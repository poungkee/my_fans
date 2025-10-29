import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import logger from '../config/logger';
import * as fs from 'fs';
import * as path from 'path';

// S3 사용 여부 확인 (AWS_REGION 또는 AWS_S3_BUCKET이 있으면 S3 사용)
const USE_S3 = !!(process.env.AWS_REGION || process.env.AWS_S3_BUCKET);
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'fans-eks-frontend-907123164281';
const PROFILE_IMAGE_PATH = process.env.PROFILE_IMAGE_PATH || 'profile-images';
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../uploads/profiles');

// S3 클라이언트 (S3 사용 시에만 초기화)
let s3Client: S3Client | null = null;
if (USE_S3) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-northeast-2',
  });
}

// 로컬 파일시스템에 저장
async function uploadToLocal(buffer: Buffer, filename: string): Promise<string> {
  try {
    // uploads/profiles 디렉토리 확인 및 생성
    if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
      fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const localFilename = `profile-${timestamp}-${safeFilename}`;
    const localPath = path.join(LOCAL_UPLOAD_DIR, localFilename);

    // 파일 저장
    fs.writeFileSync(localPath, buffer);

    // 로컬 URL 반환 (프론트엔드에서 /uploads/profiles/filename으로 접근)
    const localUrl = `/uploads/profiles/${localFilename}`;
    logger.info(`Profile image uploaded locally: ${localUrl}`);

    return localUrl;
  } catch (error) {
    logger.error('Failed to upload image locally:', error);
    throw new Error('Failed to upload image locally');
  }
}

export async function uploadProfileImageToS3(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<string> {
  // 로컬 환경: 로컬 파일시스템 사용
  if (!USE_S3) {
    logger.info('Using local filesystem for profile image storage');
    return await uploadToLocal(buffer, filename);
  }

  // EKS/Production 환경: S3 사용
  try {
    const timestamp = Date.now();
    const key = `${PROFILE_IMAGE_PATH}/${timestamp}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    });

    await s3Client!.send(command);

    // key에서 profile-images/ 이후 부분만 추출 (파일명만)
    const fileName = key.split('/').slice(1).join('/');
    const s3Url = process.env.PROFILE_IMAGE_BASE_URL
      ? `${process.env.PROFILE_IMAGE_BASE_URL}/${fileName}`
      : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${key}`;

    logger.info(`Profile image uploaded to S3: ${s3Url}`);

    return s3Url;
  } catch (error) {
    logger.error('Failed to upload image to S3:', error);
    throw new Error('Failed to upload image to S3');
  }
}

export async function uploadProfileImageFromUrl(
  imageUrl: string,
  userId: number
): Promise<string> {
  try {
    const axios = require('axios');
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // 파일 확장자 추출 (URL 또는 Content-Type에서)
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const ext = contentType.split('/')[1] || 'jpg';
    const filename = `user-${userId}-profile.${ext}`;

    return await uploadProfileImageToS3(buffer, filename, contentType);
  } catch (error) {
    logger.error('Failed to download and upload profile image:', error);
    throw new Error('Failed to process profile image');
  }
}

// 로컬 파일 삭제
async function deleteFromLocal(imageUrl: string): Promise<void> {
  try {
    // URL에서 파일명 추출: /uploads/profiles/filename
    const filename = imageUrl.split('/').pop();
    if (!filename) {
      throw new Error('Invalid local image URL');
    }

    const localPath = path.join(LOCAL_UPLOAD_DIR, filename);

    // 파일 존재 확인 및 삭제
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      logger.info(`Profile image deleted locally: ${localPath}`);
    } else {
      logger.warn(`Profile image file not found: ${localPath}`);
    }
  } catch (error) {
    logger.error('Failed to delete image locally:', error);
    throw new Error('Failed to delete image locally');
  }
}

export async function deleteProfileImageFromS3(imageUrl: string): Promise<void> {
  // 로컬 환경: 로컬 파일시스템 사용
  if (!USE_S3) {
    logger.info('Deleting profile image from local filesystem');
    return await deleteFromLocal(imageUrl);
  }

  // EKS/Production 환경: S3 사용
  try {
    // S3 URL에서 Key 추출
    // URL 형식: https://BUCKET.s3.REGION.amazonaws.com/KEY 또는 https://BASE_URL/KEY
    const urlParts = new URL(imageUrl);
    const pathParts = urlParts.pathname.split('/').filter(Boolean);

    // profile-images/filename 형식으로 key 추출
    let key = '';
    if (pathParts.length >= 2 && pathParts[0] === 'profile-images') {
      key = pathParts.join('/');
    } else if (pathParts.length >= 1) {
      key = `${PROFILE_IMAGE_PATH}/${pathParts[pathParts.length - 1]}`;
    }

    if (!key) {
      throw new Error('Invalid S3 URL format');
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client!.send(command);
    logger.info(`Profile image deleted from S3: ${key}`);
  } catch (error) {
    logger.error('Failed to delete image from S3:', error);
    throw new Error('Failed to delete image from S3');
  }
}
