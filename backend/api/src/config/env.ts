import dotenv from 'dotenv';
import path from 'path';

// Load environment variables as early as possible
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Failed to load .env file:', result.error.message);
} else {
  console.log('[ENV] Environment variables loaded successfully');
}

export default result;