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
const PYTHON_SCRIPT = path.join(__dirname, '../python/db_service.py');

// 执行Python数据库操作
function executePythonScript(action, params = {}) {
  return new Promise((resolve, reject) => {
    let args = [`--action=${action}`];
    
    // 添加其他参数 - 改用独立参数传递，避免引号问题
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        args.push(`--${key}=${value}`);
      }
    });
    
    // 使用更安全的方式执行Python脚本
    const { PythonShell } = require('python-shell');
    
    let options = {
      mode: 'text',  // 将mode改为text而不是json，我们自己处理解析
      pythonPath: 'python', // 根据环境可能需要修改为'python3'
      scriptPath: path.dirname(PYTHON_SCRIPT),
      args: args,
      encoding: 'utf8'  // 明确指定编码
    };
    
    console.log(`执行Python脚本: ${path.basename(PYTHON_SCRIPT)}`);
    console.log(`参数: ${args.join(' ')}`);

    // 尝试使用PythonShell执行脚本
    PythonShell.run(path.basename(PYTHON_SCRIPT), options).then(results => {
      if (results && results.length > 0) {
        try {
          // 手动解析JSON
          const jsonOutput = results[0].trim();
          console.log('Python原始返回结果:', jsonOutput);
          const parsedResult = JSON.parse(jsonOutput);
          console.log('解析后的结果:', parsedResult);
          resolve(parsedResult);
        } catch (parseErr) {
          console.error('解析Python返回的JSON失败:', parseErr);
          console.error('原始输出:', results[0]);
          reject(new Error(`无法解析Python输出: ${parseErr.message}`));
        }
      } else {
        reject(new Error('Python脚本没有返回数据'));
      }
    }).catch(err => {
      console.error('PythonShell执行错误:', err);
      
      // 如果PythonShell失败，回退到exec方法
      console.log('回退到exec方法执行Python脚本...');
      const command = `python "${PYTHON_SCRIPT}" ${args.join(' ')}`;
      
      exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
        if (stderr) {
          console.error(`Python脚本错误输出: ${stderr}`);
        }
        
        if (error) {
          console.error(`执行错误: ${error}`);
          return reject(error);
        }
        
        try {
          console.log(`Python脚本原始输出: ${stdout}`);
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          console.error(`解析结果失败: ${stdout}`);
          console.error(`解析错误: ${e}`);
          reject(new Error(`解析结果失败: ${stdout}`));
        }
      });
    });
  });
}

// 初始化数据库
executePythonScript('init')
  .then(result => console.log('数据库初始化结果:', result))
  .catch(err => console.error('数据库初始化失败:', err));

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await executePythonScript('register', { username, password });
    
    if (result.success) {
      res.status(201).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('收到登录请求:', {
      headers: req.headers,
      body: req.body,
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
    const result = await executePythonScript('login', { 
      username: username.trim(), 
      password: password.trim().replace(/"/g, '\\"').replace(/'/g, "\\'")
    });
    
    console.log('登录处理结果:', result);
    
    if (result && result.success) {
      // 保存用户信息到session
      req.session.user = {
        user_id: result.user_id,
        username: result.username
      };
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
    console.error('登录过程错误:', error);
    res.status(500).json({ error: '服务器内部错误', details: error.message });
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
app.get('/api/auth/user', async (req, res) => {
  if (req.session.user) {
    try {
      // 从数据库获取最新的用户信息
      const result = await executePythonScript('get_user', { user_id: req.session.user.user_id });
      
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

// 处理所有前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 添加简单的服务器状态检测API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: '服务器正常运行',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
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