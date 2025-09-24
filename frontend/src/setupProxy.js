const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  const aiServiceUrl = process.env.REACT_APP_AI_SERVICE_URL || 'http://localhost:8000';

  console.log('Proxy configuration:');
  console.log('API URL:', apiUrl);
  console.log('AI Service URL:', aiServiceUrl);

  // API 프록시 설정
  app.use(
    '/api',
    createProxyMiddleware({
      target: apiUrl,
      changeOrigin: true,
      logLevel: 'debug'
    })
  );

  // AI 서비스 프록시 설정
  app.use(
    '/ai',
    createProxyMiddleware({
      target: aiServiceUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/ai': ''
      },
      logLevel: 'debug'
    })
  );
};