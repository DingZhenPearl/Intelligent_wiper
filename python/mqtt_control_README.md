# OneNET MQTT 雨刷控制

本模块提供通过OneNET平台使用MQTT协议控制雨刷硬件的功能。

## 功能特点

- 通过MQTT协议连接OneNET平台
- 接收平台下发的雨刷控制命令
- 上报雨刷当前状态
- 支持多种雨刷控制模式：关闭(off)、低速(low)、中速(medium)、高速(high)

## 文件说明

- `onenet_mqtt_control.py`: MQTT服务主程序，用于连接OneNET平台并处理命令
- `test_mqtt_control.py`: 测试工具，用于通过OneNET API发送控制命令和查询状态

## 安装依赖

确保已安装以下Python库：

```bash
pip install paho-mqtt requests
```

## 使用方法

### 启动MQTT控制服务

```bash
python onenet_mqtt_control.py --action start
```

这将启动MQTT服务，连接到OneNET平台并等待命令。

### 停止MQTT控制服务

```bash
python onenet_mqtt_control.py --action stop
```

### 查询雨刷当前状态

```bash
python onenet_mqtt_control.py --action status
```

### 直接控制雨刷

```bash
python onenet_mqtt_control.py --action control --status [off|low|medium|high]
```

例如，设置雨刷为高速模式：

```bash
python onenet_mqtt_control.py --action control --status high
```

### 使用测试工具发送命令

```bash
python test_mqtt_control.py --action control --command [off|low|medium|high]
```

例如，发送命令将雨刷设置为低速模式：

```bash
python test_mqtt_control.py --action control --command low
```

### 使用测试工具查询状态

```bash
python test_mqtt_control.py --action status
```

## OneNET平台配置

在使用本模块前，需要在OneNET平台上进行以下配置：

1. 确保已创建产品和设备
2. 在产品的物模型中添加以下属性：
   - `wiper_control`: 雨刷控制命令，枚举类型，可选值：off, low, medium, high
   - `wiper_status`: 雨刷当前状态，枚举类型，可选值：off, low, medium, high

## 集成到硬件

要将此控制功能集成到实际硬件中，需要修改 `onenet_mqtt_control.py` 文件中的 `control_wiper()` 函数，实现与硬件的通信逻辑。

例如，如果使用树莓派控制雨刷电机，可以添加GPIO控制代码；如果通过串口与Arduino通信，可以添加串口通信代码。

## 故障排除

- 如果连接失败，请检查网络连接和OneNET平台的配置信息
- 确保产品ID、设备名称和访问密钥正确
- 检查物模型中是否正确定义了雨刷控制相关的属性
- 查看日志输出，了解详细的错误信息

## 注意事项

- 本模块依赖于 `onenet_api.py` 中的配置信息和token生成函数
- 确保设备在OneNET平台上处于激活状态
- 命令下发可能存在延迟，取决于网络状况和平台负载
