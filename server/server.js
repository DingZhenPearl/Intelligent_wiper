const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const { exec } = require('child_process');

// 直接在代码中定义配置
const config = {
  server: {
    port: 3000,
    host: 'localhost',
    secret_key: 'mwYgR7#*X2'
  }
};

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
      mode: 'json',
      pythonPath: 'python', // 根据环境可能需要修改为'python3'
      scriptPath: path.dirname(PYTHON_SCRIPT),
      args: args
    };
    
    console.log(`执行Python脚本: ${path.basename(PYTHON_SCRIPT)}`);
    console.log(`参数: ${args.join(' ')}`);

    // 尝试使用PythonShell执行脚本
    PythonShell.run(path.basename(PYTHON_SCRIPT), options).then(results => {
      if (results && results.length > 0) {
        console.log('Python返回结果:', results[0]);
        resolve(results[0]);
      } else {
        reject(new Error('Python脚本没有返回数据'));
      }
    }).catch(err => {
      console.error('PythonShell执行错误:', err);
      
      // 如果PythonShell失败，回退到exec方法
      console.log('回退到exec方法执行Python脚本...');
      const command = `python "${PYTHON_SCRIPT}" ${args.join(' ')}`;
      
      exec(command, (error, stdout, stderr) => {
        if (stderr) {
          console.error(`Python脚本错误输出: ${stderr}`);
        }
        
        if (error) {
          console.error(`执行错误: ${error}`);
          return reject(error);
        }
        
        try {
          console.log(`Python脚本原始输出: ${stdout}`);
          const result = JSON.parse(stdout);
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
    const { username, password } = req.body;
    
    // 添加输入验证
    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }
    
    console.log(`尝试登录: 用户名=${username}, 密码长度=${password ? password.length : 0}`);
    
    // 对于登录请求，特别处理一下参数
    const result = await executePythonScript('login', { 
      username, 
      password: password.replace(/"/g, '\\"').replace(/'/g, "\\'") // 转义引号
    });
    
    console.log('登录结果:', result);
    
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
    console.error('登录错误:', error);
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

// 处理所有前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 启动服务器
app.listen(config.server.port, config.server.host, () => {
  console.log(`服务器运行在 http://${config.server.host}:${config.server.port}`);
});