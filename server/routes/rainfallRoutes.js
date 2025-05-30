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

// 数据源设置文件
const DATA_SOURCE_FILE = path.join(dataDir, 'data_source_settings.json');

// 始终使用OneNET数据源
let useOneNetSource = true;

// 确保数据源设置文件存在并设置为使用OneNET数据源
try {
  // 如果文件不存在或者存在但设置不是true，则创建/更新设置文件
  fs.writeFileSync(DATA_SOURCE_FILE, JSON.stringify({ useOneNetSource: true }), 'utf8');
  console.log('已确保数据源设置为使用OneNET平台');
} catch (error) {
  console.error('创建或更新数据源设置文件时出错:', error);
  // 出错时仍然使用默认值
  useOneNetSource = true;
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

// 从OneNET平台获取雨量数据（现在从本地数据库获取）
router.get('/onenet', async (req, res) => {
  try {
    console.log('从本地数据库获取最新雨量数据（OneNET同步）');

    // OneNET数据源始终启用
    useOneNetSource = true; // 确保始终启用

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

    // OneNET数据源始终启用
    useOneNetSource = true; // 确保始终启用

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

    // OneNET数据源始终启用
    useOneNetSource = true; // 确保始终启用

    // 将设置保存到文件
    try {
      fs.writeFileSync(DATA_SOURCE_FILE, JSON.stringify({ useOneNetSource: true }), 'utf8');
      console.log('数据源设置已保存到文件: OneNET平台');
    } catch (saveError) {
      console.error('保存数据源设置出错:', saveError);
      // 继续执行，不影响同步服务启动
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

    // OneNET数据源始终启用
    useOneNetSource = true; // 确保始终启用

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

// 设置OneNET自动同步状态
router.get('/onenet/sync/enable', async (req, res) => {
  try {
    // 获取启用状态参数
    const enabled = req.query.enabled === 'true' || req.query.enabled === true;

    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`设置OneNET自动同步状态，传入的用户名: ${username}，启用状态: ${enabled}`);
    console.log(`设置OneNET自动同步状态，请求参数: ${JSON.stringify(req.query)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    // 将设置保存到配置文件或数据库中
    // 这里假设我们使用一个文件来保存设置
    const settingsFilePath = path.join(__dirname, '..', 'data', 'onenet_sync_settings.json');

    // 读取现有设置或创建新的
    let settings = {};
    try {
      if (fs.existsSync(settingsFilePath)) {
        settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
      }
    } catch (readError) {
      console.error('读取OneNET同步设置文件出错:', readError);
      // 继续使用空设置对象
    }

    // 更新设置
    settings.autoSync = enabled;

    // 保存设置
    try {
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`OneNET自动同步设置已保存: ${enabled ? '开启' : '关闭'}`);
    } catch (writeError) {
      console.error('保存OneNET同步设置出错:', writeError);
      return res.status(500).json({ error: '保存设置失败' });
    }

    // 如果禁用自动同步，但OneNET同步服务正在运行，则停止它
    if (!enabled) {
      const { getCollectorStatus, stopOneNetSync, setShouldRestartOneNetSync } = require('../services/rainfallCollector');
      const status = getCollectorStatus();

      if (status.isOneNetSyncRunning) {
        console.log('禁用自动同步，停止现有的OneNET同步服务');
        // 设置不要自动重启
        setShouldRestartOneNetSync(false);
        // 停止同步服务
        await stopOneNetSync(username);
      } else {
        console.log('OneNET同步服务未运行，只需设置不要自动重启');
        setShouldRestartOneNetSync(false);
      }
    } else {
      // 如果启用自动同步，设置自动重启标志
      const { setShouldRestartOneNetSync } = require('../services/rainfallCollector');
      setShouldRestartOneNetSync(true);
      console.log('启用自动同步，设置OneNET同步服务自动重启标志');
    }

    res.json({
      success: true,
      message: `OneNET自动同步已${enabled ? '开启' : '关闭'}`
    });
  } catch (error) {
    console.error('设置OneNET自动同步状态错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取OneNET同步状态
router.get('/onenet/sync/status', async (_, res) => {
  try {
    console.log('获取OneNET同步状态');

    // 将设置保存到配置文件或数据库中
    const settingsFilePath = path.join(__dirname, '..', 'data', 'onenet_sync_settings.json');

    // 读取设置文件
    let autoSync = true; // 默认值
    try {
      if (fs.existsSync(settingsFilePath)) {
        const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
        if (settings && settings.autoSync !== undefined) {
          autoSync = settings.autoSync;
        }
      }
    } catch (readError) {
      console.error('读取OneNET同步设置文件出错:', readError);
      // 继续使用默认值
    }

    // 获取服务运行状态
    const { getCollectorStatus } = require('../services/rainfallCollector');
    const status = getCollectorStatus();

    res.json({
      success: true,
      autoSync,
      isRunning: status.isOneNetSyncRunning,
      shouldRestart: status.shouldRestartOneNetSync
    });
  } catch (error) {
    console.error('获取OneNET同步状态错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 为用户创建OneNET数据流
router.post('/onenet/datastream/create', async (req, res) => {
  try {
    // 使用前端传递的用户名，而不是从 session 中获取
    let username = req.body.username || req.query.username || (req.session.user ? req.session.user.username : 'admin');

    // 详细输出用户信息
    console.log(`为用户创建OneNET数据流，传入的用户名: ${username}`);
    console.log(`创建数据流请求参数: ${JSON.stringify(req.body)}`);

    // 确保用户名不为空
    if (!username || username.trim() === '') {
      username = 'admin';
    } else {
      username = username.trim();
    }
    console.log(`最终使用的用户名: '${username}'`);

    // 调用OneNET API脚本创建数据流
    const oneNetApiScriptPath = path.join(__dirname, '..', '..', 'python', 'onenet_api.py');
    console.log(`OneNET API脚本路径: ${oneNetApiScriptPath}`);

    // 检查脚本文件是否存在
    if (!fs.existsSync(oneNetApiScriptPath)) {
      console.error(`OneNET API脚本不存在: ${oneNetApiScriptPath}`);
      return res.status(500).json({ error: 'OneNET API脚本不存在' });
    }

    const result = await executePythonScript(oneNetApiScriptPath, 'create_datastream', { username });

    if (result.success) {
      res.json({
        success: true,
        message: `成功为用户 ${username} 创建OneNET数据流: ${result.datastream_id}`,
        device_name: result.device_name,
        datastream_id: result.datastream_id
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || '创建OneNET数据流失败'
      });
    }
  } catch (error) {
    console.error('创建OneNET数据流错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
