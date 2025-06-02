#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MQTT设备模拟器 - 模拟真实雨刷设备的MQTT行为
用于接收CMD命令并回复，模拟设备端的完整行为
"""

import json
import time
import argparse
import paho.mqtt.client as mqtt
from datetime import datetime
import random
import threading

# 从配置文件导入OneNET配置
try:
    from onenet_api import PRODUCT_ID, DEVICE_NAME, ACCESS_KEY
except ImportError:
    # 如果配置文件不存在，使用默认配置
    PRODUCT_ID = "66eIb47012"
    DEVICE_NAME = "test"
    ACCESS_KEY = "Rk9mVGdrQWE5dzJqWU12bzFsSFFpZWtRZDVWdTFZZlU="

# MQTT服务器配置
MQTT_HOST = "mqtts.heclouds.com"
MQTT_PORT = 1883
MQTT_KEEPALIVE = 120

# 全局变量
mqtt_client = None
running = True
current_device_name = DEVICE_NAME  # 保持兼容性
current_username = "admin"
current_real_device_name = None     # 真实设备名称（用于主题）
current_virtual_device_name = None  # 虚拟设备名称（用于连接）

# 设备状态
device_state = {
    "wiper_status": "off",  # 雨刷状态：off, interval, low, high, smart
    "battery_level": 85,    # 电池电量
    "signal_strength": 92,  # 信号强度
    "temperature": 25.5,    # 温度
    "humidity": 60,         # 湿度
    "last_update": datetime.now().isoformat(),
    "online": True
}

def log(message):
    """输出日志信息"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] DEVICE_SIM: {message}")

def get_user_device_config(username):
    """根据用户名获取设备配置"""
    # 使用onenet_api中的配置函数
    try:
        from onenet_api import get_user_device_config as get_config
        config = get_config(username)

        return {
            "real_device_name": config.get("device_name", DEVICE_NAME),
            "virtual_device_name": config.get("virtual_device_name", f"{DEVICE_NAME}_virtual"),
            "product_id": PRODUCT_ID
        }
    except ImportError:
        # 回退到简化配置
        if username == "admin":
            return {
                "real_device_name": "test",
                "virtual_device_name": "test_virtual",
                "product_id": PRODUCT_ID
            }
        else:
            return {
                "real_device_name": f"intelligent_wiper_{username}",
                "virtual_device_name": f"intelligent_wiper_{username}_virtual",
                "product_id": PRODUCT_ID
            }

def get_mqtt_topics(device_name, cmdid=None):
    """根据设备名称获取MQTT主题"""
    if cmdid is None:
        cmdid = int(time.time() * 1000)
    
    return {
        'command_request': f"$sys/{PRODUCT_ID}/{device_name}/cmd/request/+",
        'command_response': f"$sys/{PRODUCT_ID}/{device_name}/cmd/response/{cmdid}",
        'property_post': f"$sys/{PRODUCT_ID}/{device_name}/dp/post/json",
        'property_post_reply': f"$sys/{PRODUCT_ID}/{device_name}/dp/post/json/accepted",
        'cmdid': cmdid
    }

def connect_mqtt():
    """连接到MQTT服务器"""
    global mqtt_client, current_virtual_device_name, current_real_device_name

    try:
        # 🔧 正确架构：设备模拟器连接真实设备，模拟真实硬件行为
        # 获取设备配置
        device_config = get_user_device_config(current_username)
        current_real_device_name = device_config["real_device_name"]  # 使用本地函数返回的键名
        current_virtual_device_name = device_config["virtual_device_name"]

        log(f"🎯 设备模拟器架构:")
        log(f"   连接设备: {current_real_device_name} (真实设备)")
        log(f"   模拟角色: 真实硬件设备")
        log(f"   虚拟设备: {current_virtual_device_name} (供前端连接)")

        # 创建MQTT客户端，使用真实设备名称作为客户端ID（OneNET要求）
        client_id = current_real_device_name
        mqtt_client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)

        # 设置回调函数
        mqtt_client.on_connect = on_connect
        mqtt_client.on_disconnect = on_disconnect
        mqtt_client.on_message = on_message

        # 🔧 使用真实设备的认证信息
        try:
            from onenet_api import get_device_key, generate_device_token

            # 获取真实设备密钥
            device_key = get_device_key(current_real_device_name)
            if not device_key:
                log(f"❌ 无法获取真实设备 {current_real_device_name} 的密钥")
                return False

            # 生成真实设备token
            device_token = generate_device_token(current_real_device_name, device_key)
            if not device_token:
                log("❌ 生成真实设备token失败，无法连接MQTT服务器")
                return False

            log(f"✅ 使用真实设备token进行认证")
            mqtt_client.username_pw_set(PRODUCT_ID, device_token)

        except ImportError as e:
            log(f"❌ 无法导入onenet_api模块: {e}")
            log("💡 请确保onenet_api.py文件存在且可导入")
            return False
        except Exception as e:
            log(f"❌ 真实设备认证失败: {e}")
            return False

        log(f"🔌 正在连接到MQTT服务器: {MQTT_HOST}:{MQTT_PORT}")
        log(f"📱 客户端ID: {client_id}")
        log(f"🏭 产品ID: {PRODUCT_ID}")
        log(f"📟 真实设备名称: {current_real_device_name}")
        log(f"🎯 虚拟设备名称: {current_virtual_device_name}")

        # 连接到MQTT服务器
        mqtt_client.connect(MQTT_HOST, MQTT_PORT, MQTT_KEEPALIVE)

        # 启动网络循环
        mqtt_client.loop_start()

        # 等待连接建立
        time.sleep(3)  # 增加等待时间

        return True

    except Exception as e:
        log(f"❌ 连接MQTT服务器失败: {e}")
        import traceback
        log(f"详细错误: {traceback.format_exc()}")
        return False

def disconnect_mqtt():
    """断开MQTT连接"""
    global mqtt_client
    
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        log("已断开MQTT连接")

def on_connect(client, userdata, flags, rc, *args):
    """MQTT连接回调函数"""
    global current_real_device_name, current_virtual_device_name

    if rc == 0:
        log(f"✅ 设备模拟器成功连接到MQTT服务器: {MQTT_HOST}")
        log(f"🔗 连接身份: {current_real_device_name} (真实设备)")

        # 🔧 正确架构：订阅真实设备的CMD命令请求主题
        topics = get_mqtt_topics(current_real_device_name)
        cmd_request_topic = topics['command_request']
        client.subscribe(cmd_request_topic)
        log(f"📥 已订阅CMD命令请求主题: {cmd_request_topic}")
        log(f"🎯 模拟设备: {current_real_device_name} (真实设备)")

        # 发送设备上线状态
        send_device_online_status()

        log("🎯 设备模拟器已就绪，等待接收命令...")
        log("💡 架构: 模拟器连接真实设备，前端连接虚拟设备，主题指向真实设备！")
    else:
        log(f"❌ 连接MQTT服务器失败，返回码: {rc}")

def on_disconnect(client, userdata, rc, *args):
    """MQTT断开连接回调函数"""
    log(f"📡 与MQTT服务器断开连接，返回码: {rc}")

    # 解释返回码
    rc_meanings = {
        0: "正常断开",
        1: "协议版本不正确",
        2: "客户端ID无效",
        3: "服务器不可用",
        4: "用户名或密码错误",
        5: "未授权"
    }

    meaning = rc_meanings.get(rc, f"未知错误码: {rc}")
    log(f"📡 断开原因: {meaning}")

    if rc != 0:
        log("⚠️ 意外断开连接，将在主循环中尝试重新连接...")

def on_message(client, userdata, msg):
    """MQTT消息接收回调函数 - 处理接收到的CMD命令"""
    try:
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        log(f"📨 收到MQTT消息，主题: {topic}")
        log(f"📨 消息内容: {payload}")
        
        # 处理CMD命令请求
        if '/cmd/request/' in topic:
            handle_cmd_request(topic, payload)
        else:
            log(f"ℹ️ 收到其他类型消息: {topic}")
            
    except Exception as e:
        log(f"❌ 处理MQTT消息时出错: {e}")

def handle_cmd_request(topic, payload):
    """处理CMD命令请求"""
    try:
        # 提取cmdid
        topic_parts = topic.split('/')
        if len(topic_parts) >= 6:
            cmdid = topic_parts[-1]
            log(f"🎯 处理CMD命令，命令ID: {cmdid}")
            
            # 解析命令内容
            try:
                cmd_data = json.loads(payload)
                log(f"📋 解析命令数据: {cmd_data}")
                
                # 处理不同类型的命令
                response_data = process_command(cmd_data)
                
                # 发送回复
                send_cmd_response(cmdid, response_data)
                
            except json.JSONDecodeError as e:
                log(f"❌ 解析命令JSON失败: {e}")
                error_response = {
                    "errno": 1,
                    "error": "Invalid JSON format",
                    "message": "命令格式错误"
                }
                send_cmd_response(cmdid, error_response)
        else:
            log(f"⚠️ 无效的CMD主题格式: {topic}")
            
    except Exception as e:
        log(f"❌ 处理CMD请求时出错: {e}")

def process_command(cmd_data):
    """处理具体的命令并返回响应数据"""
    global device_state
    
    try:
        # 更新设备最后更新时间
        device_state["last_update"] = datetime.now().isoformat()
        
        # 处理雨刷控制命令
        if "wiper_control" in cmd_data:
            wiper_command = cmd_data["wiper_control"]
            log(f"🎮 执行雨刷控制命令: {wiper_command}")
            
            # 模拟设备执行命令
            old_status = device_state["wiper_status"]
            device_state["wiper_status"] = wiper_command
            
            # 模拟执行延迟
            time.sleep(0.5)
            
            log(f"✅ 雨刷状态已从 {old_status} 切换到 {wiper_command}")
            
            return {
                "errno": 0,
                "data": {
                    "status": wiper_command,
                    "previous_status": old_status,
                    "message": f"雨刷已切换到{get_status_text(wiper_command)}模式",
                    "timestamp": device_state["last_update"],
                    "battery_level": device_state["battery_level"],
                    "signal_strength": device_state["signal_strength"]
                }
            }
        
        # 处理状态查询命令
        elif "get_status" in cmd_data and cmd_data["get_status"]:
            log(f"📊 执行状态查询命令")
            
            # 模拟一些随机变化
            device_state["battery_level"] = max(10, min(100, device_state["battery_level"] + random.randint(-2, 1)))
            device_state["signal_strength"] = max(0, min(100, device_state["signal_strength"] + random.randint(-5, 5)))
            device_state["temperature"] = round(device_state["temperature"] + random.uniform(-1, 1), 1)
            device_state["humidity"] = max(0, min(100, device_state["humidity"] + random.randint(-3, 3)))
            
            log(f"📋 当前设备状态: {device_state}")
            
            return {
                "errno": 0,
                "data": {
                    "current_status": device_state["wiper_status"],
                    "battery_level": device_state["battery_level"],
                    "signal_strength": device_state["signal_strength"],
                    "temperature": device_state["temperature"],
                    "humidity": device_state["humidity"],
                    "online": device_state["online"],
                    "last_update": device_state["last_update"],
                    "message": "设备状态查询成功"
                }
            }
        
        # 处理未知命令
        else:
            log(f"⚠️ 收到未知命令: {cmd_data}")
            return {
                "errno": 2,
                "error": "Unknown command",
                "message": "未知的命令类型",
                "received_data": cmd_data
            }
            
    except Exception as e:
        log(f"❌ 处理命令时出错: {e}")
        return {
            "errno": 3,
            "error": "Command processing failed",
            "message": f"命令处理失败: {str(e)}"
        }

def send_cmd_response(cmdid, response_data):
    """发送CMD命令回复"""
    global current_real_device_name

    try:
        # 🔧 正确架构：使用真实设备的回复主题
        response_topic = f"$sys/{PRODUCT_ID}/{current_real_device_name}/cmd/response/{cmdid}"

        # 构建回复消息
        response_payload = json.dumps(response_data, ensure_ascii=False)

        log(f"📤 发送CMD回复到主题: {response_topic}")
        log(f"📤 回复内容: {response_payload}")

        # 发送回复
        result = mqtt_client.publish(response_topic, response_payload, qos=1)

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            log("✅ CMD回复发送成功")
        else:
            log(f"❌ CMD回复发送失败，错误码: {result.rc}")

    except Exception as e:
        log(f"❌ 发送CMD回复时出错: {e}")

def send_device_online_status():
    """发送设备上线状态"""
    global current_real_device_name

    try:
        # 构建设备状态数据
        status_data = {
            "device_status": "online",
            "wiper_status": device_state["wiper_status"],
            "battery_level": device_state["battery_level"],
            "signal_strength": device_state["signal_strength"],
            "timestamp": datetime.now().isoformat()
        }

        # 🔧 正确架构：发送到真实设备的数据上报主题
        topics = get_mqtt_topics(current_real_device_name)
        status_topic = topics['property_post']
        status_payload = json.dumps(status_data, ensure_ascii=False)

        log(f"📡 发送设备上线状态到主题: {status_topic}")
        result = mqtt_client.publish(status_topic, status_payload, qos=1)

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            log("✅ 设备上线状态发送成功")
        else:
            log(f"❌ 设备上线状态发送失败，错误码: {result.rc}")

    except Exception as e:
        log(f"❌ 发送设备上线状态时出错: {e}")

def get_status_text(status):
    """获取状态文本描述"""
    status_map = {
        'off': '关闭',
        'interval': '间歇',
        'low': '低速',
        'high': '高速',
        'smart': '智能'
    }
    return status_map.get(status, status)

def start_heartbeat_thread():
    """启动心跳线程，定期发送设备状态"""
    def heartbeat():
        while running:
            try:
                time.sleep(30)  # 每30秒发送一次心跳
                if mqtt_client and mqtt_client.is_connected():
                    send_device_online_status()
            except Exception as e:
                log(f"❌ 心跳发送失败: {e}")

    heartbeat_thread = threading.Thread(target=heartbeat, daemon=True)
    heartbeat_thread.start()
    log("💓 心跳线程已启动")

def start_device_simulator():
    """启动设备模拟器"""
    global running, mqtt_client

    log("🚀 启动设备模拟器")
    log(f"📱 模拟设备: {current_device_name}")
    log(f"👤 用户: {current_username}")

    # 连接MQTT服务器
    if not connect_mqtt():
        log("❌ 设备模拟器启动失败")
        return False

    # 启动心跳线程
    start_heartbeat_thread()

    reconnect_attempts = 0
    max_reconnect_attempts = 5
    reconnect_delay = 10  # 秒

    try:
        # 保持主线程运行
        while running:
            # 检查MQTT连接状态
            if mqtt_client and not mqtt_client.is_connected():
                log("🔄 检测到MQTT连接断开，尝试重新连接...")

                if reconnect_attempts < max_reconnect_attempts:
                    reconnect_attempts += 1
                    log(f"🔄 重连尝试 {reconnect_attempts}/{max_reconnect_attempts}")

                    # 断开现有连接
                    disconnect_mqtt()

                    # 等待一段时间后重连
                    time.sleep(reconnect_delay)

                    # 尝试重新连接
                    if connect_mqtt():
                        log("✅ 重新连接成功")
                        reconnect_attempts = 0  # 重置重连计数
                    else:
                        log(f"❌ 重连失败，{reconnect_delay}秒后再次尝试...")
                else:
                    log(f"❌ 已达到最大重连次数 ({max_reconnect_attempts})，停止重连")
                    running = False
                    break
            else:
                # 连接正常，重置重连计数
                if reconnect_attempts > 0:
                    reconnect_attempts = 0

            time.sleep(1)

    except KeyboardInterrupt:
        log("⚠️ 收到中断信号，停止设备模拟器")
        running = False
    finally:
        disconnect_mqtt()

    log("🛑 设备模拟器已停止")
    return True

def main():
    """主函数，处理命令行参数并启动模拟器"""
    global current_device_name, current_username, running, current_real_device_name, current_virtual_device_name

    parser = argparse.ArgumentParser(description='OneNET MQTT设备模拟器')
    parser.add_argument('--username', default='admin', help='用户名，用于确定模拟哪个设备')
    parser.add_argument('--device', help='直接指定设备名称（可选）')
    parser.add_argument('--status', choices=['off', 'low', 'high', 'interval', 'smart'],
                        default='off', help='初始雨刷状态')
    parser.add_argument('--battery', type=int, default=85, help='初始电池电量 (0-100)')
    parser.add_argument('--signal', type=int, default=92, help='初始信号强度 (0-100)')

    args = parser.parse_args()

    # 设置当前用户和设备
    current_username = args.username

    if args.device:
        current_device_name = args.device
        # 如果直接指定设备，假设它是真实设备
        current_real_device_name = args.device
        current_virtual_device_name = f"{args.device}_virtual"
    else:
        device_config = get_user_device_config(current_username)
        current_device_name = device_config['real_device_name']  # 使用本地函数返回的键名
        current_real_device_name = device_config['real_device_name']  # 使用本地函数返回的键名
        current_virtual_device_name = device_config['virtual_device_name']

    # 设置初始状态
    device_state["wiper_status"] = args.status
    device_state["battery_level"] = max(0, min(100, args.battery))
    device_state["signal_strength"] = max(0, min(100, args.signal))

    log(f"🎯 设备模拟器配置:")
    log(f"   用户: {current_username}")
    log(f"   设备: {current_device_name}")
    log(f"   初始雨刷状态: {device_state['wiper_status']}")
    log(f"   初始电池电量: {device_state['battery_level']}%")
    log(f"   初始信号强度: {device_state['signal_strength']}%")

    # 启动设备模拟器
    start_device_simulator()

if __name__ == "__main__":
    main()

