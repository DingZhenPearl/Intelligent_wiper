// server/middleware/cors.js
const cors = require('cors');

// CORS配置中间件
const corsMiddleware = [
  // 修改CORS配置，允许来自任何来源的请求
  cors({
    origin: '*', // 允许所有来源
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false // 禁用credentials以避免跨域问题
  }),

  // 确保每个响应都包含CORS头部
  (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // 对OPTIONS请求直接返回200
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  }
];

module.exports = corsMiddleware;
