# 激活码批量生成程序

## 📋 概述

本项目提供了完整的激活码批量生成解决方案，支持多种格式和自定义配置。

## 🚀 快速开始

### 1. 快速生成（推荐）

```bash
# 快速生成10个标准激活码
node quick_generate.js
```

### 2. 查看当前统计

```bash
# 查看激活码使用统计
node generate_activation_codes.js --stats
```

### 3. 自定义生成

```bash
# 生成20个激活码
node generate_activation_codes.js -c 20

# 生成50个TEST前缀的激活码
node generate_activation_codes.js -c 50 -p TEST

# 生成随机格式的激活码
node generate_activation_codes.js -f random -c 10
```

## 📖 详细用法

### 命令行选项

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--count` | `-c` | 生成数量 | 10 |
| `--prefix` | `-p` | 激活码前缀 | WIPER |
| `--year` | `-y` | 年份 | 当前年份 |
| `--format` | `-f` | 格式类型 | simple |
| `--start` | `-s` | 起始索引 | 自动计算 |
| `--model` | `-m` | 设备型号 | 智能雨刷设备 |
| `--firmware` | | 固件版本 | v2.0 |
| `--stats` | | 显示统计 | - |
| `--help` | `-h` | 帮助信息 | - |

### 激活码格式

#### 1. Standard 格式（默认，16位）
```
WIPE-2535-2E3E-B1D2
WIPE-2536-1603-E3A4
...
```
- 格式：`XXXX-XXXX-XXXX-XXXX`（16位，不含连字符）
- 包含前缀信息、年份、索引和随机部分
- 标准的激活码格式，推荐使用

#### 2. Simple 格式（向后兼容）
```
WIPER-2025-0001
WIPER-2025-0002
...
```
- 格式：`前缀-年份-序号`
- 序号自动递增，4位数字，前导零填充
- 保持向后兼容性

#### 3. Random 格式（16位纯随机）
```
6517-A56B-AF1C-1F7D
2542-AD62-A78E-CC15
...
```
- 格式：`XXXX-XXXX-XXXX-XXXX`（16位纯随机）
- 完全随机生成，无规律可循
- 安全性最高

#### 4. UUID 格式（16位UUID）
```
8348-8A96-2B0E-4903
B5E4-FE36-57C2-405F
...
```
- 格式：`XXXX-XXXX-XXXX-XXXX`（基于UUID）
- 基于UUID生成，确保全球唯一性
- 适合大规模部署

#### 5. Mixed 格式（混合）
```
WI25-33D9-A71B-F4AB
WI25-34EB-E85B-7EC9
...
```
- 格式：`前缀年份-索引随机-随机-随机`
- 结合前缀、年份、索引和随机部分
- 平衡可读性和安全性

## 📊 使用示例

### 基础生成
```bash
# 生成10个16位标准激活码（推荐）
node generate_activation_codes.js

# 生成50个16位标准激活码
node generate_activation_codes.js 50
```

### 自定义前缀
```bash
# 生成测试用激活码
node generate_activation_codes.js -c 20 -p TEST

# 生成演示用激活码
node generate_activation_codes.js -c 10 -p DEMO
```

### 不同格式
```bash
# 生成16位纯随机激活码
node generate_activation_codes.js -f random -c 15

# 生成16位UUID格式激活码
node generate_activation_codes.js -f uuid -c 5

# 生成混合格式激活码
node generate_activation_codes.js -f mixed -c 10 -p PROD

# 生成简单格式激活码（向后兼容）
node generate_activation_codes.js -f simple -c 20
```

### 指定年份和起始索引
```bash
# 生成2024年的激活码
node generate_activation_codes.js -y 2024 -c 10

# 从索引100开始生成
node generate_activation_codes.js -s 100 -c 20
```

## 📁 文件结构

```
├── generate_activation_codes.js    # 主生成程序
├── quick_generate.js               # 快速生成脚本
├── server/data/device_activations.json  # 激活码数据文件
└── ACTIVATION_CODES_README.md      # 说明文档
```

## 🔧 数据格式

激活码数据存储在 `server/data/device_activations.json` 中：

```json
{
  "activations": {
    "username": {
      "deviceId": "设备ID",
      "activationCode": "激活码",
      "activatedAt": "激活时间"
    }
  },
  "activationCodes": {
    "WIPE-2535-2E3E-B1D2": {
      "isUsed": false,
      "deviceModel": "智能雨刷设备",
      "serialNumber": "IW-2025-035",
      "firmwareVersion": "v2.0",
      "generatedAt": "2025-06-01T09:02:34.620Z"
    },
    "WIPER-2025-0001": {
      "isUsed": false,
      "deviceModel": "智能雨刷设备",
      "serialNumber": "IW-2025-001",
      "firmwareVersion": "v2.0",
      "generatedAt": "2025-05-31T15:30:00.000Z"
    }
  }
}
```

## 🎯 最佳实践

### 1. 生产环境
```bash
# 生成大批量16位标准激活码（推荐）
node generate_activation_codes.js -c 100

# 快速生成10个标准激活码
node quick_generate.js

# 查看库存
node generate_activation_codes.js --stats
```

### 2. 测试环境
```bash
# 生成测试用16位随机激活码
node generate_activation_codes.js -c 20 -p TEST -f random

# 生成演示用16位UUID激活码
node generate_activation_codes.js -c 10 -p DEMO -f uuid

# 生成简单格式激活码（调试用）
node generate_activation_codes.js -c 5 -f simple
```

### 3. 特殊需求
```bash
# 生成特定年份的激活码
node generate_activation_codes.js -y 2024 -c 50

# 生成特定设备型号的激活码
node generate_activation_codes.js -m "智能雨刷Pro" --firmware "v3.0"
```

## ⚠️ 注意事项

1. **唯一性保证**：程序会自动检查重复，跳过已存在的激活码
2. **索引管理**：起始索引会自动计算，确保连续性
3. **数据备份**：建议定期备份 `device_activations.json` 文件
4. **权限管理**：确保程序有读写数据文件的权限

## 🔍 故障排除

### 常见问题

1. **文件权限错误**
   ```bash
   # 检查文件权限
   ls -la server/data/device_activations.json
   ```

2. **JSON格式错误**
   ```bash
   # 验证JSON格式
   node -e "console.log(JSON.parse(require('fs').readFileSync('server/data/device_activations.json')))"
   ```

3. **重复激活码**
   - 程序会自动跳过重复的激活码
   - 检查 `--start` 参数是否设置正确

## 📈 性能说明

- **生成速度**：每秒可生成数千个激活码
- **内存使用**：轻量级，适合大批量生成
- **文件大小**：每个激活码约占用200字节存储空间

## 🔄 版本历史

- **v1.0.0**：基础激活码生成功能
- **v1.1.0**：添加多种格式支持
- **v1.2.0**：添加统计和快速生成功能
