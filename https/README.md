# HTTPS 相关文件

本目录包含与 HTTPS 配置相关的所有文件和脚本。

## 文件说明

- `generate-ssl-cert.js` - 使用 OpenSSL 生成自签名 SSL 证书的脚本
- `generate-ssl-cert-windows.js` - 为 Windows 环境优化的 SSL 证书生成脚本
- `generate-ssl-cert-mkcert.js` - 使用 mkcert 工具生成 SSL 证书的脚本
- `HTTPS-README.md` - 关于如何在服务器端使用 HTTPS 的详细说明
- `SSL-README.md` - 关于如何在本地开发环境中使用 HTTPS 的详细说明

## 使用方法

### 生成 SSL 证书

选择以下任一方法生成 SSL 证书：

```bash
# 使用 OpenSSL（通用方法）
node https/generate-ssl-cert.js

# 在 Windows 环境中使用 OpenSSL
node https/generate-ssl-cert-windows.js

# 使用 mkcert 工具（推荐，需要先安装 mkcert）
node https/generate-ssl-cert-mkcert.js
```

这些脚本会在项目根目录下创建 `ssl` 文件夹，并在其中生成 `key.pem` 和 `cert.pem` 文件。

### 使用 HTTPS 启动开发服务器

生成证书后，您可以使用以下命令启动开发服务器：

```bash
npm run serve
```

如果证书文件存在，服务器将自动使用 HTTPS 协议启动。

### 使用 HTTPS 启动后端服务器

使用以下命令启动后端服务器：

```bash
node start-server.js
```

按照提示操作，选择是否生成证书和是否强制使用 HTTPS。

## 更多信息

- 有关服务器端 HTTPS 配置的详细信息，请参阅 [HTTPS-README.md](./HTTPS-README.md)
- 有关本地开发环境中 HTTPS 配置的详细信息，请参阅 [SSL-README.md](./SSL-README.md)
