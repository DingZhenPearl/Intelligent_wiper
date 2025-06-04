# 硬件端数据格式规范

## 📋 概述

本文档详细说明了真实硬件设备需要处理的数据格式，包括接收命令格式、响应数据格式、MQTT主题规范等，为硬件测试提供完整的技术规范。

## 🔌 通信协议

### 协议类型
- **主要协议**: OneNET HTTP同步命令API
- **备用协议**: MQTT (用于状态上报和心跳)
- **数据格式**: JSON

### OneNET平台配置
- **产品ID**: `66eIb47012`
- **设备认证**: 设备级密钥认证
- **通信加密**: HTTPS/TLS

## 📥 接收命令格式

### 1. 雨刷控制命令

**HTTP同步命令接收格式**:
```json
{
  "wiper_control": "low",
  "timestamp": 1748914005,
  "source": "http_sync_command",
  "command_id": "wiper_ctrl_1748914005375",
  "user": "admin"
}
```

**字段说明**:
- `wiper_control` (string, 必需): 雨刷控制命令
  - 有效值: `"off"`, `"interval"`, `"low"`, `"high"`, `"smart"`
- `timestamp` (integer, 必需): Unix时间戳
- `source` (string, 可选): 命令来源标识
- `command_id` (string, 可选): 唯一命令ID，用于追踪
- `user` (string, 可选): 发送命令的用户名

### 2. 状态查询命令

**格式**:
```json
{
  "wiper_status_query": true,
  "timestamp": 1748914005,
  "source": "http_sync_command",
  "command_id": "wiper_status_1748914005375",
  "user": "admin"
}
```

**字段说明**:
- `wiper_status_query` (boolean, 必需): 状态查询标识，值为 `true`
- 其他字段与控制命令相同

### 3. 通用状态查询命令 (MQTT)

**格式**:
```json
{
  "get_status": true
}
```

## 📤 响应数据格式

### 1. 雨刷控制成功响应

```json
{
  "errno": 0,
  "data": {
    "wiper_status": "low",
    "previous_status": "off",
    "message": "雨刷已切换到低速模式",
    "timestamp": "2025-06-03T09:26:46.591117",
    "battery_level": 85,
    "signal_strength": 92,
    "command_id": "wiper_ctrl_1748914005375",
    "user": "admin"
  }
}
```

**字段说明**:
- `errno` (integer, 必需): 错误码，0表示成功
- `data` (object, 成功时必需): 响应数据
  - `wiper_status` (string): 当前雨刷状态
  - `previous_status` (string): 之前的雨刷状态
  - `message` (string): 中文状态描述
  - `timestamp` (string): ISO格式时间戳
  - `battery_level` (integer): 电池电量 (0-100)
  - `signal_strength` (integer): 信号强度 (0-100)
  - `command_id` (string): 原命令ID
  - `user` (string): 原用户名

### 2. 状态查询成功响应

```json
{
  "errno": 0,
  "data": {
    "wiper_status": "smart",
    "message": "当前雨刷状态: 智能",
    "timestamp": "2025-06-03T09:26:46.591117",
    "battery_level": 85,
    "signal_strength": 92,
    "command_id": "wiper_status_1748914005375",
    "user": "admin"
  }
}
```

### 3. 错误响应格式

**无效命令错误**:
```json
{
  "errno": 1,
  "error": "无效的雨刷命令: invalid_command",
  "message": "命令必须是以下值之一: off, interval, low, high, smart",
  "command_id": "wiper_ctrl_1748914005375"
}
```

**未知命令错误**:
```json
{
  "errno": 2,
  "error": "Unknown command",
  "message": "未知的命令类型",
  "received_data": {
    "invalid_field": "invalid_value"
  }
}
```

**处理失败错误**:
```json
{
  "errno": 3,
  "error": "Command processing failed",
  "message": "命令处理失败: 具体错误信息"
}
```

## 🎯 MQTT主题规范

### 接收命令主题
```
$sys/{product_id}/{device_name}/cmd/request/{cmdid}
```

**示例**:
```
$sys/66eIb47012/intelligent_wiper_user1/cmd/request/12345678
```

### 发送响应主题
```
$sys/{product_id}/{device_name}/cmd/response/{cmdid}
```

**示例**:
```
$sys/66eIb47012/intelligent_wiper_user1/cmd/response/12345678
```

### 状态上报主题
```
$sys/{product_id}/{device_name}/dp/post/json
```

**示例**:
```
$sys/66eIb47012/intelligent_wiper_user1/dp/post/json
```

## 🔧 硬件实现要求

### 1. 命令处理逻辑

```c
// 伪代码示例
typedef enum {
    WIPER_OFF = 0,
    WIPER_INTERVAL = 1,
    WIPER_LOW = 2,
    WIPER_HIGH = 3,
    WIPER_SMART = 4
} wiper_mode_t;

int process_wiper_command(const char* command) {
    if (strcmp(command, "off") == 0) {
        return set_wiper_mode(WIPER_OFF);
    } else if (strcmp(command, "interval") == 0) {
        return set_wiper_mode(WIPER_INTERVAL);
    } else if (strcmp(command, "low") == 0) {
        return set_wiper_mode(WIPER_LOW);
    } else if (strcmp(command, "high") == 0) {
        return set_wiper_mode(WIPER_HIGH);
    } else if (strcmp(command, "smart") == 0) {
        return set_wiper_mode(WIPER_SMART);
    } else {
        return -1; // 无效命令
    }
}
```

### 2. JSON解析要求

硬件需要能够解析以下JSON结构:
- 提取 `wiper_control` 字段
- 提取 `wiper_status_query` 字段
- 提取 `command_id` 和 `user` 字段用于响应

### 3. 响应构建要求

硬件需要能够构建标准的JSON响应:
- 包含 `errno` 错误码
- 成功时包含 `data` 对象
- 失败时包含 `error` 和 `message` 字段

## 📊 设备状态管理

### 设备状态结构
```json
{
  "wiper_status": "off",
  "battery_level": 85,
  "signal_strength": 92,
  "temperature": 25.5,
  "humidity": 60,
  "online": true,
  "last_update": "2025-06-03T09:26:46.591117"
}
```

### 状态更新频率
- **命令响应**: 立即
- **心跳上报**: 每30秒
- **状态变化**: 实时上报

## 🔒 安全要求

### 1. 设备认证
- 使用OneNET设备级密钥
- 支持设备密钥轮换
- 验证命令来源合法性

### 2. 命令验证
- 验证命令格式正确性
- 检查命令参数有效性
- 记录命令执行日志

### 3. 错误处理
- 优雅处理无效命令
- 提供详细错误信息
- 防止命令注入攻击

## 🧪 测试用例

### 1. 基本功能测试

**测试命令**:
```json
{"wiper_control": "low", "command_id": "test_001", "user": "test"}
```

**期望响应**:
```json
{
  "errno": 0,
  "data": {
    "wiper_status": "low",
    "message": "雨刷已切换到低速模式",
    "command_id": "test_001"
  }
}
```

### 2. 错误处理测试

**测试命令**:
```json
{"wiper_control": "invalid", "command_id": "test_002"}
```

**期望响应**:
```json
{
  "errno": 1,
  "error": "无效的雨刷命令: invalid",
  "command_id": "test_002"
}
```

### 3. 状态查询测试

**测试命令**:
```json
{"wiper_status_query": true, "command_id": "test_003"}
```

**期望响应**:
```json
{
  "errno": 0,
  "data": {
    "wiper_status": "low",
    "message": "当前雨刷状态: 低速",
    "command_id": "test_003"
  }
}
```

## 🚀 部署建议

### 1. 硬件配置
- 确保网络连接稳定
- 配置正确的OneNET设备信息
- 设置合适的心跳间隔

### 2. 调试工具
- 使用串口监控命令接收
- 记录详细的执行日志
- 监控网络连接状态

### 3. 性能优化
- 优化JSON解析性能
- 减少内存使用
- 提高命令响应速度

## 📁 配套文件

### 1. 硬件测试工具
- `test_hardware_commands.py` - 硬件命令测试脚本
- `hardware_simulator.c` - C语言硬件模拟器示例
- `hardware_test_cases.json` - 标准测试用例

### 2. 配置文件
- `device_config.json` - 设备配置模板
- `onenet_credentials.json` - OneNET认证信息模板

---

**总结**: 硬件端需要实现标准的JSON命令解析、雨刷控制逻辑、状态管理和错误处理，确保与OneNET平台的完整兼容性。
