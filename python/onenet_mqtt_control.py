#!/usr/bin/env python
# -*- coding: utf-8 -*-

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
    generate_token
)

# MQTT服务器配置
MQTT_HOST = "mqtts.heclouds.com"
MQTT_PORT = 1883
MQTT_KEEPALIVE = 120

# 雨刷控制命令主题
# 订阅主题：接收命令
MQTT_TOPIC_COMMAND = f"$sys/{PRODUCT_ID}/{DEVICE_NAME}/thing/property/set"
# 发布主题：命令响应
MQTT_TOPIC_COMMAND_REPLY = f"$sys/{PRODUCT_ID}/{DEVICE_NAME}/thing/property/set_reply"
# 发布主题：上报属性
MQTT_TOPIC_PROPERTY_POST = f"$sys/{PRODUCT_ID}/{DEVICE_NAME}/thing/property/post"
# 订阅主题：属性上报响应
MQTT_TOPIC_PROPERTY_POST_REPLY = f"$sys/{PRODUCT_ID}/{DEVICE_NAME}/thing/property/post/reply"

# 全局变量
mqtt_client = None
running = True
wiper_status = "off"  # 雨刷状态：off, low, medium, high

def on_connect(client, userdata, flags, rc, *args):
    """MQTT连接回调函数"""
    if rc == 0:
        log(f"成功连接到MQTT服务器: {MQTT_HOST}")
        # 订阅命令主题
        client.subscribe(MQTT_TOPIC_COMMAND)
        client.subscribe(MQTT_TOPIC_PROPERTY_POST_REPLY)
        log(f"已订阅主题: {MQTT_TOPIC_COMMAND}")
        log(f"已订阅主题: {MQTT_TOPIC_PROPERTY_POST_REPLY}")

        # 连接成功后上报当前状态
        report_wiper_status()
    else:
        log(f"连接MQTT服务器失败，返回码: {rc}")

def on_disconnect(client, userdata, rc, *args):
    """MQTT断开连接回调函数"""
    log(f"与MQTT服务器断开连接，返回码: {rc}")
    if rc != 0:
        log("意外断开连接，尝试重新连接...")

def on_message(client, userdata, msg):
    """MQTT消息接收回调函数"""
    try:
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        log(f"收到MQTT消息，主题: {topic}, 内容: {payload}")

        if topic == MQTT_TOPIC_COMMAND:
            # 处理命令消息
            handle_command(payload)
        elif topic == MQTT_TOPIC_PROPERTY_POST_REPLY:
            # 处理属性上报响应
            log(f"属性上报响应: {payload}")
    except Exception as e:
        log(f"处理MQTT消息时出错: {str(e)}")
        log(traceback.format_exc())

def handle_command(payload):
    """处理接收到的命令"""
    global wiper_status

    try:
        # 解析命令JSON
        command_data = json.loads(payload)

        # 获取命令ID，用于回复
        command_id = command_data.get("id")

        # 检查是否包含雨刷控制命令
        if "params" in command_data and "wiper_control" in command_data["params"]:
            # 获取雨刷控制命令值
            wiper_command = command_data["params"]["wiper_control"]["value"]
            log(f"收到雨刷控制命令: {wiper_command}")

            # 验证命令值
            if wiper_command in ["off", "low", "medium", "high"]:
                # 更新雨刷状态
                old_status = wiper_status
                wiper_status = wiper_command

                # 执行雨刷控制操作
                control_wiper(wiper_command)

                # 回复命令已执行
                reply_success(command_id)

                # 如果状态发生变化，上报新状态
                if old_status != wiper_status:
                    report_wiper_status()
            else:
                log(f"无效的雨刷控制命令值: {wiper_command}")
                reply_error(command_id, 400, f"无效的雨刷控制命令值: {wiper_command}")
        else:
            log("命令中未包含雨刷控制参数")
            reply_error(command_id, 400, "命令中未包含雨刷控制参数")
    except json.JSONDecodeError:
        log(f"无法解析命令JSON: {payload}")
        reply_error(command_id if 'command_id' in locals() else "unknown", 400, "无法解析命令JSON")
    except Exception as e:
        log(f"处理命令时出错: {str(e)}")
        log(traceback.format_exc())
        reply_error(command_id if 'command_id' in locals() else "unknown", 500, f"处理命令时出错: {str(e)}")

def control_wiper(command):
    """控制雨刷硬件

    参数:
        command: 雨刷控制命令，可选值: off, low, medium, high
    """
    # 这里实现实际的雨刷控制逻辑
    # 在实际应用中，这里可能会调用硬件接口或发送信号给硬件控制器
    log(f"执行雨刷控制: {command}")

    # 示例：可以在这里添加与硬件通信的代码
    # 例如，通过串口发送命令到Arduino或其他控制器
    # 或者通过GPIO控制树莓派上连接的继电器等

    # 模拟控制成功
    return True

def reply_success(command_id):
    """回复命令执行成功

    参数:
        command_id: 命令ID
    """
    reply = {
        "id": command_id,
        "code": 200,
        "msg": "success"
    }

    # 发布回复消息
    mqtt_client.publish(MQTT_TOPIC_COMMAND_REPLY, json.dumps(reply))
    log(f"已回复命令执行成功，命令ID: {command_id}")

def reply_error(command_id, code, message):
    """回复命令执行失败

    参数:
        command_id: 命令ID
        code: 错误代码
        message: 错误消息
    """
    reply = {
        "id": command_id,
        "code": code,
        "msg": message
    }

    # 发布回复消息
    mqtt_client.publish(MQTT_TOPIC_COMMAND_REPLY, json.dumps(reply))
    log(f"已回复命令执行失败，命令ID: {command_id}, 错误: {message}")

def report_wiper_status():
    """上报雨刷当前状态"""
    global wiper_status

    # 生成唯一ID
    report_id = str(int(time.time()))

    # 构建上报消息
    report = {
        "id": report_id,
        "params": {
            "wiper_status": {
                "value": wiper_status
            }
        }
    }

    # 发布状态上报消息
    mqtt_client.publish(MQTT_TOPIC_PROPERTY_POST, json.dumps(report))
    log(f"已上报雨刷状态: {wiper_status}, 报告ID: {report_id}")

def connect_mqtt():
    """连接到MQTT服务器"""
    global mqtt_client

    try:
        # 创建MQTT客户端实例
        client_id = DEVICE_NAME
        mqtt_client = mqtt.Client(client_id=client_id)

        # 设置回调函数
        mqtt_client.on_connect = on_connect
        mqtt_client.on_message = on_message
        mqtt_client.on_disconnect = on_disconnect

        # 设置认证信息
        token = generate_token()
        if not token:
            log("生成token失败，无法连接MQTT服务器")
            return False

        mqtt_client.username_pw_set(PRODUCT_ID, token)

        # 连接到MQTT服务器
        log(f"正在连接到MQTT服务器: {MQTT_HOST}:{MQTT_PORT}")
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

def stop_mqtt_service():
    """停止MQTT服务"""
    global running
    running = False
    log("MQTT控制服务停止命令已发送")

def main():
    """主函数，处理命令行参数并执行相应操作"""
    global wiper_status

    parser = argparse.ArgumentParser(description='OneNET MQTT雨刷控制工具')
    parser.add_argument('--action', choices=['start', 'stop', 'status', 'control'],
                        default='start', help='执行的操作')
    parser.add_argument('--status', choices=['off', 'low', 'medium', 'high'],
                        help='设置雨刷状态（仅在action=control时有效）')

    args = parser.parse_args()

    if args.action == 'start':
        start_mqtt_service()
    elif args.action == 'stop':
        stop_mqtt_service()
    elif args.action == 'status':
        # 如果MQTT客户端未连接，先连接
        if not mqtt_client or not hasattr(mqtt_client, 'is_connected') or not mqtt_client.is_connected():
            if not connect_mqtt():
                print(json.dumps({"success": False, "error": "无法连接到MQTT服务器"}, ensure_ascii=False))
                return
            time.sleep(1)  # 等待连接建立

        # 上报当前状态
        report_wiper_status()
        print(json.dumps({"success": True, "status": wiper_status}, ensure_ascii=False))

        # 断开连接
        disconnect_mqtt()
    elif args.action == 'control':
        if not args.status:
            print(json.dumps({"success": False, "error": "控制操作需要指定--status参数"}, ensure_ascii=False))
            return

        # 如果MQTT客户端未连接，先连接
        if not mqtt_client or not hasattr(mqtt_client, 'is_connected') or not mqtt_client.is_connected():
            if not connect_mqtt():
                print(json.dumps({"success": False, "error": "无法连接到MQTT服务器"}, ensure_ascii=False))
                return
            time.sleep(1)  # 等待连接建立

        # 更新状态并上报
        wiper_status = args.status
        control_wiper(args.status)
        report_wiper_status()
        print(json.dumps({"success": True, "status": wiper_status}, ensure_ascii=False))

        # 断开连接
        disconnect_mqtt()
    else:
        print(json.dumps({"success": False, "error": "不支持的操作"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
