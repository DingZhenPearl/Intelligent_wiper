/**
 * 雨刷控制API接口
 * 提供通过OneNET平台控制雨刷的功能
 */

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const router = express.Router();

// Python脚本路径
const PYTHON_SCRIPT = path.join(__dirname, '../python/onenet_mqtt_control.py');
const TEST_SCRIPT = path.join(__dirname, '../python/test_mqtt_control.py');

/**
 * 获取雨刷状态
 * GET /api/wiper/status
 */
router.get('/status', async (req, res) => {
  try {
    console.log('获取雨刷状态');

    // 🔧 修复：获取当前用户（从session中获取），不使用默认admin
    console.log(`🔍 Session ID:`, req.sessionID);
    console.log(`🔍 Session信息:`, req.session);
    console.log(`🔍 用户信息:`, req.session?.user);

    const username = req.session?.user?.username;
    if (!username) {
      console.log(`❌ 用户未登录，session中没有用户信息`);
      return res.status(401).json({
        success: false,
        error: '用户未登录',
        details: '请先登录后再获取设备状态'
      });
    }

    console.log(`🎯 为已登录用户 ${username} 获取雨刷状态`);

    // 调用Python脚本获取状态，传入用户名
    const python = spawn('python', [PYTHON_SCRIPT, '--action', 'status', '--username', username]);

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
 * 控制雨刷
 * POST /api/wiper/control
 * 请求体: { status: 'off' | 'low' | 'medium' | 'high' }
 */
router.post('/control', async (req, res) => {
  try {
    const { status } = req.body;

    // 验证状态值
    const validStatuses = ['off', 'interval', 'low', 'medium', 'high', 'smart'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的雨刷状态',
        details: `状态必须是以下值之一: ${validStatuses.join(', ')}`
      });
    }

    // 🔧 修复：获取当前用户（从session中获取），不使用默认admin
    console.log(`🔍 Session ID:`, req.sessionID);
    console.log(`🔍 Session信息:`, req.session);
    console.log(`🔍 用户信息:`, req.session?.user);

    const username = req.session?.user?.username;
    if (!username) {
      console.log(`❌ 用户未登录，session中没有用户信息`);
      return res.status(401).json({
        success: false,
        error: '用户未登录',
        details: '请先登录后再进行设备控制操作'
      });
    }

    console.log(`🎯 为已登录用户 ${username} 控制雨刷: ${status}`);

    // 调用Python脚本控制雨刷，传入用户名
    const python = spawn('python', [PYTHON_SCRIPT, '--action', 'control', '--status', status, '--username', username]);

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
 * 使用API方式控制雨刷
 * POST /api/wiper/api-control
 * 请求体: { command: 'off' | 'low' | 'medium' | 'high' }
 */
router.post('/api-control', async (req, res) => {
  try {
    const { command } = req.body;

    // 验证命令值
    const validCommands = ['off', 'interval', 'low', 'medium', 'high', 'smart'];
    if (!command || !validCommands.includes(command)) {
      return res.status(400).json({
        success: false,
        error: '无效的雨刷命令',
        details: `命令必须是以下值之一: ${validCommands.join(', ')}`
      });
    }

    // 🔧 修复：获取当前用户（从session中获取），不使用默认admin
    console.log(`🔍 Session ID:`, req.sessionID);
    console.log(`🔍 Session信息:`, req.session);
    console.log(`🔍 用户信息:`, req.session?.user);

    const username = req.session?.user?.username;
    if (!username) {
      console.log(`❌ 用户未登录，session中没有用户信息`);
      return res.status(401).json({
        success: false,
        error: '用户未登录',
        details: '请先登录后再进行设备控制操作'
      });
    }

    console.log(`🎯 通过API为已登录用户 ${username} 控制雨刷: ${command}`);

    // 🔧 修复：使用MQTT控制方式而不是HTTP API
    const python = spawn('python', [PYTHON_SCRIPT, '--action', 'control', '--status', command, '--username', username]);

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
router.post('/start-service', async (req, res) => {
  try {
    // 🔧 修复：获取当前用户（从session中获取），不使用默认admin
    console.log(`🔍 Session ID:`, req.sessionID);
    console.log(`🔍 Session信息:`, req.session);
    console.log(`🔍 用户信息:`, req.session?.user);

    const username = req.session?.user?.username;
    if (!username) {
      console.log(`❌ 用户未登录，session中没有用户信息`);
      return res.status(401).json({
        success: false,
        error: '用户未登录',
        details: '请先登录后再启动MQTT服务'
      });
    }

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
router.post('/stop-service', async (req, res) => {
  try {
    // 🔧 修复：获取当前用户（从session中获取），不使用默认admin
    console.log(`🔍 Session ID:`, req.sessionID);
    console.log(`🔍 Session信息:`, req.session);
    console.log(`🔍 用户信息:`, req.session?.user);

    const username = req.session?.user?.username;
    if (!username) {
      console.log(`❌ 用户未登录，session中没有用户信息`);
      return res.status(401).json({
        success: false,
        error: '用户未登录',
        details: '请先登录后再停止MQTT服务'
      });
    }

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

module.exports = router;
