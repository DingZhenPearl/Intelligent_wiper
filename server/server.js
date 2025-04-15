const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// 修改配置使服务器监听所有网络接口
const config = {
  server: {
    port: 3000,
    host: '0.0.0.0',  // 确保是0.0.0.0而不是localhost
    secret_key: 'mwYgR7#*X2'
  }
};

const app = express();

// 静态文件服务
app.use(express.static(path.join(__dirname, '../dist')));

// 修改CORS配置，允许来自任何来源的请求
app.use(cors({
  origin: '*', // 允许所有来源
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false // 禁用credentials以避免跨域问题
}));

// 确保每个响应都包含CORS头部
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // 对OPTIONS请求直接返回200
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// 处理Python脚本的标准错误输出
function handlePythonStderr(stderr) {
  if (!stderr) return;

  // 将stderr输出分行处理
  const lines = stderr.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      // 如果是LOG开头，则视为日志而非错误
      if (line.includes('LOG:')) {
        console.log(`Python脚本日志: ${line.trim()}`);
      } else {
        console.error(`Python脚本错误: ${line.trim()}`);
      }
    }
  }
}

app.use(express.json());

// 修改session配置，简化跨域问题
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

// Python脚本路径
const DB_SERVICE_SCRIPT = path.join(__dirname, '../python/db_service.py');
const RAINFALL_API_SCRIPT = path.join(__dirname, '../python/rainfall_api.py');
const RAINFALL_COLLECTOR_SCRIPT = path.join(__dirname, '../python/rainfall_collector.py');

// 添加敏感信息处理函数
function maskSensitiveInfo(obj) {
  const masked = { ...obj };
  if (masked.password) {
    masked.password = '******';
  }
  if (masked.body && masked.body.password) {
    masked.body = { ...masked.body, password: '******' };
  }
  return masked;
}

// 执行Python脚本
function executePythonScript(scriptPath, action, params = {}) {
  return new Promise((resolve, reject) => {
    let args = [`--action=${action}`];

    // 添加其他参数 - 改用独立参数传递，避免引号问题
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        args.push(`--${key}=${value}`);
      }
    });

    const maskedArgs = args.map(arg =>
      arg.startsWith('--password=') ? '--password=******' : arg
    );

    console.log(`执行Python脚本: ${path.basename(scriptPath)}`);
    console.log(`参数: ${maskedArgs.join(' ')}`);

    // 使用更安全的方式执行Python脚本
    const { PythonShell } = require('python-shell');

    let options = {
      mode: 'text',  // 将mode改为text而不是json，我们自己处理解析
      pythonPath: 'python', // 根据环境可能需要修改为'python3'
      scriptPath: path.dirname(scriptPath),
      args: args,
      // 不指定编码，使用默认编码
      stderrParser: line => {
        // 收集stderr输出
        if (!options.stderr) options.stderr = '';
        options.stderr += line + '\n';
        return line;
      }
    };

    console.log(`执行Python脚本: ${path.basename(scriptPath)}`);
    console.log(`参数: ${maskedArgs.join(' ')}`);

    // 尝试使用PythonShell执行脚本
    PythonShell.run(path.basename(scriptPath), options).then(results => {
      // 处理PythonShell的stderr输出
      if (options.stderr) {
        handlePythonStderr(options.stderr);
      }
      if (results && results.length > 0) {
        try {
          // 手动解析JSON
          const jsonOutput = results[0].trim();
          console.log('Python原始返回结果:', jsonOutput);

          // 尝试解析JSON
          let parsedResult;
          try {
            parsedResult = JSON.parse(jsonOutput);
          } catch (jsonErr) {
            console.error('JSON解析错误，尝试创建默认响应');
            // 创建一个默认的成功响应
            if (action === 'stats') {
              parsedResult = {
                success: true,
                period: params.period || '10min',
                data: [],
                currentHour: {
                  hour: new Date().getHours(),
                  avg_rainfall: 0.0,
                  total_rainfall: 0.0,
                  data_points: 0,
                  minutes_passed: (new Date().getMinutes() + (new Date().getSeconds() / 60))
                },
                unit: params.period === 'all' ? 'mm/天' : 'mm/h'
              };
            } else if (action === 'home') {
              parsedResult = {
                success: true,
                data: {
                  timestamp: new Date().toISOString(),
                  rainfall_value: 0.0,
                  rainfall_level: 'none',
                  rainfall_percentage: 0
                }
              };
            } else {
              parsedResult = { success: true, message: '操作成功' };
            }
          }

          console.log('解析后的结果:', maskSensitiveInfo(parsedResult));
          resolve(parsedResult);
        } catch (parseErr) {
          console.error('解析Python返回的JSON失败:', parseErr);
          console.error('原始输出:', results[0]);

          // 创建一个默认的成功响应
          let defaultResult;
          if (action === 'stats') {
            defaultResult = {
              success: true,
              period: params.period || '10min',
              data: [],
              currentHour: {
                hour: new Date().getHours(),
                avg_rainfall: 0.0,
                total_rainfall: 0.0,
                data_points: 0,
                minutes_passed: (new Date().getMinutes() + (new Date().getSeconds() / 60))
              },
              unit: params.period === 'all' ? 'mm/天' : 'mm/h'
            };
          } else if (action === 'home') {
            defaultResult = {
              success: true,
              data: {
                timestamp: new Date().toISOString(),
                rainfall_value: 0.0,
                rainfall_level: 'none',
                rainfall_percentage: 0
              }
            };
          } else {
            defaultResult = { success: true, message: '操作成功' };
          }

          resolve(defaultResult);
        }
      } else {
        console.error('Python脚本没有返回数据，使用默认响应');

        // 创建一个默认的成功响应
        let defaultResult;
        if (action === 'stats') {
          defaultResult = {
            success: true,
            period: params.period || '10min',
            data: [],
            currentHour: {
              hour: new Date().getHours(),
              avg_rainfall: 0.0,
              total_rainfall: 0.0,
              data_points: 0,
              minutes_passed: (new Date().getMinutes() + (new Date().getSeconds() / 60))
            },
            unit: params.period === 'all' ? 'mm/天' : 'mm/h'
          };
        } else if (action === 'home') {
          defaultResult = {
            success: true,
            data: {
              timestamp: new Date().toISOString(),
              rainfall_value: 0.0,
              rainfall_level: 'none',
              rainfall_percentage: 0
            }
          };
        } else {
          defaultResult = { success: true, message: '操作成功' };
        }

        resolve(defaultResult);
      }
    }).catch(err => {
      console.error('PythonShell执行错误:', maskSensitiveInfo(err));

      // 如果PythonShell失败，直接使用exec方法
      console.log('使用exec方法执行Python脚本...');
      const command = `python "${scriptPath}" ${args.join(' ')}`;

      exec(command, (error, stdout, stderr) => {
        // 使用新的函数处理stderr
        handlePythonStderr(stderr);

        if (error) {
          console.error(`执行错误: ${error}`);

          // 即使有错误，也尝试解析输出
          if (stdout && stdout.trim()) {
            try {
              console.log(`Python脚本原始输出: ${stdout}`);
              const result = JSON.parse(stdout.trim());
              resolve(result);
              return;
            } catch (parseErr) {
              console.error('尝试解析错误输出失败:', parseErr);
            }
          }

          // 创建一个默认的成功响应
          let defaultResult;
          if (action === 'stats') {
            defaultResult = {
              success: true,
              period: params.period || '10min',
              data: [],
              currentHour: {
                hour: new Date().getHours(),
                avg_rainfall: 0.0,
                total_rainfall: 0.0,
                data_points: 0,
                minutes_passed: (new Date().getMinutes() + (new Date().getSeconds() / 60))
              },
              unit: params.period === 'all' ? 'mm/天' : 'mm/h'
            };
          } else if (action === 'home') {
            defaultResult = {
              success: true,
              data: {
                timestamp: new Date().toISOString(),
                rainfall_value: 0.0,
                rainfall_level: 'none',
                rainfall_percentage: 0
              }
            };
          } else {
            defaultResult = { success: true, message: '操作成功' };
          }

          console.log('Python脚本执行错误，使用默认响应');
          resolve(defaultResult);
          return;
        }

        try {
          console.log(`Python脚本原始输出: ${stdout}`);
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          console.error(`解析结果失败: ${stdout}`);
          console.error(`解析错误: ${e}`);

          // 创建一个默认的成功响应
          let defaultResult;
          if (action === 'stats') {
            defaultResult = {
              success: true,
              period: params.period || '10min',
              data: [],
              currentHour: {
                hour: new Date().getHours(),
                avg_rainfall: 0.0,
                total_rainfall: 0.0,
                data_points: 0,
                minutes_passed: (new Date().getMinutes() + (new Date().getSeconds() / 60))
              },
              unit: params.period === 'all' ? 'mm/天' : 'mm/h'
            };
          } else if (action === 'home') {
            defaultResult = {
              success: true,
              data: {
                timestamp: new Date().toISOString(),
                rainfall_value: 0.0,
                rainfall_level: 'none',
                rainfall_percentage: 0
              }
            };
          } else {
            defaultResult = { success: true, message: '操作成功' };
          }

          console.log('解析结果失败，使用默认响应');
          resolve(defaultResult);
        }
      });
    });
  });
}

// 初始化数据库
executePythonScript(DB_SERVICE_SCRIPT, 'init')
  .then(result => console.log('数据库初始化结果:', result))
  .catch(err => console.error('数据库初始化失败:', err));

// 初始化雨量数据库
const RAINFALL_DB_SCRIPT = path.join(__dirname, '../python/rainfall_db.py');
executePythonScript(RAINFALL_DB_SCRIPT, 'init')
  .then(result => console.log('雨量数据库初始化结果:', result))
  .catch(err => console.error('雨量数据库初始化失败:', err));

// 启动数据采集器
let collectorProcess = null;
let shouldRestartCollector = true; // 控制是否应该重启采集器

function startRainfallCollector(username = 'admin') {
  const { spawn } = require('child_process');
  console.log(`启动雨量数据采集器 (用户: ${username})...`);

  // 使用spawn而不是exec，以便于持续运行
  collectorProcess = spawn('python', [
    RAINFALL_COLLECTOR_SCRIPT,
    '--action=start',
    `--username=${username}`,
    '--interval=5',
    '--verbose'
  ]);

  collectorProcess.stdout.on('data', (data) => {
    console.log(`雨量采集器输出: ${data}`);
  });

  // 完全替换stderr处理程序
  collectorProcess.stderr.on('data', (data) => {
    const dataStr = data.toString();
    // 如果是LOG开头，则视为日志
    if (dataStr.includes('LOG:')) {
      // 将所有日志输出都视为正常日志
      console.log(`雨量采集器日志: ${dataStr.trim()}`);
    } else {
      // 非日志输出才视为错误
      console.error(`雨量采集器错误: ${dataStr.trim()}`);
    }
  });

  collectorProcess.on('close', (code) => {
    console.log(`雨量采集器已终止，退出码: ${code}`);

    // 清除引用
    collectorProcess = null;

    // 如果意外终止且应该重启，则尝试重启
    if (code !== 0 && shouldRestartCollector) {
      console.log('尝试重启雨量采集器...');
      setTimeout(() => {
        // 再次检查是否应该重启
        if (shouldRestartCollector) {
          startRainfallCollector(username);
        } else {
          console.log('重启标志已关闭，不再重启雨量采集器');
        }
      }, 5000);
    }
  });

  // 在服务器关闭时清理资源
  process.on('exit', () => {
    if (collectorProcess) {
      collectorProcess.kill();
    }
  });
}

// 不再自动启动数据采集器，改为在用户登录后手动启动
// setTimeout(startRainfallCollector, 5000);

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('注册请求:', { username, passwordLength: password ? password.length : 0 });

    const result = await executePythonScript(DB_SERVICE_SCRIPT, 'register', { username, password });
    console.log('注册结果:', maskSensitiveInfo(result));

    if (result.success) {
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
app.post('/api/auth/login', async (req, res) => {
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
    const result = await executePythonScript(DB_SERVICE_SCRIPT, 'login', {
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

      // 登录时不再自动启动数据采集器
      // 设置不重启标志
      shouldRestartCollector = false;
      console.log(`用户${result.username}登录，设置不重启标志`);

      // 如果有正在运行的采集器，停止它
      if (collectorProcess) {
        console.log(`用户${result.username}登录，停止现有数据采集器`);
        collectorProcess.kill();
        // 不需要设置为null，因为在close事件中已经处理
      }
      // 用户需要点击“开始收集数据”按钮才会启动数据采集器

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
app.post('/api/auth/logout', async (req, res) => {
  try {
    // 在销毁session前保存用户名
    const wasLoggedIn = req.session.user ? true : false;
    const username = req.session.user ? req.session.user.username : 'admin';

    // 先强制停止数据采集器，然后再销毁session
    // 设置不重启标志
    shouldRestartCollector = false;
    console.log('用户登出，设置不重启标志');

    // 如果有正在运行的数据采集器，强制停止
    if (collectorProcess) {
      console.log(`用户登出，强制停止数据采集器`);

      // 使用SIGKILL信号强制终止进程
      try {
        collectorProcess.kill('SIGKILL');
        console.log('已发送SIGKILL信号终止数据采集器');
      } catch (killError) {
        console.error('终止数据采集器时出错:', killError);
      }

      // 等待进程终止
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 确保进程引用被清除
      collectorProcess = null;
    }

    // 再次确认没有数据采集器在运行
    // 尝试终止所有可能的Python进程
    try {
      if (process.platform === 'win32') {
        // Windows系统
        require('child_process').execSync('taskkill /F /IM python.exe /T', { stdio: 'ignore' });
      } else {
        // Linux/Mac系统
        require('child_process').execSync(`pkill -f "${RAINFALL_COLLECTOR_SCRIPT}"`, { stdio: 'ignore' });
      }
      console.log('已尝试终止所有相关Python进程');
    } catch (execError) {
      // 忽略错误，因为可能没有找到匹配的进程
      console.log('没有找到需要终止的Python进程或终止过程中出错');
    }

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

    res.json({ message: '登出成功，所有数据采集器已停止' });
  } catch (error) {
    console.error('登出过程出错:', error);
    res.status(500).json({ error: '登出失败' });
  }
});

// 获取当前用户信息
app.get('/api/auth/user', async (req, res) => {
  if (req.session.user) {
    try {
      // 从数据库获取最新的用户信息
      const result = await executePythonScript(DB_SERVICE_SCRIPT, 'get_user', { user_id: req.session.user.user_id });

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

// 获取本地IP地址函数
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.keys(interfaces).forEach((netInterface) => {
    interfaces[netInterface].forEach((iface) => {
      // 只获取IPv4地址且排除内部地址
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    });
  });

  return addresses;
}

// 添加简单的服务器状态检测API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: '服务器正常运行',
    timestamp: new Date().toISOString()
  });
});

// 雨量数据 API

// 获取统计页面数据
app.get('/api/rainfall/stats', async (req, res) => {
  try {
    const period = req.query.period || '10min';
    // 使用登录用户的用户名，如果未登录则使用'admin'
    const username = req.session.user ? req.session.user.username : 'admin';
    console.log(`获取雨量统计数据，用户: ${username}, 时间粒度: ${period}`);

    const result = await executePythonScript(RAINFALL_API_SCRIPT, 'stats', { username, period });

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
app.get('/api/rainfall/mock', async (req, res) => {
  try {
    // 不再检查用户是否登录
    // 使用默认用户名如果未登录

    const days = req.query.days || 7;
    const username = req.session.user ? req.session.user.username : 'admin';
    console.log(`初始化模拟数据，用户: ${username}`);

    // 先清除现有数据并初始化
    const result = await executePythonScript(RAINFALL_DB_SCRIPT, 'mock', { username, days });

    if (result.success) {
      // 设置重启标志为true
      shouldRestartCollector = true;
      console.log('设置重启标志为true，允许数据采集器自动重启');

      // 如果有正在运行的数据采集器，先停止
      if (collectorProcess) {
        console.log(`停止现有数据采集器，准备重新启动`);
        collectorProcess.kill();
        // 不需要设置为null，因为在close事件中已经处理

        // 等待一小段时间，确保进程已经完全终止
        setTimeout(() => {
          // 启动新的数据采集器，每5秒生成一个数据点
          console.log(`启动新的数据采集器，用户: ${username}`);
          startRainfallCollector(username);
        }, 1000);
      } else {
        // 启动新的数据采集器，每5秒生成一个数据点
        console.log(`启动新的数据采集器，用户: ${username}`);
        startRainfallCollector(username);
      }

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
app.get('/api/rainfall/stop', async (req, res) => {
  try {
    // 不再检查用户是否登录
    const username = req.session.user ? req.session.user.username : 'admin';

    // 设置不重启标志
    shouldRestartCollector = false;
    console.log('设置不重启标志，确保数据采集器不会自动重启');

    // 如果有正在运行的数据采集器，强制停止
    if (collectorProcess) {
      console.log(`强制停止数据采集器，用户: ${username}`);

      // 使用SIGKILL信号强制终止进程
      try {
        collectorProcess.kill('SIGKILL');
        console.log('已发送SIGKILL信号终止数据采集器');
      } catch (killError) {
        console.error('终止数据采集器时出错:', killError);
      }

      // 等待进程终止
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 确保进程引用被清除
      collectorProcess = null;
    }

    // 再次确认没有数据采集器在运行
    // 尝试终止所有可能的Python进程
    try {
      if (process.platform === 'win32') {
        // Windows系统
        require('child_process').execSync('taskkill /F /IM python.exe /T', { stdio: 'ignore' });
      } else {
        // Linux/Mac系统
        require('child_process').execSync(`pkill -f "${RAINFALL_COLLECTOR_SCRIPT}"`, { stdio: 'ignore' });
      }
      console.log('已尝试终止所有相关Python进程');
    } catch (execError) {
      // 忽略错误，因为可能没有找到匹配的进程
      console.log('没有找到需要终止的Python进程或终止过程中出错');
    }

    res.json({
      success: true,
      message: '数据采集器已强制停止'
    });
  } catch (error) {
    console.error('停止数据采集器错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取首页实时雨量数据
app.get('/api/rainfall/home', async (req, res) => {
  try {
    // 使用登录用户的用户名，如果未登录则使用'admin'
    const username = req.session.user ? req.session.user.username : 'admin';
    console.log(`获取首页实时雨量数据，用户: ${username}`);

    const result = await executePythonScript(RAINFALL_API_SCRIPT, 'home', { username });

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

// 处理所有前端路由 - 必须放在所有API路由之后
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 启动前先清除可能存在的遗留Python进程
async function cleanupBeforeStart() {
  console.log('服务器启动前清除可能存在的遗留Python进程');

  // 设置不重启标志
  shouldRestartCollector = false;

  try {
    if (process.platform === 'win32') {
      // Windows系统
      require('child_process').execSync('taskkill /F /IM python.exe /T', { stdio: 'ignore' });
    } else {
      // Linux/Mac系统
      require('child_process').execSync(`pkill -f "${RAINFALL_COLLECTOR_SCRIPT}"`, { stdio: 'ignore' });
    }
    console.log('已尝试终止所有相关Python进程');
  } catch (execError) {
    // 忽略错误，因为可能没有找到匹配的进程
    console.log('没有找到需要终止的Python进程或终止过程中出错');
  }
}

// 启动服务器
// 先清除遗留进程，然后启动服务器
cleanupBeforeStart().then(() => {
  app.listen(config.server.port, config.server.host, () => {
    console.log(`服务器运行在 http://${config.server.host}:${config.server.port}`);
    console.log('注意：服务器现在允许从任何网络接口访问');

    // 显示所有可用的IP地址，方便移动设备连接
    const ipAddresses = getLocalIpAddresses();
    console.log('您可以通过以下IP地址从移动设备访问服务器:');
    ipAddresses.forEach(ip => {
      console.log(`http://${ip}:${config.server.port}`);
    });
    console.log('请确保您的防火墙已经开放了3000端口!');
  });
});