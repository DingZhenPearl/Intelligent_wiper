# 设备绑定功能实现文档

## 📋 概述

本文档描述了通过扩展users数据表实现的设备绑定功能，该功能允许软件激活后的虚拟设备与真实硬件设备共享相同的OneNET平台设备ID，实现无缝的数据同步和设备管理。

## 🏗️ 架构设计

### 数据流程
```
软件激活 → OneNET平台 → 获取设备ID → 存储到users表
                                        ↓
硬件上电 → HTTP查询users表 → 获取设备ID → MQTT连接OneNET平台
```

### 核心组件
1. **扩展的users表** - 存储设备绑定信息
2. **设备绑定服务** - 处理设备绑定业务逻辑
3. **硬件API接口** - 为硬件设备提供凭证查询
4. **访问日志系统** - 记录硬件设备访问情况

## 📊 数据库结构

### users表扩展字段
```sql
-- 设备激活相关字段
activation_code VARCHAR(20) NULL,
onenet_device_id VARCHAR(50) NULL,
onenet_device_name VARCHAR(100) NULL,
device_key TEXT NULL,
product_id VARCHAR(20) DEFAULT '66eIb47012',
serial_number VARCHAR(50) NULL,
device_model VARCHAR(100) DEFAULT '智能雨刷设备',
firmware_version VARCHAR(20) DEFAULT 'v2.0',

-- 硬件绑定相关字段
hardware_mac VARCHAR(17) NULL,
hardware_serial VARCHAR(50) NULL,
hardware_identifier VARCHAR(100) NULL,

-- 状态和时间字段
device_status ENUM('not_activated', 'virtual_only', 'hardware_bound', 'both_active') DEFAULT 'not_activated',
activated_at TIMESTAMP NULL,
last_hardware_access TIMESTAMP NULL,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

### hardware_access_logs表
```sql
CREATE TABLE hardware_access_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(50) NOT NULL,
    hardware_identifier VARCHAR(100) NULL,
    access_ip VARCHAR(45) NULL,
    request_type ENUM('get_credentials', 'status_update', 'heartbeat') DEFAULT 'get_credentials',
    response_status ENUM('success', 'failed', 'unauthorized') DEFAULT 'success',
    access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    request_details TEXT NULL,
    response_details TEXT NULL
);
```

## 🔧 API接口

### 1. 硬件设备凭证查询
```http
GET /api/hardware/device/credentials
```

**查询参数：**
- `activation_code` - 激活码（优先级最高）
- `mac` - MAC地址
- `serial` - 硬件序列号
- `hardware_id` - 硬件标识符

**响应示例：**
```json
{
  "success": true,
  "credentials": {
    "device_id": "2446090185",
    "device_name": "intelligent_wiper_user6",
    "product_id": "66eIb47012",
    "device_key": "base64编码的密钥",
    "mqtt_server": "183.230.40.39",
    "mqtt_port": 6002
  },
  "device_info": {
    "username": "user6",
    "activation_code": "WIPE-2550-92F7-98A9",
    "serial_number": "IW-2025-050",
    "device_model": "智能雨刷设备",
    "firmware_version": "v2.0",
    "device_status": "virtual_only",
    "activated_at": "2025-06-01T02:58:53.874Z"
  },
  "query_info": {
    "method": "activation_code",
    "client_ip": "192.168.1.100",
    "timestamp": "2025-06-01T10:30:00.000Z"
  }
}
```

### 2. 硬件设备状态更新
```http
POST /api/hardware/device/status
```

**请求体：**
```json
{
  "device_id": "2446090185",
  "mac": "AA:BB:CC:DD:EE:FF",
  "serial": "HW123456789",
  "status": "online",
  "timestamp": "2025-06-01T10:30:00.000Z"
}
```

### 3. 硬件访问日志查询
```http
GET /api/hardware/access-logs/{username}
```

## 🚀 部署和使用

### 1. 数据库初始化
```bash
# 初始化数据库表结构
python python/db_service.py --action init
```

### 2. 数据迁移（可选）
```bash
# 将现有JSON数据迁移到users表
node migrate_device_data.js

# 验证迁移结果
node migrate_device_data.js --verify
```

### 3. 启动服务
```bash
# 启动Node.js服务器
npm start
```

### 4. 硬件端集成
参考 `hardware_example.c` 文件中的示例代码：

```c
// 1. 获取硬件标识符
get_mac_address(mac_address, sizeof(mac_address));
read_activation_code_from_flash(activation_code, sizeof(activation_code));

// 2. 查询设备凭证
if (get_device_credentials_by_activation_code(activation_code, &credentials)) {
    // 3. 连接OneNET平台
    connect_to_onenet(&credentials);
}
```

## 🔒 安全特性

### 1. IP白名单
- 只允许本地网络和内网IP访问硬件API
- 支持的IP范围：
  - `127.0.0.1` - 本地回环
  - `192.168.0.0/16` - 私有网络A类
  - `10.0.0.0/8` - 私有网络B类
  - `172.16.0.0/12` - 私有网络C类

### 2. 访问日志
- 记录所有硬件设备的访问请求
- 包含IP地址、时间戳、请求详情
- 支持成功和失败状态跟踪

### 3. 设备状态管理
- `not_activated` - 未激活
- `virtual_only` - 仅虚拟激活
- `hardware_bound` - 硬件已绑定
- `both_active` - 虚拟和硬件都活跃

## 📱 硬件端实现指南

### 1. 网络配置
```c
#define LOCAL_SERVER_IP "192.168.1.100"  // 本地服务器IP
#define LOCAL_SERVER_PORT 3000           // 本地服务器端口
```

### 2. 设备标识符获取
```c
// MAC地址获取（需要根据硬件平台实现）
void get_mac_address(char *mac_buffer, size_t buffer_size);

// 激活码读取（从Flash或EEPROM）
void read_activation_code_from_flash(char *code_buffer, size_t buffer_size);
```

### 3. HTTP客户端实现
```c
// 发送HTTP GET请求获取设备凭证
int http_get(const char *url, char *response_buffer, size_t buffer_size);

// 解析JSON响应
int parse_credentials_response(const char *json_str, device_credentials_t *credentials);
```

### 4. MQTT连接
```c
// 使用获取的凭证连接OneNET平台
void connect_to_onenet(const device_credentials_t *credentials);
```

## 🔧 开发工具

### 1. 数据库操作
```bash
# 存储设备绑定信息
python python/db_service.py --action store_device_binding \
  --username user1 \
  --activation_code WIPE-2550-92F7-98A9 \
  --onenet_device_id 2446090185 \
  --onenet_device_name intelligent_wiper_user1

# 查询设备凭证
python python/db_service.py --action get_device_credentials \
  --activation_code WIPE-2550-92F7-98A9

# 获取用户设备信息
python python/db_service.py --action get_user_device_info \
  --username user1
```

### 2. API测试
```bash
# 测试硬件凭证查询
curl "http://localhost:3000/api/hardware/device/credentials?activation_code=WIPE-2550-92F7-98A9"

# 测试硬件状态更新
curl -X POST "http://localhost:3000/api/hardware/device/status" \
  -H "Content-Type: application/json" \
  -d '{"mac":"AA:BB:CC:DD:EE:FF","status":"online"}'
```

## 📊 监控和维护

### 1. 访问日志监控
```bash
# 查看用户的硬件访问日志
curl "http://localhost:3000/api/hardware/access-logs/user1"
```

### 2. 数据库维护
```sql
-- 查看设备绑定统计
SELECT device_status, COUNT(*) as count 
FROM users 
WHERE device_status != 'not_activated' 
GROUP BY device_status;

-- 查看最近的硬件访问
SELECT username, hardware_identifier, access_ip, access_time, response_status
FROM hardware_access_logs 
ORDER BY access_time DESC 
LIMIT 10;
```

## 🎯 最佳实践

1. **硬件端**：
   - 实现可靠的网络重连机制
   - 定期发送心跳包更新设备状态
   - 安全存储激活码和设备凭证

2. **服务端**：
   - 定期清理过期的访问日志
   - 监控异常的访问模式
   - 备份重要的设备绑定数据

3. **安全性**：
   - 使用HTTPS加密API通信
   - 实施设备证书验证
   - 定期轮换设备密钥

## 🔄 故障排除

### 常见问题

1. **硬件无法获取凭证**
   - 检查IP白名单配置
   - 验证激活码格式和有效性
   - 确认网络连接正常

2. **数据库连接失败**
   - 检查数据库服务状态
   - 验证连接参数配置
   - 确认数据库权限设置

3. **OneNET连接失败**
   - 验证设备凭证正确性
   - 检查MQTT服务器可达性
   - 确认设备在OneNET平台上的状态

通过以上实现，您的智能雨刷系统现在支持软件虚拟激活和真实硬件设备的无缝绑定，确保了数据的一致性和设备管理的便利性。
