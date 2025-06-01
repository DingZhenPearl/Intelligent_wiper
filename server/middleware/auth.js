// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 统一认证中间件 - 支持session和token两种认证方式
 * Web端使用session，原生应用使用token
 */
const authMiddleware = (req, res, next) => {
  try {
    console.log(`🔐 [认证中间件] 验证请求: ${req.method} ${req.url}`);
    
    // 检查Authorization头中的token（原生应用）
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    // 检测客户端类型
    const isNativeApp = req.headers['x-capacitor-platform'] || 
                       req.headers['user-agent']?.includes('CapacitorHttp') ||
                       req.headers['x-user-name'] ||
                       token; // 如果有token，认为是原生应用

    console.log(`🔍 [认证中间件] 客户端类型: ${isNativeApp ? '原生应用' : 'Web浏览器'}`);

    if (isNativeApp && token) {
      // 原生应用：验证token
      try {
        const decoded = jwt.verify(token, config.server.secret_key);
        req.user = {
          user_id: decoded.user_id,
          username: decoded.username
        };
        console.log(`✅ [认证中间件] Token验证成功，用户: ${decoded.username}`);
        return next();
      } catch (tokenError) {
        console.error('🚫 [认证中间件] Token验证失败:', tokenError.message);
        return res.status(401).json({ 
          error: 'Token无效或已过期',
          auth_type: 'token'
        });
      }
    } else if (!isNativeApp && req.session && req.session.user) {
      // Web浏览器：验证session
      req.user = req.session.user;
      console.log(`✅ [认证中间件] Session验证成功，用户: ${req.session.user.username}`);
      return next();
    } else {
      // 认证失败
      console.log('🚫 [认证中间件] 认证失败 - 无有效的session或token');
      return res.status(401).json({ 
        error: '未登录或认证已过期',
        auth_type: isNativeApp ? 'token' : 'session'
      });
    }
  } catch (error) {
    console.error('🚫 [认证中间件] 认证过程出错:', error);
    return res.status(500).json({ error: '认证服务错误' });
  }
};

/**
 * 可选认证中间件 - 不强制要求认证，但如果有认证信息会解析
 */
const optionalAuthMiddleware = (req, res, next) => {
  try {
    // 检查Authorization头中的token
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    const isNativeApp = req.headers['x-capacitor-platform'] || 
                       req.headers['user-agent']?.includes('CapacitorHttp') ||
                       req.headers['x-user-name'] ||
                       token;

    if (isNativeApp && token) {
      // 尝试验证token
      try {
        const decoded = jwt.verify(token, config.server.secret_key);
        req.user = {
          user_id: decoded.user_id,
          username: decoded.username
        };
        console.log(`✅ [可选认证] Token验证成功，用户: ${decoded.username}`);
      } catch (tokenError) {
        console.log(`⚠️ [可选认证] Token验证失败: ${tokenError.message}`);
        req.user = null;
      }
    } else if (!isNativeApp && req.session && req.session.user) {
      // 使用session信息
      req.user = req.session.user;
      console.log(`✅ [可选认证] Session验证成功，用户: ${req.session.user.username}`);
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    console.error('⚠️ [可选认证] 认证过程出错:', error);
    req.user = null;
    next();
  }
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};
