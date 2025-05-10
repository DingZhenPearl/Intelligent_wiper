// server/routes/rainfallRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { executePythonScript } = require('../utils/pythonRunner');
const { startRainfallCollector, stopRainfallCollector, setShouldRestartCollector } = require('../services/rainfallCollector');

// 数据源设置文件路径
const DATA_SOURCE_FILE = path.join(__dirname, '..', 'data', 'data_source_settings.json');

// 确保data目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 从文件加载数据源设置
let useOneNetSource = false;
try {
    if (fs.existsSync(DATA_SOURCE_FILE)) {
        const settings = JSON.parse(fs.readFileSync(DATA_SOURCE_FILE, 'utf8'));
        useOneNetSource = settings.useOneNetSource || false;
        console.log(`从文件加载数据源设置: ${useOneNetSource ? 'OneNET平台' : '本地数据库'}`);
    } else {
        console.log('数据源设置文件不存在，使用默认设置: 本地数据库');
    }
} catch (error) {
    console.error('加载数据源设置出错:', error);
    console.log('使用默认设置: 本地数据库');
}

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

// 从OneNET平台获取雨量数据
router.get('/onenet', async (req, res) => {
  try {
    console.log('从OneNET平台获取雨量数据');

    // 检查是否启用了OneNET数据源
    if (!useOneNetSource) {
      console.log('OneNET数据源未启用，返回错误');
      return res.status(400).json({
        success: false,
        error: 'OneNET数据源未启用'
      });
    }

    // 调用OneNET API脚本获取数据
    const oneNetApiScriptPath = path.join(__dirname, '..', config.paths.ONENET_API_SCRIPT);
    const result = await executePythonScript(oneNetApiScriptPath, 'get');

    if (result.success) {
      res.json(result);
    } else {
      // 检查是否是"未找到数据流"或"未找到数据点"的错误
      if (result.error && (
          result.error.includes('未找到数据流') ||
          result.error.includes('未找到数据点') ||
          result.error.includes('没有找到数据流')
        )) {
        console.log('OneNET平台未找到数据流或数据点，返回默认数据');
        // 返回成功状态，但包含默认数据和警告信息
        res.json({
          success: true,
          data: {
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            rainfall_value: 0,
            rainfall_level: 'none',
            rainfall_percentage: 0,
            source: 'OneNET',
            unit: 'mm/h'  // 明确标记单位
          },
          warning: '当前OneNET平台没有可用数据，显示默认值'
        });
      } else {
        // 其他错误仍然返回500状态码
        res.status(500).json({ error: result.error || '获取OneNET数据失败' });
      }
    }
  } catch (error) {
    console.error('获取OneNET雨量数据错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 从OneNET平台获取统计数据
router.get('/onenet/stats', async (req, res) => {
  try {
    const period = req.query.period || '10min';
    console.log(`从OneNET平台获取${period}统计数据`);

    // 检查是否启用了OneNET数据源
    if (!useOneNetSource) {
      console.log('OneNET数据源未启用，返回错误');
      return res.status(400).json({
        success: false,
        error: 'OneNET数据源未启用'
      });
    }

    // 调用OneNET数据聚合脚本获取数据
    // 脚本位于项目根目录下的python目录中
    const oneNetAggregatorScriptPath = path.join(__dirname, '..', '..', 'python', 'onenet_aggregator.py');
    console.log(`OneNET数据聚合脚本路径: ${oneNetAggregatorScriptPath}`);

    // 检查脚本文件是否存在
    const fs = require('fs');
    if (!fs.existsSync(oneNetAggregatorScriptPath)) {
      console.error(`OneNET数据聚合脚本不存在: ${oneNetAggregatorScriptPath}`);
      return res.status(500).json({ error: 'OneNET数据聚合脚本不存在' });
    }

    const result = await executePythonScript(oneNetAggregatorScriptPath, null, { period });

    if (result.success) {
      console.log(`成功获取OneNET ${period}聚合数据，数据点数量:`, result.data.length);
      res.json(result);
    } else {
      // 检查是否是"未找到任何数据点"的错误
      if (result.error && result.error.includes('未找到任何数据点')) {
        console.log(`OneNET平台未找到${period}数据点，返回空数据数组`);
        // 返回成功状态，但包含空数据数组和警告信息
        res.json({
          success: true,
          data: [],
          warning: `OneNET平台未找到${period}时间段的数据点`,
          unit: period === 'all' ? 'mm/天' : 'mm/h'  // 根据时间粒度设置单位
        });
      } else {
        // 其他错误仍然返回500状态码
        res.status(500).json({ error: result.error || `获取OneNET ${period}统计数据失败` });
      }
    }
  } catch (error) {
    console.error(`获取OneNET ${req.query.period || '10min'}统计数据错误:`, error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 切换数据源
router.post('/switch-source', async (req, res) => {
  try {
    const { useOneNet } = req.body;

    if (typeof useOneNet !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: '参数错误，useOneNet必须是布尔值'
      });
    }

    console.log(`切换数据源为: ${useOneNet ? 'OneNET平台' : '本地数据库'}`);

    // 更新全局设置
    useOneNetSource = useOneNet;

    // 将设置保存到文件
    try {
      fs.writeFileSync(DATA_SOURCE_FILE, JSON.stringify({ useOneNetSource: useOneNet }), 'utf8');
      console.log(`数据源设置已保存到文件: ${useOneNet ? 'OneNET平台' : '本地数据库'}`);
    } catch (saveError) {
      console.error('保存数据源设置出错:', saveError);
      // 继续执行，不影响数据源切换
    }

    // 如果切换到OneNET，停止本地数据采集器
    if (useOneNet) {
      try {
        console.log('切换到OneNET数据源，停止本地数据采集器');
        await stopRainfallCollector();
      } catch (stopError) {
        console.error('停止数据采集器错误:', stopError);
        // 继续执行，不影响数据源切换
      }
    }

    res.json({
      success: true,
      message: `数据源已切换为 ${useOneNet ? 'OneNET平台' : '本地数据库'}`
    });
  } catch (error) {
    console.error('切换数据源错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取当前数据源设置
router.get('/data-source', (_, res) => {
  try {
    console.log(`获取当前数据源设置: ${useOneNetSource ? 'OneNET平台' : '本地数据库'}`);

    res.json({
      success: true,
      useOneNetSource: useOneNetSource
    });
  } catch (error) {
    console.error('获取数据源设置错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 手动触发数据聚合
router.get('/aggregate', async (req, res) => {
  try {
    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`手动触发数据聚合，传入的用户名: ${username}`);
    console.log(`手动触发数据聚合，请求参数: ${JSON.stringify(req.query)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    // 调用聚合脚本
    const rainfallDbScriptPath = path.join(__dirname, '..', config.paths.RAINFALL_DB_SCRIPT);
    const result = await executePythonScript(rainfallDbScriptPath, 'aggregate', { username });

    if (result.success) {
      res.json({
        success: true,
        message: '数据聚合成功',
        details: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || '数据聚合失败',
        details: result
      });
    }
  } catch (error) {
    console.error('手动触发数据聚合错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
