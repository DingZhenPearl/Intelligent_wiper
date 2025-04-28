// start-server.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// 检查SSL证书是否存在
function checkSSLCertificates() {
  const keyPath = path.join(__dirname, 'server', 'ssl', 'key.pem');
  const certPath = path.join(__dirname, 'server', 'ssl', 'cert.pem');

  return fs.existsSync(keyPath) && fs.existsSync(certPath);
}

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 主函数
async function main() {
  console.log('智能雨刷系统服务器启动脚本');
  console.log('============================');

  // 检查SSL证书
  const hasSSL = checkSSLCertificates();

  if (!hasSSL) {
    console.log('未检测到SSL证书。您想要生成SSL证书吗？(y/n)');
    const generateSSL = await new Promise(resolve => rl.question('> ', answer => resolve(answer.toLowerCase() === 'y')));

    if (generateSSL) {
      console.log('正在生成SSL证书...');

      // 运行证书生成脚本
      const certProcess = spawn('node', [path.join(__dirname, 'server', 'generate-cert-crypto.js')], {
        stdio: 'inherit'
      });

      console.log('注意：您也可以使用 node https/generate-ssl-cert.js 生成前端开发服务器使用的证书');

      await new Promise(resolve => certProcess.on('close', resolve));
    }
  }

  // 再次检查SSL证书
  const sslAvailable = checkSSLCertificates();

  if (sslAvailable) {
    console.log('检测到SSL证书。您想要强制使用HTTPS吗？(y/n)');
    const forceHTTPS = await new Promise(resolve => rl.question('> ', answer => resolve(answer.toLowerCase() === 'y')));

    // 设置环境变量
    process.env.FORCE_HTTPS = forceHTTPS ? 'true' : 'false';

    console.log(`HTTPS ${forceHTTPS ? '将被强制使用' : '不会被强制使用'}`);
  } else {
    console.log('未检测到SSL证书，将只使用HTTP。');
    process.env.FORCE_HTTPS = 'false';
  }

  // 启动服务器
  console.log('正在启动服务器...');

  const serverProcess = spawn('node', [path.join(__dirname, 'server', 'server.js')], {
    stdio: 'inherit',
    env: {
      ...process.env
    }
  });

  // 处理服务器进程的退出
  serverProcess.on('close', code => {
    console.log(`服务器进程已退出，退出码: ${code}`);
    rl.close();
  });

  // 处理主进程的退出信号
  process.on('SIGINT', () => {
    console.log('接收到中断信号，正在关闭服务器...');
    serverProcess.kill('SIGINT');
  });
}

// 运行主函数
main().catch(err => {
  console.error('启动脚本出错:', err);
  rl.close();
  process.exit(1);
});
