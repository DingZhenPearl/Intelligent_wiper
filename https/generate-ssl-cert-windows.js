/**
 * 为Windows环境生成自签名SSL证书的脚本
 * 运行方式: node https/generate-ssl-cert-windows.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 创建ssl目录
const sslDir = path.join(__dirname, '..', 'ssl');
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
  
  // 使用OpenSSL生成自签名证书 - Windows版本
  // 注意Windows中subj参数的格式不同，需要使用//CN=localhost
  const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "//CN=localhost"`;
  
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
  console.log('4. 路径中包含空格或特殊字符');
  
  console.log('\n解决方案:');
  console.log('1. 确保已安装OpenSSL并添加到系统PATH中');
  console.log('2. 尝试以管理员身份运行命令提示符');
  console.log('3. 手动创建证书:');
  console.log('   a. 打开命令提示符');
  console.log('   b. 切换到项目目录');
  console.log('   c. 运行以下命令:');
  console.log('      mkdir ssl');
  console.log('      openssl req -x509 -newkey rsa:4096 -keyout ssl\\key.pem -out ssl\\cert.pem -days 365 -nodes -subj "//CN=localhost"');
  
  console.log('\n替代方案:');
  console.log('如果您无法使用OpenSSL，可以尝试以下方法:');
  console.log('1. 使用mkcert工具: https://github.com/FiloSottile/mkcert');
  console.log('2. 使用在线SSL证书生成器');
  console.log('3. 在不使用HTTPS的情况下开发，但在浏览器中启用不安全上下文的地理位置API:');
  console.log('   在Chrome中访问: chrome://flags/#unsafely-treat-insecure-origin-as-secure');
  console.log('   添加您的开发URL (例如 http://localhost:8080)');
  console.log('   启用该选项并重启浏览器');
}
