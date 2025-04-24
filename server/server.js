// server/server.js
const app = require('./app');
const config = require('./config');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
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

// 加载SSL证书
function loadSSLCertificates() {
  try {
    const keyPath = path.join(__dirname, 'ssl', 'key.pem');
    const certPath = path.join(__dirname, 'ssl', 'cert.pem');

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
    } else {
      console.warn('SSL证书文件不存在，将只启动HTTP服务器');
      console.warn('如需启用HTTPS，请运行: node server/generate-cert-crypto.js');
      return null;
    }
  } catch (error) {
    console.error('加载SSL证书失败:', error);
    return null;
  }
}

// 初始化数据库和启动服务器
async function initializeApp() {
  try {
    // 清理环境
    await cleanupBeforeStart();

    // 初始化数据库
    await initializeDatabase();

    // 加载SSL证书
    const sslOptions = loadSSLCertificates();

    // 定义HTTP和HTTPS端口
    const httpPort = config.server.port;
    const httpsPort = config.server.port + 1; // HTTPS端口为HTTP端口+1

    // 启动HTTP服务器
    httpServer = http.createServer(app);
    httpServer.listen(httpPort, config.server.host, () => {
      console.log(`HTTP服务器运行在 http://${config.server.host}:${httpPort}`);
    });

    // 如果有SSL证书，启动HTTPS服务器
    if (sslOptions) {
      httpsServer = https.createServer(sslOptions, app);
      httpsServer.listen(httpsPort, config.server.host, () => {
        console.log(`HTTPS服务器运行在 https://${config.server.host}:${httpsPort}`);
        console.log('注意：由于使用自签名证书，浏览器可能会显示安全警告');
      });
    }

    console.log('注意：服务器现在允许从任何网络接口访问');

    // 显示所有可用的IP地址，方便移动设备连接
    const ipAddresses = getLocalIpAddresses();
    console.log('您可以通过以下IP地址从移动设备访问服务器:');
    ipAddresses.forEach(ip => {
      console.log(`HTTP: http://${ip}:${httpPort}`);
      if (sslOptions) {
        console.log(`HTTPS: https://${ip}:${httpsPort}`);
      }
    });
    console.log(`请确保您的防火墙已经开放了${httpPort}和${httpsPort}端口!`);
  } catch (error) {
    console.error('服务器初始化失败:', error);
    process.exit(1);
  }
}

// 存储服务器实例，以便在关闭时使用
let httpServer, httpsServer;

// 处理进程终止信号
process.on('SIGINT', async () => {
  console.log('接收到SIGINT信号，正在清理资源...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('接收到SIGTERM信号，正在清理资源...');
  await gracefulShutdown();
  process.exit(0);
});

// 优雅关闭服务器
async function gracefulShutdown() {
  // 清理数据采集器
  cleanup();

  // 关闭HTTP服务器
  if (httpServer) {
    console.log('正在关闭HTTP服务器...');
    await new Promise(resolve => httpServer.close(resolve));
  }

  // 关闭HTTPS服务器
  if (httpsServer) {
    console.log('正在关闭HTTPS服务器...');
    await new Promise(resolve => httpsServer.close(resolve));
  }

  console.log('所有服务器已关闭');
}

// 启动应用
initializeApp();
