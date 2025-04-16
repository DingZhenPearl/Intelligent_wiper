// server/server.js
const app = require('./app');
const config = require('./config');
const { getLocalIpAddresses } = require('./utils/networkUtils');
const { terminateAllPythonProcesses } = require('./utils/processUtils');
const { initializeDatabase } = require('./services/databaseService');
const { cleanup } = require('./services/rainfallCollector');

// 启动前先清除可能存在的遗留数据采集器进程
// 注意：这只是终止数据采集器进程，不会清除数据库中已存储的雨量数据
async function cleanupBeforeStart() {
  console.log('服务器启动前清除可能存在的遗留数据采集器进程');
  console.log('注意：这只是终止数据采集器进程，不会清除数据库中已存储的雨量数据');

  await terminateAllPythonProcesses();
}

// 初始化数据库
async function initializeApp() {
  try {
    // 清理环境
    await cleanupBeforeStart();
    
    // 初始化数据库
    await initializeDatabase();
    
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
  } catch (error) {
    console.error('服务器初始化失败:', error);
    process.exit(1);
  }
}

// 处理进程终止信号
process.on('SIGINT', async () => {
  console.log('接收到SIGINT信号，正在清理资源...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('接收到SIGTERM信号，正在清理资源...');
  cleanup();
  process.exit(0);
});

// 启动应用
initializeApp();
