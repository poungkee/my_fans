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

export default result;