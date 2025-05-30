// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const config = require('../config');
const { executePythonScript } = require('../utils/pythonRunner');
const { maskSensitiveInfo } = require('../utils/securityUtils');
const { stopRainfallCollector, setShouldRestartCollector, startOneNetSync } = require('../services/rainfallCollector');

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('注册请求:', { username, passwordLength: password ? password.length : 0 });

    const dbScriptPath = path.join(__dirname, '..', config.paths.DB_SERVICE_SCRIPT);
    const result = await executePythonScript(dbScriptPath, 'register', { username, password });
    console.log('注册结果:', maskSensitiveInfo(result));

    if (result.success) {
      // 注册成功后，为新用户启动OneNET同步服务
      console.log(`用户 ${username} 注册成功，启动OneNET同步服务`);
      try {
        await startOneNetSync(username);
        console.log(`用户 ${username} 的OneNET同步服务启动成功`);
      } catch (error) {
        console.error(`为用户 ${username} 启动OneNET同步服务失败:`, error);
        // 不影响注册成功的响应
      }

      res.status(201).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('注册错误:', maskSensitiveInfo(error));
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    console.log('收到登录请求:', {
      headers: maskSensitiveInfo(req.headers),
      body: maskSensitiveInfo(req.body),
      origin: req.get('origin')
    });

    // 检查请求体是否为空
    if (!req.body) {
      console.error('请求体为空');
      return res.status(400).json({ error: "请求数据无效" });
    }

    const { username, password } = req.body;
    console.log('登录信息:', { username, passwordLength: password ? password.length : 0 });

    // 更详细的输入验证
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({ error: "用户名不能为空" });
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return res.status(400).json({ error: "密码不能为空" });
    }

    // 处理登录请求
    const dbScriptPath = path.join(__dirname, '..', config.paths.DB_SERVICE_SCRIPT);
    const result = await executePythonScript(dbScriptPath, 'login', {
      username: username.trim(),
      password: password.trim().replace(/"/g, '\\"').replace(/'/g, "\\'")
    });

    console.log('登录处理结果:', maskSensitiveInfo(result));

    if (result && result.success) {
      // 保存用户信息到session
      req.session.user = {
        user_id: result.user_id,
        username: result.username
      };

      // 详细输出用户信息和session信息
      console.log(`用户 ${result.username} 登录成功，用户ID: ${result.user_id}`);
      console.log('登录后的用户信息:', req.session.user);
      console.log('登录后的完整session:', req.session);

      // 登录时不再自动启动数据采集器
      // 设置不重启标志
      setShouldRestartCollector(false);
      console.log(`用户${result.username}登录，设置不重启标志`);

      res.json({
        message: result.message,
        user_id: result.user_id,
        username: result.username
      });
    } else if (result) {
      res.status(401).json({ error: result.error || "登录失败" });
    } else {
      res.status(500).json({ error: "服务器处理错误" });
    }
  } catch (error) {
    console.error('登录过程错误:', maskSensitiveInfo(error));
    res.status(500).json({ error: '服务器内部错误', details: error.message });
  }
});

// 用户登出
router.post('/logout', async (req, res) => {
  try {
    // 在销毁session前保存用户名
    const username = req.session.user ? req.session.user.username : 'admin';

    // 详细输出用户信息和session信息
    console.log(`用户登出，用户名: ${username}`);
    console.log('登出前的用户信息:', req.session.user);
    console.log('登出前的完整session:', req.session);

    // 先强制停止数据采集器，然后再销毁session
    setShouldRestartCollector(false);
    console.log('用户登出，设置不重启标志');

    // 停止数据采集器
    await stopRainfallCollector();

    // 销毁session
    await new Promise((resolve, reject) => {
      req.session.destroy(err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    res.json({ message: '登出成功，数据采集器已停止，数据库中的雨量数据保持不变' });
  } catch (error) {
    console.error('登出过程出错:', error);
    res.status(500).json({ error: '登出失败' });
  }
});

// 获取当前用户信息
router.get('/user', async (req, res) => {
  if (req.session.user) {
    try {
      // 从数据库获取最新的用户信息
      const dbScriptPath = path.join(__dirname, '..', config.paths.DB_SERVICE_SCRIPT);
      const result = await executePythonScript(dbScriptPath, 'get_user', { user_id: req.session.user.user_id });

      if (result.success) {
        res.json({
          user_id: result.user.id,
          username: result.user.username,
          created_at: result.user.created_at
        });
      } else {
        // 如果数据库查询失败，则返回session中的基本信息
        res.json(req.session.user);
      }
    } catch (error) {
      console.error('获取用户信息错误:', error);
      // 出错时返回session中的信息
      res.json(req.session.user);
    }
  } else {
    res.status(401).json({ error: '未登录' });
  }
});

module.exports = router;
