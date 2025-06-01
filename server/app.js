// server/app.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const corsMiddleware = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const rainfallRoutes = require('./routes/rainfallRoutes');
const statusRoutes = require('./routes/statusRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const ipLocationRoutes = require('./routes/ipLocationRoutes');
const amapWeatherRoutes = require('./routes/amapWeatherRoutes');
 const wiperControlRoutes = require('./wiper-control');
const deviceActivationRoutes = require('./routes/deviceActivationRoutes');

// 创建Express应用
const app = express();

// 添加HTTP到HTTPS的重定向中间件
app.use((req, res, next) => {
  // 检查是否需要重定向到HTTPS
  // 注意：X-Forwarded-Proto 头是由代理服务器（如Nginx）添加的
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  // 如果环境变量设置为强制HTTPS，且当前不是HTTPS请求，则重定向
  if (process.env.FORCE_HTTPS === 'true' && !isSecure) {
    // 获取主机名和端口
    const host = req.headers.host.split(':')[0];
    const httpsPort = parseInt(config.server.port) + 1;

    // 重定向到HTTPS
    return res.redirect(`https://${host}:${httpsPort}${req.url}`);
  }

  next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '../dist')));

// 应用CORS中间件
corsMiddleware.forEach(middleware => app.use(middleware));

// 解析JSON请求体
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - 开始请求`);

  // 记录请求头
  console.log(`请求头: ${JSON.stringify(req.headers)}`);

  // 记录请求体（如果有）
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`请求体: ${JSON.stringify(req.body)}`);
  }

  // 捕获响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - 完成请求 - 状态: ${res.statusCode} - 耗时: ${duration}ms`);
  });

  next();
});

// 配置session
app.use(session({
  secret: config.server.secret_key,
  resave: false,
  saveUninitialized: false,
  cookie: {
    // 在开发环境中不强制使用secure，以便HTTP和HTTPS都能工作
    secure: false,
    // 允许跨站点cookie，以便前端能够正常工作
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/rainfall', rainfallRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/iplocation', ipLocationRoutes);
app.use('/api/amap', amapWeatherRoutes);
app.use('/api/wiper', wiperControlRoutes);
app.use('/api/device/activation', deviceActivationRoutes);

// 处理所有前端路由 - 必须放在所有API路由之后
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 应用错误处理中间件
app.use(errorHandler);

module.exports = app;
