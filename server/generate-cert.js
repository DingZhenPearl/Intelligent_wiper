// server/generate-cert.js
const mkcert = require('mkcert');
const fs = require('fs');
const path = require('path');

async function generateCertificate() {
  try {
    console.log('开始生成SSL证书...');
    
    // 创建证书目录
    const certDir = path.join(__dirname, 'ssl');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
      console.log(`创建证书目录: ${certDir}`);
    }
    
    // 创建证书颁发机构
    const ca = await mkcert.createCA({
      organization: 'Intelligent Wiper System CA',
      countryCode: 'CN',
      state: 'Sichuan',
      locality: 'Mianyang',
      validityDays: 365
    });
    
    console.log('证书颁发机构创建成功');
    
    // 创建证书
    const cert = await mkcert.createCert({
      domains: ['localhost', '127.0.0.1'],
      validityDays: 365,
      caKey: ca.key,
      caCert: ca.cert
    });
    
    console.log('SSL证书创建成功');
    
    // 保存证书文件
    fs.writeFileSync(path.join(certDir, 'ca.key'), ca.key);
    fs.writeFileSync(path.join(certDir, 'ca.cert'), ca.cert);
    fs.writeFileSync(path.join(certDir, 'cert.key'), cert.key);
    fs.writeFileSync(path.join(certDir, 'cert.cert'), cert.cert);
    
    console.log('SSL证书文件已保存到:', certDir);
    console.log('证书文件:');
    console.log('- ca.key: CA私钥');
    console.log('- ca.cert: CA证书');
    console.log('- cert.key: 服务器私钥');
    console.log('- cert.cert: 服务器证书');
    
    return {
      key: cert.key,
      cert: cert.cert
    };
  } catch (error) {
    console.error('生成SSL证书时出错:', error);
    throw error;
  }
}

// 如果直接运行此脚本，则生成证书
if (require.main === module) {
  generateCertificate()
    .then(() => {
      console.log('SSL证书生成完成');
    })
    .catch(err => {
      console.error('SSL证书生成失败:', err);
      process.exit(1);
    });
}

module.exports = { generateCertificate };
