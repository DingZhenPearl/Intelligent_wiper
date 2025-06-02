#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
OneNET MQTT 控制端脚本

🔧 重要修改：已移除设备端模拟功能，现在只作为控制端使用

功能说明：
- ✅ 发送控制命令到OneNET平台 (cmd/request主题)
- ✅ 接收设备回复 (cmd/response主题)
- ❌ 不再模拟设备端行为
- ❌ 不再处理cmd/request主题
- ❌ 不再执行本地硬件控制
- ❌ 不再上报设备状态

架构说明：
控制端 (本脚本) → OneNET平台 → 真实设备
真实设备 → OneNET平台 → 控制端 (本脚本)
"""

import sys
import json
import traceback
import time
import base64
import hmac
import argparse
import threading
import paho.mqtt.client as mqtt
from datetime import datetime
from urllib.parse import quote
from rainfall_db import log

# 导入OneNET API配置
from onenet_api import (
    PRODUCT_ID,
    DEVICE_NAME,
    ACCESS_KEY,
    generate_token,
    get_user_device_config
)

# MQTT服务器配置
MQTT_HOST = "mqtts.heclouds.com"
MQTT_PORT = 1883
MQTT_KEEPALIVE = 120

# 全局变量
mqtt_client = None
running = True
wiper_status = None  # 雨刷状态：off, interval, low,  high, smart
current_device_name = DEVICE_NAME  # 当前使用的设备名称
current_username = "admin"  # 当前用户名

def get_mqtt_topics(device_name, cmdid=None):
    """根据设备名称获取MQTT主题"""
    if cmdid is None:
        cmdid = int(time.time() * 1000)  # 使用时间戳作为命令ID

    return {
        'command': f"$sys/{PRODUCT_ID}/{device_name}/cmd/request/{cmdid}",
        'command_reply': f"$sys/{PRODUCT_ID}/{device_name}/cmd/response/{cmdid}",
        'property_post': f"$sys/{PRODUCT_ID}/{device_name}/dp/post/json",
        'property_post_reply': f"$sys/{PRODUCT_ID}/{device_name}/dp/post/json/accepted",
        'cmdid': cmdid
    }

def on_connect(client, userdata, flags, rc, *args):
    """MQTT连接回调函数"""
    if rc == 0:
        log(f"成功连接到MQTT服务器: {MQTT_HOST}")
        # 获取当前设备的MQTT主题
        topics = get_mqtt_topics(current_device_name)

        # 🔧 修复：只订阅控制端需要的主题，不再模拟设备端

        # 订阅CMD命令回复主题（接收设备的回复）
        cmd_response_wildcard = f"$sys/{PRODUCT_ID}/{current_device_name}/cmd/response/+"
        client.subscribe(cmd_response_wildcard)
        log(f"已订阅CMD命令回复主题（通配符）: {cmd_response_wildcard}")

        # 订阅数据上报回复主题（可选，用于确认数据上报）
        client.subscribe(topics['property_post_reply'])
        log(f"已订阅数据上报回复主题: {topics['property_post_reply']}")

        # ❌ 移除：不再订阅CMD请求主题，因为我们是控制端，不是设备端
        # cmd_request_wildcard = f"$sys/{PRODUCT_ID}/{current_device_name}/cmd/request/+"
        # client.subscribe(cmd_request_wildcard)

        log("✅ 控制端MQTT连接完成，只订阅回复主题")
    else:
        log(f"连接MQTT服务器失败，返回码: {rc}")

def on_disconnect(client, userdata, rc, *args):
    """MQTT断开连接回调函数"""
    log(f"与MQTT服务器断开连接，返回码: {rc}")
    if rc != 0:
        log("意外断开连接，尝试重新连接...")

def on_message(client, userdata, msg):
    """MQTT消息接收回调函数 - 只处理控制端需要的消息"""
    try:
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        log(f"收到MQTT消息，主题: {topic}, 内容: {payload}")

        # 🔧 修复：只处理控制端关心的消息
        if '/cmd/response/' in topic:
            # 处理CMD命令回复（来自真实设备的回复）
            topic_parts = topic.split('/')
            if len(topic_parts) >= 6:
                cmdid = topic_parts[-1]  # 最后一部分是cmdid
                log(f"✅ 收到设备CMD回复，命令ID: {cmdid}, 内容: {payload}")
                # 这里可以解析设备回复，判断命令是否执行成功
                try:
                    response_data = json.loads(payload)
                    if response_data.get('errno') == 0:
                        log(f"✅ 设备成功执行命令 {cmdid}")
                    else:
                        log(f"❌ 设备执行命令失败 {cmdid}: {response_data.get('error', '未知错误')}")
                except json.JSONDecodeError:
                    log(f"⚠️ 无法解析设备回复JSON: {payload}")
        elif '/dp/post/json/accepted' in topic:
            # 处理数据上报回复确认
            log(f"📤 数据上报确认: {payload}")
        else:
            # 其他消息类型
            log(f"ℹ️ 收到其他类型消息: {topic}")

        # ❌ 移除：不再处理CMD请求，因为我们是控制端，不是设备端
        # if '/cmd/request/' in topic:
        #     handle_cmd_command(payload, cmdid)

    except Exception as e:
        log(f"处理MQTT消息时出错: {str(e)}")
        log(traceback.format_exc())

# ❌ 移除：设备端命令处理函数，因为我们只作为控制端
# def handle_cmd_command(payload, cmdid):
#     """处理接收到的CMD格式命令 - 已移除，不再模拟设备端"""
#     pass

# ❌ 移除：旧格式命令处理函数，因为我们只作为控制端
# def handle_command(payload):
#     """处理接收到的旧格式命令 - 已移除，不再模拟设备端"""
#     pass

# ❌ 移除：硬件控制函数，因为控制端不直接控制硬件
# def control_wiper(command):
#     """控制雨刷硬件 - 已移除，硬件控制由真实设备端负责"""
#     pass

# ❌ 移除：设备端回复函数，因为控制端不需要回复自己发送的命令
# def reply_cmd_success(cmdid):
#     """回复CMD命令执行成功 - 已移除，由真实设备端负责回复"""
#     pass

# def reply_cmd_error(cmdid, errno, message):
#     """回复CMD命令执行失败 - 已移除，由真实设备端负责回复"""
#     pass

# def reply_success(command_id):
#     """回复旧格式命令执行成功 - 已移除，由真实设备端负责回复"""
#     pass

# def reply_error(command_id, code, message):
#     """回复旧格式命令执行失败 - 已移除，由真实设备端负责回复"""
#     pass

# ❌ 移除：状态上报函数，因为控制端不需要上报状态
# def report_wiper_status():
#     """上报雨刷当前状态 - 已移除，由真实设备端负责状态上报"""
#     pass

def connect_mqtt():
    """连接到MQTT服务器"""
    global mqtt_client

    try:
        # 创建MQTT客户端实例，使用当前设备名称
        client_id = current_device_name
        log(f"DEBUG: connect_mqtt() - current_device_name = {current_device_name}")
        log(f"DEBUG: connect_mqtt() - client_id = {client_id}")
        mqtt_client = mqtt.Client(client_id=client_id)

        # 设置回调函数
        mqtt_client.on_connect = on_connect
        mqtt_client.on_message = on_message
        mqtt_client.on_disconnect = on_disconnect

        # 设置认证信息 - 🔧 修复：使用设备密钥生成设备级token
        from onenet_api import get_device_key, generate_device_token

        # 获取设备密钥
        device_key = get_device_key(current_device_name)
        if not device_key:
            log(f"无法获取设备 {current_device_name} 的密钥")
            return False

        # 生成设备级token
        device_token = generate_device_token(current_device_name, device_key)
        if not device_token:
            log("生成设备token失败，无法连接MQTT服务器")
            return False

        mqtt_client.username_pw_set(PRODUCT_ID, device_token)

        # 连接到MQTT服务器
        log(f"正在连接到MQTT服务器: {MQTT_HOST}:{MQTT_PORT}")
        log(f"使用设备名称: {current_device_name}")
        mqtt_client.connect(MQTT_HOST, MQTT_PORT, MQTT_KEEPALIVE)

        # 启动MQTT客户端循环
        mqtt_client.loop_start()

        return True
    except Exception as e:
        log(f"连接MQTT服务器时出错: {str(e)}")
        log(traceback.format_exc())
        return False

def disconnect_mqtt():
    """断开MQTT连接"""
    global mqtt_client

    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        log("已断开MQTT连接")

def start_mqtt_service():
    """启动MQTT服务"""
    global running

    # 确保running为True
    running = True

    log("启动MQTT控制服务")

    # 连接MQTT服务器
    if not connect_mqtt():
        log("MQTT服务启动失败")
        return False

    try:
        # 保持主线程运行
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        log("收到中断信号，停止MQTT服务")
        running = False
    finally:
        disconnect_mqtt()

    log("MQTT控制服务已停止")
    return True

def send_cmd_control_command(command):
    """发送CMD格式的控制命令到OneNET平台"""
    global mqtt_client, current_device_name

    try:
        if not mqtt_client or not hasattr(mqtt_client, 'is_connected') or not mqtt_client.is_connected():
            return {"success": False, "error": "MQTT客户端未连接"}

        # 生成命令ID
        cmdid = int(time.time() * 1000)

        # 构建CMD格式的控制命令
        cmd_data = {
            "wiper_control": command,
            "timestamp": cmdid
        }

        # 获取MQTT主题
        topics = get_mqtt_topics(current_device_name, cmdid)
        command_topic = topics['command']
        payload = json.dumps(cmd_data)

        log(f"📤 发送CMD控制命令到主题: {command_topic}")
        log(f"📤 命令内容: {payload}")

        # 发送命令到OneNET平台
        result = mqtt_client.publish(command_topic, payload, qos=1)

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            log("✅ CMD控制命令发送成功，等待设备回复...")

            # 🔧 修复：控制端只负责发送命令，不执行本地控制逻辑
            # 真实的设备会接收命令并执行，然后回复结果

            return {
                "success": True,
                "message": "CMD控制命令发送成功，等待设备执行",
                "command": command,
                "device_name": current_device_name,
                "method": "MQTT_CMD",
                "cmdid": cmdid,
                "topic": command_topic,
                "note": "命令已发送到OneNET平台，等待真实设备执行并回复"
            }
        else:
            return {"success": False, "error": f"CMD命令发送失败，错误码: {result.rc}"}

    except Exception as e:
        return {"success": False, "error": f"发送CMD控制命令失败: {str(e)}"}

def stop_mqtt_service():
    """停止MQTT服务"""
    global running
    running = False
    log("MQTT控制服务停止命令已发送")

def main():
    """主函数，处理命令行参数并执行相应操作"""
    global wiper_status, current_device_name, current_username

    parser = argparse.ArgumentParser(description='OneNET MQTT雨刷控制工具')
    parser.add_argument('--action', choices=['start', 'stop', 'status', 'control'],
                        default='start', help='执行的操作')
    parser.add_argument('--status', choices=['off', 'low', 'high', 'interval', 'smart'],
                        help='设置雨刷状态（仅在action=control时有效）')
    parser.add_argument('--username', default='admin', help='用户名，用于确定使用哪个设备')

    args = parser.parse_args()

    # 设置当前用户和设备
    current_username = args.username
    log(f"DEBUG: 开始获取用户 {current_username} 的设备配置")
    device_config = get_user_device_config(current_username)
    log(f"DEBUG: 获取到设备配置: {device_config}")
    current_device_name = device_config['device_name']
    log(f"DEBUG: 设置 current_device_name = {current_device_name}")

    log(f"用户: {current_username}, 设备: {current_device_name}")

    if args.action == 'start':
        start_mqtt_service()
    elif args.action == 'stop':
        stop_mqtt_service()
    elif args.action == 'status':
        # 🔧 修复：控制端不维护设备状态，状态由真实设备管理
        log("⚠️ 控制端不维护设备状态，请查询真实设备的状态")
        print(json.dumps({
            "success": True,
            "status": "控制端不维护状态",
            "message": "设备状态由真实设备管理，请通过OneNET平台或设备端查询",
            "device_name": current_device_name
        }, ensure_ascii=False))
    elif args.action == 'control':
        if not args.status:
            print(json.dumps({"success": False, "error": "控制操作需要指定--status参数"}, ensure_ascii=False))
            return

        # 获取要发送的控制命令
        status = args.status
        log(f"📤 准备发送控制命令: '{status}' 到设备: {current_device_name}")

        # 🔧 修复：控制端不维护本地状态，只发送命令
        # wiper_status = status  # 移除本地状态管理

        # 如果MQTT客户端未连接，先连接
        if not mqtt_client or not hasattr(mqtt_client, 'is_connected') or not mqtt_client.is_connected():
            if not connect_mqtt():
                print(json.dumps({"success": False, "error": "无法连接到MQTT服务器"}, ensure_ascii=False))
                return
            time.sleep(1)  # 等待连接建立

        # 发送CMD格式的控制命令到OneNET平台
        result = send_cmd_control_command(status)

        # 输出结果
        print(json.dumps(result, ensure_ascii=False))

        # 断开连接
        disconnect_mqtt()
    else:
        print(json.dumps({"success": False, "error": "不支持的操作"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
