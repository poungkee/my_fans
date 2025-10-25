import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import logger from '../config/logger';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
});

const BUCKET_NAME = 'fans-profile-images-907123164281';

export async function uploadProfileImageToS3(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<string> {
  try {
    const key = `profile-images/${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    });

    await s3Client.send(command);

    const s3Url = `https://${BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/${key}`;
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
