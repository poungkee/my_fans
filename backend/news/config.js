// backend/news/config.js
const dotenv = require('dotenv');
dotenv.config();

const config = {
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET,
  ALLOW_ORIGIN: process.env.ALLOW_ORIGIN || 'http://localhost:3000',
  PORT: process.env.PORT || 8000,
};

module.exports = config;
