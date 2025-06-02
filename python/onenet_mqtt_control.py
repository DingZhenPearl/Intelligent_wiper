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

        # 订阅数据上报回复主题（固定主题）
        client.subscribe(topics['property_post_reply'])
        log(f"已订阅数据上报回复主题: {topics['property_post_reply']}")

        # 订阅CMD命令请求主题（使用通配符）
        cmd_request_wildcard = f"$sys/{PRODUCT_ID}/{current_device_name}/cmd/request/+"
        client.subscribe(cmd_request_wildcard)
        log(f"已订阅CMD命令请求主题（通配符）: {cmd_request_wildcard}")

        # 订阅CMD命令回复主题（使用通配符）
        cmd_response_wildcard = f"$sys/{PRODUCT_ID}/{current_device_name}/cmd/response/+"
        client.subscribe(cmd_response_wildcard)
        log(f"已订阅CMD命令回复主题（通配符）: {cmd_response_wildcard}")

        # 不再自动上报状态
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

        # 检查是否是CMD请求
        if '/cmd/request/' in topic:
            # 提取命令ID
            topic_parts = topic.split('/')
            if len(topic_parts) >= 6:
                cmdid = topic_parts[-1]  # 最后一部分是cmdid
                log(f"收到CMD请求，命令ID: {cmdid}")
                handle_cmd_command(payload, cmdid)
        elif '/cmd/response/' in topic:
            # 处理CMD命令回复
            topic_parts = topic.split('/')
            if len(topic_parts) >= 6:
                cmdid = topic_parts[-1]  # 最后一部分是cmdid
                log(f"收到CMD回复，命令ID: {cmdid}, 内容: {payload}")
        elif '/dp/post/json/accepted' in topic:
            # 处理数据上报回复
            log(f"数据上报确认: {payload}")
    except Exception as e:
        log(f"处理MQTT消息时出错: {str(e)}")
        log(traceback.format_exc())

def handle_cmd_command(payload, cmdid):
    """处理接收到的CMD格式命令"""
    global wiper_status

    try:
        # 解析命令JSON
        command_data = json.loads(payload)
        log(f"解析CMD命令: {command_data}")

        # 检查是否包含雨刷控制命令
        if "wiper_control" in command_data:
            # 获取雨刷控制命令值
            wiper_command = command_data["wiper_control"]
            log(f"收到雨刷控制命令: {wiper_command}")

            # 验证命令值
            if wiper_command in ["off", "low", "high", "interval", "smart"]:
                # 更新雨刷状态
                wiper_status = wiper_command

                # 执行雨刷控制操作
                control_wiper(wiper_command)

                # 回复命令已执行
                reply_cmd_success(cmdid)

                # 上报新状态
                report_wiper_status()
            else:
                log(f"无效的雨刷控制命令值: {wiper_command}")
                reply_cmd_error(cmdid, 400, f"无效的雨刷控制命令值: {wiper_command}")
        else:
            log("CMD命令中未包含雨刷控制参数")
            reply_cmd_error(cmdid, 400, "CMD命令中未包含雨刷控制参数")
    except json.JSONDecodeError:
        log(f"无法解析CMD命令JSON: {payload}")
        reply_cmd_error(cmdid, 400, "无法解析CMD命令JSON")
    except Exception as e:
        log(f"处理CMD命令时出错: {str(e)}")
        log(traceback.format_exc())
        reply_cmd_error(cmdid, 500, f"处理CMD命令时出错: {str(e)}")

def handle_command(payload):
    """处理接收到的旧格式命令（保持兼容性）"""
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
            if wiper_command in ["off", "low", "high", "interval", "smart"]:
                # 更新雨刷状态
                wiper_status = wiper_command

                # 执行雨刷控制操作
                control_wiper(wiper_command)

                # 回复命令已执行
                reply_success(command_id)

                # 上报新状态
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
        command: 雨刷控制命令，可选值: off, low, high
    """
    # 这里实现实际的雨刷控制逻辑
    # 在实际应用中，这里可能会调用硬件接口或发送信号给硬件控制器
    log(f"执行雨刷控制: {command}")

    # 示例：可以在这里添加与硬件通信的代码
    # 例如，通过串口发送命令到Arduino或其他控制器
    # 或者通过GPIO控制树莓派上连接的继电器等

    # 模拟控制成功
    return True

def reply_cmd_success(cmdid):
    """回复CMD命令执行成功

    参数:
        cmdid: 命令ID
    """
    reply = {
        "errno": 0,
        "msg": "success"
    }

    # 发布回复消息到CMD回复主题
    topics = get_mqtt_topics(current_device_name, cmdid)
    mqtt_client.publish(topics['command_reply'], json.dumps(reply))
    log(f"已回复CMD命令执行成功，命令ID: {cmdid}")

def reply_cmd_error(cmdid, errno, message):
    """回复CMD命令执行失败

    参数:
        cmdid: 命令ID
        errno: 错误代码
        message: 错误消息
    """
    reply = {
        "errno": errno,
        "error": message
    }

    # 发布回复消息到CMD回复主题
    topics = get_mqtt_topics(current_device_name, cmdid)
    mqtt_client.publish(topics['command_reply'], json.dumps(reply))
    log(f"已回复CMD命令执行失败，命令ID: {cmdid}, 错误: {message}")

def reply_success(command_id):
    """回复旧格式命令执行成功

    参数:
        command_id: 命令ID
    """
    reply = {
        "id": command_id,
        "code": 200,
        "msg": "success"
    }

    # 发布回复消息
    topics = get_mqtt_topics(current_device_name)
    mqtt_client.publish(topics['command_reply'], json.dumps(reply))
    log(f"已回复命令执行成功，命令ID: {command_id}")

def reply_error(command_id, code, message):
    """回复旧格式命令执行失败

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
    topics = get_mqtt_topics(current_device_name)
    mqtt_client.publish(topics['command_reply'], json.dumps(reply))
    log(f"已回复命令执行失败，命令ID: {command_id}, 错误: {message}")

def report_wiper_status():
    """上报雨刷当前状态"""
    global wiper_status

    # 如果状态未设置，不上报
    if wiper_status is None:
        log("雨刷状态未设置，跳过状态上报")
        return

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
    topics = get_mqtt_topics(current_device_name)
    mqtt_client.publish(topics['property_post'], json.dumps(report))

    log(f"已上报雨刷状态: {wiper_status}, 报告ID: {report_id}")

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
    """发送CMD格式的控制命令"""
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

        log(f"发送CMD控制命令到主题: {command_topic}")
        log(f"命令内容: {payload}")

        # 发送命令
        result = mqtt_client.publish(command_topic, payload, qos=1)

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            log("CMD控制命令发送成功")

            # 执行本地控制逻辑
            control_wiper(command)

            # 上报状态
            report_wiper_status()

            return {
                "success": True,
                "message": "CMD控制命令发送成功",
                "command": command,
                "device_name": current_device_name,
                "method": "MQTT_CMD",
                "cmdid": cmdid,
                "topic": command_topic
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
        # 如果MQTT客户端未连接，先连接
        if not mqtt_client or not hasattr(mqtt_client, 'is_connected') or not mqtt_client.is_connected():
            if not connect_mqtt():
                print(json.dumps({"success": False, "error": "无法连接到MQTT服务器"}, ensure_ascii=False))
                return
            time.sleep(1)  # 等待连接建立

        # 上报当前状态（如果已设置）
        if wiper_status is not None:
            report_wiper_status()
            print(json.dumps({"success": True, "status": wiper_status}, ensure_ascii=False))
        else:
            log("雨刷状态未设置")
            print(json.dumps({"success": True, "status": "未设置"}, ensure_ascii=False))

        # 断开连接
        disconnect_mqtt()
    elif args.action == 'control':
        if not args.status:
            print(json.dumps({"success": False, "error": "控制操作需要指定--status参数"}, ensure_ascii=False))
            return

        # 直接使用前端状态
        status = args.status
        log(f"使用状态: '{status}'")

        # 先更新全局状态变量，这样连接时自动上报的就是新状态
        wiper_status = status

        # 如果MQTT客户端未连接，先连接
        if not mqtt_client or not hasattr(mqtt_client, 'is_connected') or not mqtt_client.is_connected():
            if not connect_mqtt():
                print(json.dumps({"success": False, "error": "无法连接到MQTT服务器"}, ensure_ascii=False))
                return
            time.sleep(1)  # 等待连接建立

        # 发送CMD格式的控制命令
        result = send_cmd_control_command(status)

        if result['success']:
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(json.dumps(result, ensure_ascii=False))

        # 断开连接
        disconnect_mqtt()
    else:
        print(json.dumps({"success": False, "error": "不支持的操作"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
