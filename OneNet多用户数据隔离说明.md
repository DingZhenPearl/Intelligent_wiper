# OneNet多用户数据隔离实现方案

## 概述

本项目已实现基于OneNet平台的多用户数据隔离功能。通过为每个用户创建独立的数据流，实现了在同一设备下不同用户数据的完全隔离。

## 实现原理

### 数据流命名规则
- **设备名称**: 所有用户共享同一个设备 `test`
- **数据流ID**: 每个用户拥有独立的数据流 `rain_info_{username}`
- **示例**:
  - 用户 `admin` 的数据流: `rain_info_admin`
  - 用户 `user1` 的数据流: `rain_info_user1`
  - 用户 `user2` 的数据流: `rain_info_user2`

### 技术架构
```
OneNet平台
├── 产品: 66eIb47012
└── 设备: test
    ├── 数据流: rain_info_admin (用户admin的数据)
    ├── 数据流: rain_info_user1 (用户user1的数据)
    └── 数据流: rain_info_user2 (用户user2的数据)
```

## 功能特性

### 1. 自动数据流创建
- 用户注册时自动为其创建专属的OneNet数据流
- 数据流创建失败不影响用户注册流程
- 支持手动创建数据流的API接口

### 2. 数据隔离
- 每个用户只能访问自己的数据流
- 数据同步、统计、原始数据获取都基于用户特定的数据流
- 完全的数据隔离，用户间数据互不干扰

### 3. 兼容性
- 保持原有API接口不变
- 自动根据用户名确定对应的数据流
- 支持现有的所有功能（实时数据、统计、原始数据等）

## 使用方法

### 1. 用户注册
1. 在登录页面选择"注册"
2. 输入用户名和密码
3. 系统自动为新用户创建OneNet数据流
4. 注册成功后可以正常登录使用

### 2. 数据同步
- 登录后，系统自动使用该用户的专属数据流
- 所有数据操作（获取、同步、统计）都基于用户的数据流
- 用户只能看到自己的雨量数据

### 3. 手动创建数据流（可选）
如果需要为现有用户手动创建数据流，可以调用API：
```javascript
// 前端调用
import oneNetService from '@/services/oneNetService'
const result = await oneNetService.createDatastreamForUser('username')
```

```bash
# 后端API调用
POST /api/rainfall/onenet/datastream/create
Content-Type: application/json
{
  "username": "用户名"
}
```

## 配置说明

### OneNet平台配置
确保以下配置正确设置在 `python/onenet_api.py` 中：
- `PRODUCT_ID`: OneNet产品ID
- `DEVICE_NAME`: 设备名称（所有用户共享）
- `ACCESS_KEY`: OneNet访问密钥

### 数据流命名
数据流ID格式：`rain_info_{username}`
- 基础前缀：`rain_info_`
- 用户标识：用户名
- 示例：用户 `john` 的数据流ID为 `rain_info_john`

## API接口

### 1. 创建数据流
```
POST /api/rainfall/onenet/datastream/create
参数: { "username": "用户名" }
返回: { "success": true, "datastream_id": "rain_info_用户名" }
```

### 2. 获取用户数据
所有现有的数据获取接口都会自动根据当前登录用户获取对应的数据流数据：
- `/api/rainfall/onenet` - 获取实时数据
- `/api/rainfall/onenet/stats` - 获取统计数据
- `/api/rainfall/onenet/raw` - 获取原始数据

## 优势

### 1. 成本效益
- 只需要一个OneNet设备
- 通过数据流隔离实现多用户支持
- 无需购买多个硬件设备

### 2. 数据安全
- 完全的用户数据隔离
- 用户只能访问自己的数据
- 防止数据泄露和混淆

### 3. 扩展性
- 支持无限数量的用户
- 每个用户都有独立的数据空间
- 易于管理和维护

## 注意事项

1. **OneNet限制**: 请确认OneNet平台对单个设备的数据流数量限制
2. **命名规范**: 用户名应避免特殊字符，建议使用字母、数字和下划线
3. **数据流管理**: 删除用户时需要手动清理对应的OneNet数据流
4. **权限控制**: 确保OneNet访问密钥的安全性

## 软件端数据流创建功能测试结果

### ✅ **已实现的功能**
1. **完整的API接口**: 前端和后端都有数据流创建API
2. **双重API支持**: 同时支持OneNet旧版和新版API
3. **详细的错误处理**: 提供完整的错误信息和建议
4. **自动重试机制**: 旧版API失败时自动尝试新版API

### ❌ **当前限制**
1. **旧版API认证问题**:
   - 错误: `auth failed: key: Rk9mVGdrQWE5dzJqWU12bzFsSFFpZWtRZDVWdTFZZlU=`
   - 原因: ACCESS_KEY可能不是正确的设备API-KEY格式
   - 解决方案: 需要在OneNet平台获取设备级别的API-KEY

2. **新版API路径问题**:
   - 错误: `404 page not found`
   - 原因: API路径可能已变更或需要不同的认证方式
   - 解决方案: 需要查找最新的OneNet API文档

### 🔧 **测试过的API方法**

#### 方法1: 旧版API (官方文档)
```
URL: http://api.heclouds.com/devices/{device_id}/datastreams
方法: POST
认证: api-key header
状态: 认证失败
```

#### 方法2: 新版API (数据点创建)
```
URL: https://iot-api.heclouds.com/datapoint/datapoints
方法: POST
认证: JWT token
状态: 404错误
```

### 💡 **推荐解决方案**

#### 立即可用方案
1. **手动创建数据流**: 在OneNet平台为每个用户手动创建数据流
2. **命名规范**: 使用 `rain_info_{username}` 格式
3. **软件端已准备就绪**: 一旦数据流存在，软件端的多用户隔离功能完全正常

#### 长期解决方案
1. **获取正确的API-KEY**: 联系OneNet技术支持获取设备级API-KEY
2. **更新API文档**: 查找OneNet最新的数据流创建API文档
3. **权限申请**: 可能需要申请数据流创建权限

## 故障排除

### 数据流创建失败
1. **检查API-KEY**: 确认使用的是设备级API-KEY而不是产品ACCESS_KEY
2. **验证设备ID**: 确认设备ID `2441202951` 是否正确
3. **网络连接**: 确认能够访问OneNet API服务器
4. **权限检查**: 验证API-KEY是否有创建数据流的权限

### 数据获取异常
1. 确认用户的数据流是否已创建
2. 检查数据流中是否有数据
3. 验证用户权限是否正确

### API认证问题
1. **旧版API**: 需要设备级API-KEY，格式可能与当前ACCESS_KEY不同
2. **新版API**: 需要确认正确的API端点和认证方式
3. **混合使用**: 不同操作可能需要不同版本的API

## 技术支持

### 当前状态
- ✅ **多用户数据隔离逻辑**: 完全实现
- ✅ **数据获取功能**: 正常工作
- ✅ **前端界面**: 支持多用户
- ❌ **自动数据流创建**: 需要OneNet平台配合

### 检查清单
1. 浏览器控制台的错误信息
2. 服务器日志中的详细错误
3. OneNet平台的设备和数据流状态
4. API-KEY的权限和格式
5. OneNet平台的API文档更新
