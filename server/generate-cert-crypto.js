// server/generate-cert-crypto.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSelfSignedCertificate() {
  try {
    console.log('开始生成自签名SSL证书...');
    
    // 创建证书目录
    const certDir = path.join(__dirname, 'ssl');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
      console.log(`创建证书目录: ${certDir}`);
    }
    
    // 生成RSA密钥对
    console.log('生成RSA密钥对...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    // 保存私钥
    const keyPath = path.join(certDir, 'key.pem');
    fs.writeFileSync(keyPath, privateKey);
    console.log(`私钥已保存到: ${keyPath}`);
    
    // 创建自签名证书
    console.log('创建自签名证书...');
    
    // 证书属性
    const attrs = [
      { name: 'commonName', value: 'localhost' },
      { name: 'organizationName', value: 'Intelligent Wiper System' },
      { name: 'organizationalUnitName', value: 'Development' },
      { name: 'localityName', value: 'Mianyang' },
      { name: 'stateOrProvinceName', value: 'Sichuan' },
      { name: 'countryName', value: 'CN' }
    ];
    
    // 证书扩展
    const extensions = [
      { name: 'basicConstraints', critical: true, value: 'CA:FALSE' },
      { name: 'keyUsage', critical: true, value: 'digitalSignature, keyEncipherment' },
      { name: 'extKeyUsage', critical: false, value: 'serverAuth' },
      { name: 'subjectAltName', critical: false, value: 'DNS:localhost, IP:127.0.0.1' }
    ];
    
    // 创建证书
    const cert = crypto.createPrivateKey(privateKey).export({
      type: 'pkcs8',
      format: 'pem'
    });
    
    // 由于Node.js的crypto模块不直接支持创建自签名证书，
    // 我们需要使用OpenSSL命令行工具来完成这一步
    
    console.log('使用OpenSSL创建自签名证书...');
    const { execSync } = require('child_process');
    
    // 创建配置文件
    const configPath = path.join(certDir, 'openssl.cnf');
    const config = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = localhost
O = Intelligent Wiper System
OU = Development
L = Mianyang
ST = Sichuan
C = CN

[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
    `;
    
    fs.writeFileSync(configPath, config);
    console.log(`OpenSSL配置文件已保存到: ${configPath}`);
    
    // 使用OpenSSL生成自签名证书
    const certPath = path.join(certDir, 'cert.pem');
    const opensslCommand = `openssl req -x509 -new -nodes -key "${keyPath}" -sha256 -days 365 -out "${certPath}" -config "${configPath}"`;
    
    try {
      execSync(opensslCommand);
      console.log(`自签名证书已保存到: ${certPath}`);
      
      return {
        key: keyPath,
        cert: certPath
      };
    } catch (error) {
      console.error('执行OpenSSL命令失败:', error.message);
      console.log('请确保已安装OpenSSL并添加到系统PATH中');
      throw new Error('生成自签名证书失败');
    }
  } catch (error) {
    console.error('生成SSL证书时出错:', error);
    throw error;
  }
}

// 如果直接运行此脚本，则生成证书
if (require.main === module) {
  try {
    const result = generateSelfSignedCertificate();
    console.log('SSL证书生成完成');
    console.log('证书文件:');
    console.log(`- 私钥: ${result.key}`);
    console.log(`- 证书: ${result.cert}`);
  } catch (err) {
    console.error('SSL证书生成失败:', err);
    process.exit(1);
  }
}

module.exports = { generateSelfSignedCertificate };
