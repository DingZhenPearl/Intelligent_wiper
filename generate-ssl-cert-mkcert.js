/**
 * 使用mkcert生成本地开发SSL证书的脚本
 * 运行方式: node generate-ssl-cert-mkcert.js
 * 
 * 前提条件: 已安装mkcert
 * 安装方法:
 * - Windows (使用Chocolatey): choco install mkcert
 * - 或从GitHub下载: https://github.com/FiloSottile/mkcert/releases
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 创建ssl目录
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir);
  console.log('创建ssl目录成功');
}

// 检查是否已存在证书文件
const keyPath = path.join(sslDir, 'key.pem');
const certPath = path.join(sslDir, 'cert.pem');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('SSL证书文件已存在，如需重新生成，请先删除ssl目录下的key.pem和cert.pem文件');
  process.exit(0);
}

// 生成自签名证书
try {
  console.log('正在检查mkcert是否已安装...');
  
  try {
    execSync('mkcert -version', { stdio: 'pipe' });
    console.log('mkcert已安装，继续生成证书...');
  } catch (e) {
    throw new Error('未检测到mkcert。请先安装mkcert: https://github.com/FiloSottile/mkcert');
  }
  
  console.log('正在安装本地CA...');
  execSync('mkcert -install', { stdio: 'inherit' });
  
  console.log('正在为localhost生成证书...');
  execSync(`mkcert -key-file "${keyPath}" -cert-file "${certPath}" localhost 127.0.0.1 ::1`, { stdio: 'inherit' });
  
  console.log('SSL证书生成成功！');
  console.log(`密钥文件: ${keyPath}`);
  console.log(`证书文件: ${certPath}`);
  console.log('\n现在您可以使用HTTPS启动开发服务器: npm run serve');
  console.log('由于使用了mkcert生成的证书，浏览器应该会自动信任该证书，不会显示安全警告。');
} catch (error) {
  console.error('生成SSL证书失败:', error.message);
  
  console.log('\n替代方案:');
  console.log('如果您无法使用mkcert，可以尝试以下方法:');
  console.log('1. 在不使用HTTPS的情况下开发，但在浏览器中启用不安全上下文的地理位置API:');
  console.log('   在Chrome中访问: chrome://flags/#unsafely-treat-insecure-origin-as-secure');
  console.log('   添加您的开发URL (例如 http://localhost:8080)');
  console.log('   启用该选项并重启浏览器');
}
