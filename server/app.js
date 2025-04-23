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

// 创建Express应用
const app = express();

// 静态文件服务
app.use(express.static(path.join(__dirname, '../dist')));

// 应用CORS中间件
corsMiddleware.forEach(middleware => app.use(middleware));

// 解析JSON请求体
app.use(express.json());

// 配置session
app.use(session({
  secret: config.server.secret_key,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    sameSite: 'none', // 允许跨站点cookie
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/rainfall', rainfallRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/weather', weatherRoutes);

// 处理所有前端路由 - 必须放在所有API路由之后
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 应用错误处理中间件
app.use(errorHandler);

module.exports = app;
