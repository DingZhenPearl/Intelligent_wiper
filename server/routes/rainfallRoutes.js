// server/routes/rainfallRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const config = require('../config');
const { executePythonScript } = require('../utils/pythonRunner');
const { startRainfallCollector, stopRainfallCollector, setShouldRestartCollector } = require('../services/rainfallCollector');

// 获取统计页面数据
router.get('/stats', async (req, res) => {
  try {
    const period = req.query.period || '10min';
    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`获取雨量统计数据，传入的用户名: ${username}, 时间粒度: ${period}`);
    console.log(`获取雨量统计数据，请求参数: ${JSON.stringify(req.query)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    const rainfallApiScriptPath = path.join(__dirname, '..', config.paths.RAINFALL_API_SCRIPT);
    const result = await executePythonScript(rainfallApiScriptPath, 'stats', { username, period });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error || '获取数据失败' });
    }
  } catch (error) {
    console.error('获取雨量统计数据错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 生成模拟数据
router.get('/mock', async (req, res) => {
  try {
    const days = req.query.days || 7;
    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`初始化模拟数据，传入的用户名: ${username}`);
    console.log(`初始化模拟数据，请求参数: ${JSON.stringify(req.query)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    // 初始化模拟数据，不再清除现有数据
    console.log(`初始化模拟数据，保留用户 ${username} 的历史数据`);
    const rainfallDbScriptPath = path.join(__dirname, '..', config.paths.RAINFALL_DB_SCRIPT);
    const result = await executePythonScript(rainfallDbScriptPath, 'mock', { username, days });

    if (result.success) {
      // 设置重启标志为true
      setShouldRestartCollector(true);
      console.log('设置重启标志为true，允许数据采集器自动重启');

      // 直接启动新的数据采集器，它会先终止所有现有的Python进程
      console.log(`准备启动新的数据采集器，用户: ${username}`);
      await startRainfallCollector(username);

      res.json({
        success: true,
        message: `模拟数据已初始化，数据采集器已启动，将每5秒生成一个新数据点`
      });
    } else {
      res.status(500).json({ error: result.error || '初始化模拟数据失败' });
    }
  } catch (error) {
    console.error('初始化模拟数据错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 停止数据采集器
router.get('/stop', async (req, res) => {
  try {
    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`停止数据采集器，传入的用户名: ${username}`);
    console.log(`停止数据采集器，请求参数: ${JSON.stringify(req.query)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    // 停止数据采集器，传递用户名
    console.log(`调用stopRainfallCollector函数，用户名: ${username}`);
    const result = await stopRainfallCollector(username);
    console.log(`stopRainfallCollector函数返回结果:`, result);

    res.json({
      success: true,
      message: '数据采集器已强制停止，数据库中的雨量数据保持不变'
    });
  } catch (error) {
    console.error('停止数据采集器错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取首页实时雨量数据
router.get('/home', async (req, res) => {
  try {
    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`获取首页实时雨量数据，传入的用户名: ${username}`);
    console.log(`获取首页实时雨量数据，请求参数: ${JSON.stringify(req.query)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    const rainfallApiScriptPath = path.join(__dirname, '..', config.paths.RAINFALL_API_SCRIPT);
    const result = await executePythonScript(rainfallApiScriptPath, 'home', { username });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error || '获取数据失败' });
    }
  } catch (error) {
    console.error('获取首页雨量数据错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
