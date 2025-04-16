// server/middleware/errorHandler.js
const { maskSensitiveInfo } = require('../utils/securityUtils');

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  console.error('服务器错误:', maskSensitiveInfo(err));
  
  // 发送错误响应
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误'
  });
};

module.exports = errorHandler;
