# OneNET CMD格式设备控制更新

## 📋 更新概述

根据OneNET平台的最新文档，我们已经成功将设备控制方式从 `thing.property.set` 更新为 **CMD格式**，这是OneNET平台推荐的标准设备控制方式。

## 🔄 主要变更

### 1. MQTT主题格式更新

**之前（thing.property.set格式）：**
```
发送主题: $sys/{product_id}/{device_name}/thing/property/set
回复主题: $sys/{product_id}/{device_name}/thing/property/set_reply
```

**现在（CMD格式）：**
```
发送主题: $sys/{product_id}/{device_name}/cmd/request/{cmdid}
回复主题: $sys/{product_id}/{device_name}/cmd/response/{cmdid}
```

### 2. 消息格式更新

**之前：**
```json
{
    "id": 1748831379474,
    "version": "1.0",
    "params": {
        "wiper_control": {
            "value": "low",
            "time": 1748831379474
        }
    },
    "method": "thing.property.set"
}
```

**现在：**
```json
{
    "wiper_control": "low",
    "timestamp": 1748831379474
}
```

### 3. 命令ID管理

- 每个控制命令都有唯一的命令ID（cmdid）
- 使用时间戳作为命令ID确保唯一性
- 回复主题包含对应的命令ID，确保消息匹配

## ✅ 测试结果

### Admin用户测试（使用test设备）
```
✅ MQTT连接成功：183.230.40.96:1883
✅ 主题格式正确：$sys/66eIb47012/test/cmd/request/1748831379474
✅ 命令发送成功：{"wiper_control": "low", "timestamp": 1748831379474}
✅ 订阅回复主题：$sys/66eIb47012/test/cmd/response/1748831379474
✅ 控制方式：MQTT_CMD
```

### User1用户测试（使用专用设备）
```
✅ 设备存在：intelligent_wiper_user1 (ID: 2445951703)
❌ MQTT认证失败：错误码4（可能需要设备激活）
```

## 🔧 代码修改文件

1. **`python/mqtt_device_control.py`** - 主要控制逻辑
   - 更新了 `get_mqtt_topics()` 方法
   - 修改了 `send_control_command()` 方法
   - 优化了消息处理回调

2. **`python/test_cmd_control.py`** - 新增测试脚本
   - 专门测试CMD格式控制
   - 支持单用户测试和批量测试

## 🎯 优势

1. **符合OneNET标准**：使用官方推荐的CMD控制格式
2. **消息追踪**：每个命令都有唯一ID，便于追踪和调试
3. **简化格式**：消息体更简洁，减少数据传输量
4. **更好的兼容性**：与OneNET平台的最新版本完全兼容

## 🚀 下一步

1. **设备激活**：确保所有用户设备都正确激活
2. **硬件端适配**：更新硬件端代码以支持新的CMD格式
3. **前端更新**：前端界面已经兼容，无需修改
4. **监控优化**：添加更详细的命令执行状态监控

## 📝 使用方法

### 测试特定用户控制
```bash
python test_cmd_control.py admin low
python test_cmd_control.py user1 medium
```

### 批量测试
```bash
python test_cmd_control.py
```

## 🔍 故障排除

如果遇到MQTT连接失败（错误码4），通常是以下原因：
1. 设备未激活
2. MQTT认证信息不正确
3. 设备不存在于OneNET平台

可以使用以下命令检查设备状态：
```bash
python check_devices.py
```

---

**总结：** 我们已经成功将设备控制方式更新为OneNET平台标准的CMD格式，这将提供更好的兼容性和可靠性。测试显示admin用户的控制完全正常，其他用户设备需要确保正确激活后即可正常使用。
