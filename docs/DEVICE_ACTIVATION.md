# 设备激活功能文档

## 功能概述

设备激活功能允许用户通过激活码将物理硬件设备与其账号绑定，实现设备的个人化管理和数据隔离。

## 功能特点

### 🔐 安全激活
- 每个激活码只能使用一次
- 每个用户账号只能激活一台设备
- 激活码格式验证：XXXX-XXXX-XXXX-XXXX

### 📱 用户友好界面
- 直观的激活状态显示
- 详细的激活说明和提示
- 实时的激活进度反馈

### 🔧 设备管理
- 显示设备详细信息（型号、序列号、固件版本）
- 记录激活时间
- 设备状态监控

## 使用流程

### 1. 用户购买硬件
- 硬件厂商提供激活码（印在包装上或随机附送）
- 激活码格式：XXXX-XXXX-XXXX-XXXX

### 2. 用户激活设备
1. 登录智能雨刷系统
2. 进入"设置"页面
3. 找到"设备激活"区域
4. 输入激活码
5. 点击"激活设备"按钮
6. 等待激活完成

### 3. 激活成功
- 设备与用户账号绑定
- 显示设备详细信息
- 开始接收设备数据

## API接口

### 获取设备激活状态
```
GET /api/device/activation/status?username={username}
```

**响应示例：**
```json
{
  "success": true,
  "isActivated": true,
  "deviceId": "device_admin_1703123456789",
  "serialNumber": "IWC-2024-001",
  "deviceModel": "智能雨刷控制器 Pro",
  "firmwareVersion": "v1.2.0",
  "activatedAt": "2024-12-21T10:30:45.123Z"
}
```

### 激活设备
```
POST /api/device/activation/activate
```

**请求体：**
```json
{
  "username": "admin",
  "activationCode": "TEST-1234-ABCD-5678"
}
```

**响应示例：**
```json
{
  "success": true,
  "message": "设备激活成功",
  "deviceId": "device_admin_1703123456789",
  "serialNumber": "IWC-2024-001",
  "deviceModel": "智能雨刷控制器 Pro",
  "firmwareVersion": "v1.2.0",
  "activatedAt": "2024-12-21T10:30:45.123Z"
}
```

### 获取可用激活码（开发测试用）
```
GET /api/device/activation/codes
```

**响应示例：**
```json
{
  "success": true,
  "availableCodes": [
    {
      "code": "TEST-1234-ABCD-5678",
      "deviceModel": "智能雨刷控制器 Pro",
      "serialNumber": "IWC-2024-001",
      "firmwareVersion": "v1.2.0"
    }
  ],
  "message": "此接口仅用于开发测试，生产环境中应该移除"
}
```

## 测试激活码

为了方便开发和测试，系统预设了以下激活码：

| 激活码 | 设备型号 | 序列号 | 固件版本 |
|--------|----------|--------|----------|
| TEST-1234-ABCD-5678 | 智能雨刷控制器 Pro | IWC-2024-001 | v1.2.0 |
| DEMO-5678-EFGH-9012 | 智能雨刷控制器 Standard | IWC-2024-002 | v1.1.0 |
| PROD-9012-IJKL-3456 | 智能雨刷控制器 Pro Max | IWC-2024-003 | v1.3.0 |

## 数据存储

激活信息存储在 `server/data/device_activations.json` 文件中：

```json
{
  "activations": {
    "admin": {
      "deviceId": "device_admin_1703123456789",
      "activationCode": "TEST-1234-ABCD-5678",
      "serialNumber": "IWC-2024-001",
      "deviceModel": "智能雨刷控制器 Pro",
      "firmwareVersion": "v1.2.0",
      "activatedAt": "2024-12-21T10:30:45.123Z"
    }
  },
  "activationCodes": {
    "TEST-1234-ABCD-5678": {
      "isUsed": true,
      "usedBy": "admin",
      "usedAt": "2024-12-21T10:30:45.123Z",
      "deviceModel": "智能雨刷控制器 Pro",
      "serialNumber": "IWC-2024-001",
      "firmwareVersion": "v1.2.0"
    }
  }
}
```

## OneNET平台集成

### 当前实现
- ✅ **真实OneNET设备创建** - 调用OneNET平台API创建设备
- ✅ **Python脚本集成** - 使用现有的onenet_api.py脚本
- ✅ **设备激活服务** - oneNetActivationService.js处理激活逻辑
- ✅ **本地数据存储** - 记录激活状态和设备信息
- ✅ **激活状态管理** - 完整的设备生命周期管理

### 激活流程
1. **验证激活码** - 检查激活码有效性和使用状态
2. **调用OneNET API** - 通过Python脚本在OneNET平台创建设备
3. **设备绑定** - 将OneNET设备与用户账号绑定
4. **状态记录** - 保存激活信息到本地数据库
5. **前端更新** - 实时更新设备状态显示

### 技术架构
```
前端设置页面 → 后端API → OneNET激活服务 → Python脚本 → OneNET平台
     ↓              ↓              ↓              ↓              ↓
  用户输入激活码  验证激活码    调用设备创建    执行API调用    创建设备
     ↓              ↓              ↓              ↓              ↓
  显示激活状态    保存激活信息   返回设备信息    返回设备ID    设备上线
```

### 集成组件
1. **前端组件**: `src/views/Settings/index.vue` - 设备激活界面
2. **后端路由**: `server/routes/deviceActivationRoutes.js` - 激活API
3. **激活服务**: `server/services/oneNetActivationService.js` - 核心激活逻辑
4. **Python脚本**: `python/onenet_api.py` - OneNET平台API调用
5. **数据存储**: `server/data/device_activations.json` - 激活记录

## 安全考虑

### 激活码安全
- 激活码应该由硬件厂商安全生成
- 建议使用加密传输
- 激活码应该有有效期限制

### 用户验证
- 激活前验证用户身份
- 记录激活操作日志
- 防止恶意激活攻击

### 数据保护
- 激活信息加密存储
- 定期备份激活数据
- 访问权限控制

## 故障排除

### 常见问题

1. **激活码格式错误**
   - 确保格式为：XXXX-XXXX-XXXX-XXXX
   - 检查是否包含特殊字符

2. **激活码已被使用**
   - 每个激活码只能使用一次
   - 联系厂商获取新的激活码

3. **用户已激活设备**
   - 每个用户只能激活一台设备
   - 如需更换设备，请联系管理员

4. **网络连接问题**
   - 检查网络连接
   - 确认服务器状态

### 日志查看
激活相关日志会记录在服务器控制台中，搜索关键词：
- `[设备激活]`
- `device activation`
- `activation code`

## 开发测试

### 测试页面
访问激活码测试页面（仅开发环境）：
```
http://localhost:3000/dev/activation-codes
```

### 重置测试数据
删除激活数据文件重新开始测试：
```bash
rm server/data/device_activations.json
```

重启服务器后会自动重新生成测试数据。
