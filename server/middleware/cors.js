// server/middleware/cors.js
const cors = require('cors');

// CORS配置中间件
const corsMiddleware = [
  // 动态CORS配置，根据请求来源设置
  (req, res, next) => {
    // 获取请求的来源
    const origin = req.headers.origin;

    // 创建动态CORS配置
    const corsOptions = {
      origin: origin || '*', // 使用请求的来源，如果没有则允许所有来源
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true // 启用credentials以支持cookies
    };

    // 应用CORS配置
    cors(corsOptions)(req, res, next);
  },

  // 确保每个响应都包含正确的CORS头部
  (req, res, next) => {
    // 获取请求的来源
    const origin = req.headers.origin;

    if (origin) {
      // 如果有来源，设置为特定来源
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      // 否则允许所有来源
      res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    // 对OPTIONS请求直接返回200
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  }
];

module.exports = corsMiddleware;
