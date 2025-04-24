/**
 * 生成自签名SSL证书的脚本
 * 运行方式: node generate-ssl-cert.js
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
  console.log('正在生成自签名SSL证书...');
  
  // 使用OpenSSL生成自签名证书
  // 注意：这需要系统中已安装OpenSSL
  const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`;
  
  execSync(command, { stdio: 'inherit' });
  
  console.log('SSL证书生成成功！');
  console.log(`密钥文件: ${keyPath}`);
  console.log(`证书文件: ${certPath}`);
  console.log('\n现在您可以使用HTTPS启动开发服务器: npm run serve');
  console.log('注意: 由于使用自签名证书，浏览器可能会显示安全警告，您需要手动确认继续访问。');
} catch (error) {
  console.error('生成SSL证书失败:', error.message);
  console.log('\n可能的原因:');
  console.log('1. 系统中未安装OpenSSL');
  console.log('2. 没有足够的权限创建或写入文件');
  console.log('3. 命令执行过程中出现错误');
  
  console.log('\n手动生成SSL证书的方法:');
  console.log('1. 安装OpenSSL');
  console.log('2. 运行以下命令:');
  console.log(`   openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`);
  console.log('3. 将生成的key.pem和cert.pem文件放在项目根目录的ssl文件夹中');
}
