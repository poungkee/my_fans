import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import logger from '../config/logger';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'fans-eks-frontend-907123164281';
const PROFILE_IMAGE_PATH = process.env.PROFILE_IMAGE_PATH || 'profile-images';

export async function uploadProfileImageToS3(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const key = `${PROFILE_IMAGE_PATH}/${timestamp}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    });

    await s3Client.send(command);

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

export async function deleteProfileImageFromS3(imageUrl: string): Promise<void> {
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

    await s3Client.send(command);
    logger.info(`Profile image deleted from S3: ${key}`);
  } catch (error) {
    logger.error('Failed to delete image from S3:', error);
    throw new Error('Failed to delete image from S3');
  }
}
