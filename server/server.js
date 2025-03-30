const express = require('express');
const cors = require('cors');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const config = require('./config.json');

const app = express();

// 静态文件服务
app.use(express.static(path.join(__dirname, '../dist')));

// 中间件配置
app.use(cors({
  origin: `http://${config.server.host}:8080`,
  credentials: true
}));

app.use(express.json());
app.use(session({
  secret: config.server.secret_key,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// Python服务地址
const PYTHON_SERVICE = `http://${config.python_service.host}:${config.python_service.port}`;

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const response = await axios.post(`${PYTHON_SERVICE}/auth/register`, req.body);
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const response = await axios.post(`${PYTHON_SERVICE}/auth/login`, req.body);
    if (response.status === 200) {
      req.session.user = response.data;
      res.json(response.data);
    } else {
      res.status(response.status).json(response.data);
    }
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
});

// 用户登出
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: '登出失败' });
    } else {
      res.json({ message: '登出成功' });
    }
  });
});

// 获取当前用户信息
app.get('/api/auth/user', (req, res) => {
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: '未登录' });
  }
});

// 处理所有前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 启动服务器
app.listen(config.server.port, config.server.host, () => {
  console.log(`服务器运行在 http://${config.server.host}:${config.server.port}`);
});