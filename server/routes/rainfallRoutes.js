// server/routes/rainfallRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { executePythonScript } = require('../utils/pythonRunner');
const {
  startRainfallCollector,
  stopRainfallCollector,
  setShouldRestartCollector,
  startOneNetSync,
  stopOneNetSync,
  setShouldRestartOneNetSync
} = require('../services/rainfallCollector');

// 确保data目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 默认使用OneNET数据源
const useOneNetSource = true;

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

// 从OneNET平台获取雨量数据（现在从本地数据库获取）
router.get('/onenet', async (req, res) => {
  try {
    console.log('从本地数据库获取最新雨量数据（OneNET同步）');

    // 检查是否启用了OneNET数据源
    if (!useOneNetSource) {
      console.log('OneNET数据源未启用，返回错误');
      return res.status(400).json({
        success: false,
        error: 'OneNET数据源未启用'
      });
    }

    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`获取OneNET同步的雨量数据，用户名: '${username}'`);

    // 调用雨量API脚本获取最新数据
    const rainfallApiScriptPath = path.join(__dirname, '..', config.paths.RAINFALL_API_SCRIPT);
    const result = await executePythonScript(rainfallApiScriptPath, 'home', { username });

    if (result.success) {
      // 添加数据源标记
      if (result.data) {
        result.data.source = 'OneNET';
      }
      res.json(result);
    } else {
      // 如果没有数据，返回默认值
      console.log('本地数据库中没有OneNET同步的数据，返回默认数据');
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
        warning: '当前本地数据库中没有OneNET同步的数据，显示默认值'
      });
    }
  } catch (error) {
    console.error('获取OneNET同步的雨量数据错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 从OneNET平台获取统计数据（现在从本地数据库获取）
router.get('/onenet/stats', async (req, res) => {
  try {
    const period = req.query.period || '10min';
    console.log(`从本地数据库获取${period}统计数据（OneNET同步）`);

    // 检查是否启用了OneNET数据源
    if (!useOneNetSource) {
      console.log('OneNET数据源未启用，返回错误');
      return res.status(400).json({
        success: false,
        error: 'OneNET数据源未启用'
      });
    }

    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`获取OneNET同步的${period}统计数据，用户名: '${username}'`);

    // 调用雨量API脚本获取统计数据
    const rainfallApiScriptPath = path.join(__dirname, '..', config.paths.RAINFALL_API_SCRIPT);
    const result = await executePythonScript(rainfallApiScriptPath, 'stats', { username, period });

    if (result.success) {
      // 添加数据源标记
      result.source = 'OneNET';
      console.log(`成功获取OneNET同步的${period}统计数据，数据点数量:`, result.data ? result.data.length : 0);
      res.json(result);
    } else {
      // 如果没有数据，返回空数组
      console.log(`本地数据库中没有OneNET同步的${period}统计数据，返回空数据数组`);
      res.json({
        success: true,
        data: [],
        warning: `本地数据库中没有OneNET同步的${period}时间段的数据点`,
        unit: period === 'all' ? 'mm/天' : 'mm/h',  // 根据时间粒度设置单位
        source: 'OneNET'
      });
    }
  } catch (error) {
    console.error(`获取OneNET同步的${req.query.period || '10min'}统计数据错误:`, error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取当前数据源设置 (始终返回OneNET数据源)
router.get('/data-source', (_, res) => {
  try {
    console.log('获取当前数据源设置: OneNET平台');

    res.json({
      success: true,
      useOneNetSource: true
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

// 启动OneNET同步服务
router.get('/onenet/sync/start', async (req, res) => {
  try {
    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`启动OneNET同步服务，传入的用户名: ${username}`);
    console.log(`启动OneNET同步服务，请求参数: ${JSON.stringify(req.query)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    // 检查是否启用了OneNET数据源
    if (!useOneNetSource) {
      console.log('OneNET数据源未启用，先启用OneNET数据源');
      // 更新全局设置
      useOneNetSource = true;

      // 将设置保存到文件
      try {
        fs.writeFileSync(DATA_SOURCE_FILE, JSON.stringify({ useOneNetSource: true }), 'utf8');
        console.log('数据源设置已保存到文件: OneNET平台');
      } catch (saveError) {
        console.error('保存数据源设置出错:', saveError);
        // 继续执行，不影响同步服务启动
      }
    }

    // 停止本地数据采集器
    console.log('停止本地数据采集器');
    await stopRainfallCollector();

    // 设置重启标志为true
    setShouldRestartOneNetSync(true);
    console.log('设置重启标志为true，允许OneNET同步服务自动重启');

    // 启动OneNET同步服务
    console.log(`准备启动OneNET同步服务，用户: ${username}`);
    await startOneNetSync(username);

    res.json({
      success: true,
      message: 'OneNET同步服务已启动，将每5秒从OneNET平台同步一次数据'
    });
  } catch (error) {
    console.error('启动OneNET同步服务错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 停止OneNET同步服务
router.get('/onenet/sync/stop', async (req, res) => {
  try {
    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`停止OneNET同步服务，传入的用户名: ${username}`);
    console.log(`停止OneNET同步服务，请求参数: ${JSON.stringify(req.query)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    // 停止OneNET同步服务
    console.log(`调用stopOneNetSync函数，用户名: ${username}`);
    const result = await stopOneNetSync(username);
    console.log(`stopOneNetSync函数返回结果:`, result);

    res.json({
      success: true,
      message: 'OneNET同步服务已强制停止，数据库中的数据保持不变'
    });
  } catch (error) {
    console.error('停止OneNET同步服务错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 手动执行一次OneNET数据同步
router.get('/onenet/sync/once', async (req, res) => {
  try {
    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`手动执行一次OneNET数据同步，传入的用户名: ${username}`);
    console.log(`手动执行一次OneNET数据同步，请求参数: ${JSON.stringify(req.query)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    // 调用OneNET同步脚本执行一次同步
    const oneNetSyncScriptPath = path.join(__dirname, '..', '..', 'python', 'onenet_sync.py');
    console.log(`OneNET同步脚本路径: ${oneNetSyncScriptPath}`);

    // 检查脚本文件是否存在
    if (!fs.existsSync(oneNetSyncScriptPath)) {
      console.error(`OneNET同步脚本不存在: ${oneNetSyncScriptPath}`);
      return res.status(500).json({ error: 'OneNET同步脚本不存在' });
    }

    const result = await executePythonScript(oneNetSyncScriptPath, 'sync_once', { username });

    if (result.success) {
      res.json({
        success: true,
        message: `OneNET数据同步成功，同步了 ${result.synced_count || 0} 条数据，跳过了 ${result.skipped_count || 0} 条重复数据${result.aggregated ? '，并完成数据聚合' : ''}`,
        details: result.message,
        synced_count: result.synced_count || 0,
        skipped_count: result.skipped_count || 0,
        aggregated: result.aggregated || false,
        aggregate_error: result.aggregate_error
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'OneNET数据同步失败',
        details: result
      });
    }
  } catch (error) {
    console.error('手动执行OneNET数据同步错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 直接从OneNET平台获取原始数据
router.get('/onenet/raw', async (req, res) => {
  try {
    console.log('直接从OneNET平台获取原始数据');

    // 检查是否启用了OneNET数据源
    if (!useOneNetSource) {
      console.log('OneNET数据源未启用，返回错误');
      return res.status(400).json({
        success: false,
        error: 'OneNET数据源未启用'
      });
    }

    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`直接获取OneNET原始数据，用户名: '${username}'`);

    // 获取时间范围参数，默认获取过去1小时的数据
    const timeRange = req.query.timeRange || '1h';
    console.log(`获取OneNET原始数据，时间范围: ${timeRange}`);

    // 调用OneNET同步脚本获取原始数据
    const oneNetSyncScriptPath = path.join(__dirname, '..', '..', 'python', 'onenet_sync.py');
    console.log(`OneNET同步脚本路径: ${oneNetSyncScriptPath}`);

    // 检查脚本文件是否存在
    if (!fs.existsSync(oneNetSyncScriptPath)) {
      console.error(`OneNET同步脚本不存在: ${oneNetSyncScriptPath}`);
      return res.status(500).json({ error: 'OneNET同步脚本不存在' });
    }

    const result = await executePythonScript(oneNetSyncScriptPath, 'get_raw_data', { username, timeRange });

    if (result.success) {
      console.log(`成功获取OneNET原始数据，数据点数量:`, result.datapoints ? result.datapoints.length : 0);
      res.json({
        success: true,
        datapoints: result.datapoints || [],
        message: result.message
      });
    } else {
      console.error('获取OneNET原始数据失败:', result.error);
      res.status(500).json({
        success: false,
        error: result.error || '获取OneNET原始数据失败'
      });
    }
  } catch (error) {
    console.error('获取OneNET原始数据错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
