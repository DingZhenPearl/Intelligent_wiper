/**
 * 雨刷控制API接口
 * 提供通过OneNET平台控制雨刷的功能
 *
 * 🔧 重要更新：已完全改为HTTP同步命令控制
 * - ✅ 已从MQTT命令下发改为HTTP同步命令API
 * - ✅ 使用OneNET HTTP同步命令API实现实时设备控制
 * - ✅ 支持5-30秒的超时时间设置
 * - ✅ 实时获取设备响应，无需等待MQTT回复
 * - ✅ API接口保持不变，确保前端无需修改
 * - ✅ 使用正确的用户级鉴权和API格式
 *
 * API端点：
 * 1. 雨刷状态控制 (POST /api/wiper/control) - 使用HTTP同步命令
 * 2. 雨刷状态查询 (GET /api/wiper/status) - 使用HTTP同步命令
 * 3. API方式控制 (POST /api/wiper/api-control) - 使用HTTP同步命令
 * 4. HTTP同步命令状态查询 (POST /api/wiper/get-status-cmd) - 使用HTTP同步命令
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { authMiddleware } = require('./middleware/auth');
const router = express.Router();

// Python脚本路径
const HTTP_CONTROL_SCRIPT = path.join(__dirname, '../python/onenet_http_control.py');
const MQTT_SCRIPT = path.join(__dirname, '../python/onenet_mqtt_control.py'); // 保留MQTT脚本作为备用
const TEST_SCRIPT = path.join(__dirname, '../python/test_mqtt_control.py');

/**
 * 获取雨刷状态
 * GET /api/wiper/status
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    console.log('获取雨刷状态');

    // 🔧 使用认证中间件获取用户信息
    const username = req.user?.username;
    console.log(`🎯 为已登录用户 ${username} 获取雨刷状态`);

    // 🔧 更新：使用HTTP同步命令获取状态
    const python = spawn('python', [HTTP_CONTROL_SCRIPT, '--action', 'status', '--username', username, '--timeout', '10']);

    let dataString = '';
    let errorString = '';

    // 收集标准输出
    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    // 收集标准错误
    python.stderr.on('data', (data) => {
      const output = data.toString();
      errorString += output;

      // 区分日志和真正的错误
      if (output.trim().startsWith('LOG:')) {
        console.log(`Python日志: ${output.trim()}`);  // 作为普通日志输出
      } else {
        console.error(`Python错误: ${output}`);  // 真正的错误
      }
    });

    // 脚本执行完成
    python.on('close', (code) => {
      console.log(`Python脚本退出，状态码: ${code}`);

      if (code !== 0) {
        return res.status(500).json({
          success: false,
          error: `Python脚本执行失败，状态码: ${code}`,
          details: errorString
        });
      }

      try {
        // 解析Python脚本的输出
        const result = JSON.parse(dataString);
        return res.json(result);
      } catch (error) {
        console.error('解析Python输出失败:', error);
        return res.status(500).json({
          success: false,
          error: '解析Python输出失败',
          details: error.message,
          output: dataString
        });
      }
    });
  } catch (error) {
    console.error('获取雨刷状态失败:', error);
    return res.status(500).json({
      success: false,
      error: '获取雨刷状态失败',
      details: error.message
    });
  }
});

/**
 * 控制雨刷（使用HTTP同步命令）
 * POST /api/wiper/control
 * 请求体: { status: 'off' | 'low' | 'medium' | 'high' }
 *
 * 🔧 更新：使用OneNET HTTP同步命令API实现实时设备控制
 */
router.post('/control', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    // 验证状态值
    const validStatuses = ['off', 'interval', 'low', 'high', 'smart'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的雨刷状态',
        details: `状态必须是以下值之一: ${validStatuses.join(', ')}`
      });
    }

    // 🔧 使用认证中间件获取用户信息
    const username = req.user?.username;
    console.log(`🎯 为已登录用户 ${username} 控制雨刷: ${status}`);

    // 🔧 更新：使用HTTP同步命令控制雨刷
    const python = spawn('python', [HTTP_CONTROL_SCRIPT, '--action', 'control', '--status', status, '--username', username, '--timeout', '15']);

    let dataString = '';
    let errorString = '';

    // 收集标准输出
    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    // 收集标准错误
    python.stderr.on('data', (data) => {
      const output = data.toString();
      errorString += output;

      // 区分日志和真正的错误
      if (output.trim().startsWith('LOG:')) {
        console.log(`Python日志: ${output.trim()}`);  // 作为普通日志输出
      } else {
        console.error(`Python错误: ${output}`);  // 真正的错误
      }
    });

    // 脚本执行完成
    python.on('close', (code) => {
      console.log(`Python脚本退出，状态码: ${code}`);

      if (code !== 0) {
        return res.status(500).json({
          success: false,
          error: `Python脚本执行失败，状态码: ${code}`,
          details: errorString
        });
      }

      try {
        // 解析Python脚本的输出
        const result = JSON.parse(dataString);
        return res.json(result);
      } catch (error) {
        console.error('解析Python输出失败:', error);
        return res.status(500).json({
          success: false,
          error: '解析Python输出失败',
          details: error.message,
          output: dataString
        });
      }
    });
  } catch (error) {
    console.error('控制雨刷失败:', error);
    return res.status(500).json({
      success: false,
      error: '控制雨刷失败',
      details: error.message
    });
  }
});

/**
 * 使用HTTP同步命令API控制雨刷
 * POST /api/wiper/api-control
 * 请求体: { command: 'off' | 'low' | 'medium' | 'high' }
 *
 * 🔧 更新：使用OneNET HTTP同步命令API实现实时设备控制
 */
router.post('/api-control', authMiddleware, async (req, res) => {
  try {
    const { command } = req.body;

    // 验证命令值
    const validCommands = ['off', 'interval', 'low', 'high', 'smart'];
    if (!command || !validCommands.includes(command)) {
      return res.status(400).json({
        success: false,
        error: '无效的雨刷命令',
        details: `命令必须是以下值之一: ${validCommands.join(', ')}`
      });
    }

    // 🔧 使用认证中间件获取用户信息
    const username = req.user?.username;
    console.log(`🎯 通过API为已登录用户 ${username} 控制雨刷: ${command}`);

    // 🔧 更新：使用HTTP同步命令API控制雨刷
    const python = spawn('python', [HTTP_CONTROL_SCRIPT, '--action', 'control', '--status', command, '--username', username, '--timeout', '15']);

    let dataString = '';
    let errorString = '';

    // 收集标准输出
    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    // 收集标准错误
    python.stderr.on('data', (data) => {
      const output = data.toString();
      errorString += output;

      // 区分日志和真正的错误
      if (output.trim().startsWith('LOG:')) {
        console.log(`Python日志: ${output.trim()}`);  // 作为普通日志输出
      } else {
        console.error(`Python错误: ${output}`);  // 真正的错误
      }
    });

    // 脚本执行完成
    python.on('close', (code) => {
      console.log(`Python脚本退出，状态码: ${code}`);

      if (code !== 0) {
        return res.status(500).json({
          success: false,
          error: `Python脚本执行失败，状态码: ${code}`,
          details: errorString
        });
      }

      try {
        // 解析Python脚本的输出
        const result = JSON.parse(dataString);
        return res.json(result);
      } catch (error) {
        console.error('解析Python输出失败:', error);
        return res.status(500).json({
          success: false,
          error: '解析Python输出失败',
          details: error.message,
          output: dataString
        });
      }
    });
  } catch (error) {
    console.error('通过API控制雨刷失败:', error);
    return res.status(500).json({
      success: false,
      error: '通过API控制雨刷失败',
      details: error.message
    });
  }
});

/**
 * 启动MQTT服务
 * POST /api/wiper/start-service
 */
router.post('/start-service', authMiddleware, async (req, res) => {
  try {
    // 🔧 使用认证中间件获取用户信息
    const username = req.user?.username;
    console.log(`🎯 为已登录用户 ${username} 启动MQTT控制服务`);

    // 调用Python脚本启动MQTT服务，传入用户名
    const python = spawn('python', [PYTHON_SCRIPT, '--action', 'start', '--username', username], {
      detached: true, // 使进程在后台运行
      stdio: ['ignore', 'ignore', 'ignore'] // 忽略标准输入输出
    });

    // 分离子进程，使其在后台运行
    python.unref();

    return res.json({
      success: true,
      message: 'MQTT控制服务已在后台启动'
    });
  } catch (error) {
    console.error('启动MQTT控制服务失败:', error);
    return res.status(500).json({
      success: false,
      error: '启动MQTT控制服务失败',
      details: error.message
    });
  }
});

/**
 * 停止MQTT服务
 * POST /api/wiper/stop-service
 */
router.post('/stop-service', authMiddleware, async (req, res) => {
  try {
    // 🔧 使用认证中间件获取用户信息
    const username = req.user?.username;
    console.log(`🎯 为已登录用户 ${username} 停止MQTT控制服务`);

    // 调用Python脚本停止MQTT服务，传入用户名
    const python = spawn('python', [PYTHON_SCRIPT, '--action', 'stop', '--username', username]);

    let dataString = '';
    let errorString = '';

    // 收集标准输出
    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    // 收集标准错误
    python.stderr.on('data', (data) => {
      const output = data.toString();
      errorString += output;

      // 区分日志和真正的错误
      if (output.trim().startsWith('LOG:')) {
        console.log(`Python日志: ${output.trim()}`);  // 作为普通日志输出
      } else {
        console.error(`Python错误: ${output}`);  // 真正的错误
      }
    });

    // 脚本执行完成
    python.on('close', (code) => {
      console.log(`Python脚本退出，状态码: ${code}`);

      if (code !== 0) {
        return res.status(500).json({
          success: false,
          error: `Python脚本执行失败，状态码: ${code}`,
          details: errorString
        });
      }

      return res.json({
        success: true,
        message: 'MQTT控制服务已停止'
      });
    });
  } catch (error) {
    console.error('停止MQTT控制服务失败:', error);
    return res.status(500).json({
      success: false,
      error: '停止MQTT控制服务失败',
      details: error.message
    });
  }
});

/**
 * 通过HTTP同步命令获取雨刷状态
 * POST /api/wiper/get-status-cmd
 *
 * 🔧 更新：使用OneNET HTTP同步命令API实现实时状态查询
 */
router.post('/get-status-cmd', authMiddleware, async (req, res) => {
  try {
    console.log('🎯 收到HTTP同步命令获取雨刷状态请求');

    // 🔧 使用认证中间件获取用户信息
    const username = req.user?.username;
    console.log(`🎯 为已登录用户 ${username} 通过HTTP同步命令获取雨刷状态`);

    // 🔧 更新：使用HTTP同步命令获取状态
    const python = spawn('python', [HTTP_CONTROL_SCRIPT, '--action', 'get-status', '--username', username, '--timeout', '10']);

    let dataString = '';
    let errorString = '';

    // 收集标准输出
    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    // 收集标准错误
    python.stderr.on('data', (data) => {
      const output = data.toString();
      errorString += output;

      // 区分日志和真正的错误
      if (output.trim().startsWith('LOG:')) {
        console.log(`Python日志: ${output.trim()}`);  // 作为普通日志输出
      } else {
        console.error(`Python错误: ${output}`);  // 真正的错误
      }
    });

    // 脚本执行完成
    python.on('close', (code) => {
      console.log(`Python脚本退出，状态码: ${code}`);

      if (code !== 0) {
        return res.status(500).json({
          success: false,
          error: `Python脚本执行失败，状态码: ${code}`,
          details: errorString
        });
      }

      try {
        // 解析Python脚本的输出
        const result = JSON.parse(dataString);
        return res.json(result);
      } catch (error) {
        console.error('解析Python输出失败:', error);
        return res.status(500).json({
          success: false,
          error: '解析Python输出失败',
          details: error.message,
          output: dataString
        });
      }
    });
  } catch (error) {
    console.error('CMD获取雨刷状态失败:', error);
    return res.status(500).json({
      success: false,
      error: 'CMD获取雨刷状态失败',
      details: error.message
    });
  }
});

module.exports = router;
