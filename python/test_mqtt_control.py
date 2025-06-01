#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import json
import time
import requests
import base64
import hmac
import argparse
from datetime import datetime
from urllib.parse import quote
from rainfall_db import log

# 导入OneNET API配置
from onenet_api import (
    ONENET_API_BASE,
    PRODUCT_ID,
    DEVICE_NAME,
    ACCESS_KEY,
    generate_token,
    get_user_device_config
)

def send_wiper_command(command, username='admin'):
    """通过OneNET API发送雨刷控制命令

    参数:
        command: 雨刷控制命令，可选值: off, low, medium, high, interval, smart
        username: 用户名，用于确定使用哪个设备

    返回:
        dict: 包含命令发送结果的字典
    """
    try:
        # 验证命令值
        if command not in ["off", "low", "medium", "high", "interval", "smart"]:
            return {"success": False, "error": f"无效的雨刷控制命令: {command}"}

        log(f"准备发送雨刷控制命令: {command}，用户: {username}")

        # 获取用户设备配置
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        device_id = device_config.get('device_id')

        log(f"使用设备: {device_name} (ID: {device_id}) 进行控制")

        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 尝试多种API端点和参数组合
        api_endpoints = [
            f"{ONENET_API_BASE}/thing/property/set",
            f"{ONENET_API_BASE}/thingmodel/set-device-property",
            f"{ONENET_API_BASE}/device/property/set"
        ]

        # 设置请求头，包含JWT token
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 尝试不同的请求体格式
        request_bodies = []

        # 尝试不同的属性标识符，因为物模型中可能使用不同的标识符
        property_identifiers = [
            "wiper_control",    # 原始标识符
            "rain_info",        # 系统中常用的标识符
            "device_control",   # 通用设备控制标识符
            "control_command",  # 控制命令标识符
            "wiper_status",     # 雨刷状态标识符
            "status",           # 简单状态标识符
            "command"           # 简单命令标识符
        ]

        # 为每个属性标识符生成请求体
        for prop_id in property_identifiers:
            # 格式1: 使用device_name
            request_bodies.append({
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "params": {
                    prop_id: {
                        "value": command
                    }
                }
            })

            # 格式2: 如果有device_id，也尝试使用device_id
            if device_id:
                request_bodies.append({
                    "product_id": PRODUCT_ID,
                    "device_id": device_id,
                    "params": {
                        prop_id: {
                            "value": command
                        }
                    }
                })

                # 格式3: 同时使用device_name和device_id
                request_bodies.append({
                    "product_id": PRODUCT_ID,
                    "device_name": device_name,
                    "device_id": device_id,
                    "params": {
                        prop_id: {
                            "value": command
                        }
                    }
                })

        # 尝试每个API端点和请求体组合
        for endpoint_idx, url in enumerate(api_endpoints):
            for body_idx, request_body in enumerate(request_bodies):
                try:
                    log(f"尝试API端点 {endpoint_idx + 1}/{len(api_endpoints)}: {url}")
                    log(f"使用请求体格式 {body_idx + 1}/{len(request_bodies)}: {json.dumps(request_body, ensure_ascii=False)}")

                    # 发送POST请求
                    response = requests.post(url, json=request_body, headers=headers, timeout=10)

                    log(f"响应状态码: {response.status_code}")
                    log(f"响应内容: {response.text}")

                    # 检查响应状态码
                    if response.status_code == 200:
                        # 解析响应数据
                        response_data = response.json()

                        # 检查是否成功发送命令
                        if response_data.get("code") == 0 or response_data.get("errno") == 0:
                            log(f"✅ 控制命令发送成功！使用端点: {url}")
                            return {
                                "success": True,
                                "message": "雨刷控制命令发送成功",
                                "command": command,
                                "device_name": device_name,
                                "device_id": device_id,
                                "endpoint": url,
                                "request_body": request_body,
                                "response": response_data
                            }
                        else:
                            log(f"❌ API返回错误: {response_data.get('msg') or response_data.get('error')}")
                    else:
                        log(f"❌ HTTP请求失败，状态码: {response.status_code}")

                except requests.exceptions.RequestException as e:
                    log(f"❌ 请求异常: {str(e)}")
                    continue

        # 如果所有尝试都失败了
        error_msg = f"所有API端点和请求格式都尝试失败，无法发送控制命令到设备 {device_name} (ID: {device_id})"
        log(error_msg)
        return {"success": False, "error": error_msg}
    except Exception as e:
        error_msg = f"发送雨刷控制命令失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def get_wiper_status(username='admin'):
    """获取雨刷当前状态

    参数:
        username: 用户名，用于确定使用哪个设备

    返回:
        dict: 包含雨刷状态的字典
    """
    try:
        log(f"准备获取雨刷当前状态，用户: {username}")

        # 获取用户设备配置
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        device_id = device_config.get('device_id')

        log(f"使用设备: {device_name} (ID: {device_id}) 获取状态")

        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 尝试多种API端点
        api_endpoints = [
            f"{ONENET_API_BASE}/thing/property/get",
            f"{ONENET_API_BASE}/thingmodel/query-device-property",
            f"{ONENET_API_BASE}/device/property/get"
        ]

        # 设置请求头，包含JWT token
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 尝试不同的请求体格式
        request_bodies = []

        # 尝试不同的属性标识符
        property_identifiers = [
            "wiper_status",     # 原始状态标识符
            "wiper_control",    # 控制标识符
            "rain_info",        # 系统中常用的标识符
            "device_status",    # 通用设备状态标识符
            "status",           # 简单状态标识符
            "state",            # 状态标识符
            "command"           # 命令标识符
        ]

        # 为每个属性标识符生成请求体
        for prop_id in property_identifiers:
            # 格式1: 使用device_name
            request_bodies.append({
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "params": [prop_id]
            })

            # 格式2: 如果有device_id，也尝试使用device_id
            if device_id:
                request_bodies.append({
                    "product_id": PRODUCT_ID,
                    "device_id": device_id,
                    "params": [prop_id]
                })

                # 格式3: 同时使用device_name和device_id
                request_bodies.append({
                    "product_id": PRODUCT_ID,
                    "device_name": device_name,
                    "device_id": device_id,
                    "params": [prop_id]
                })

        # 尝试每个API端点和请求体组合
        for endpoint_idx, url in enumerate(api_endpoints):
            for body_idx, request_body in enumerate(request_bodies):
                try:
                    log(f"尝试API端点 {endpoint_idx + 1}/{len(api_endpoints)}: {url}")
                    log(f"使用请求体格式 {body_idx + 1}/{len(request_bodies)}: {json.dumps(request_body, ensure_ascii=False)}")

                    # 发送POST请求
                    response = requests.post(url, json=request_body, headers=headers, timeout=10)

                    log(f"响应状态码: {response.status_code}")
                    log(f"响应内容: {response.text}")

                    # 检查响应状态码
                    if response.status_code == 200:
                        # 解析响应数据
                        response_data = response.json()

                        # 检查是否成功获取状态
                        if response_data.get("code") == 0 or response_data.get("errno") == 0:
                            data = response_data.get("data", {})

                            # 尝试获取状态信息，检查多个可能的属性标识符
                            status_found = False
                            status_value = None
                            found_property = None

                            for prop_id in property_identifiers:
                                if prop_id in data:
                                    status_value = data[prop_id].get("value") if isinstance(data[prop_id], dict) else data[prop_id]
                                    found_property = prop_id
                                    status_found = True
                                    break

                            if status_found:
                                log(f"✅ 获取到设备状态: {status_value} (属性: {found_property})")
                                return {
                                    "success": True,
                                    "status": status_value,
                                    "property": found_property,
                                    "device_name": device_name,
                                    "device_id": device_id,
                                    "endpoint": url,
                                    "response": response_data
                                }
                            else:
                                log(f"❌ 响应中未找到状态信息: {data}")
                        else:
                            log(f"❌ API返回错误: {response_data.get('msg') or response_data.get('error')}")
                    else:
                        log(f"❌ HTTP请求失败，状态码: {response.status_code}")

                except requests.exceptions.RequestException as e:
                    log(f"❌ 请求异常: {str(e)}")
                    continue

        # 如果所有尝试都失败了
        error_msg = f"所有API端点和请求格式都尝试失败，无法获取设备 {device_name} (ID: {device_id}) 的状态"
        log(error_msg)
        return {"success": False, "error": error_msg}
    except Exception as e:
        error_msg = f"获取雨刷状态失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def main():
    """主函数，处理命令行参数并执行相应操作"""
    parser = argparse.ArgumentParser(description='OneNET雨刷控制测试工具')
    parser.add_argument('--action', choices=['control', 'status'],
                        default='status', help='执行的操作')
    parser.add_argument('--command', choices=['off', 'low', 'medium', 'high', 'interval', 'smart'],
                        help='雨刷控制命令（仅在action=control时有效）')
    parser.add_argument('--username', default='admin', help='用户名，用于确定使用哪个设备')

    args = parser.parse_args()

    if args.action == 'control':
        if not args.command:
            print(json.dumps({"success": False, "error": "控制操作需要指定--command参数"}, ensure_ascii=False))
            return

        result = send_wiper_command(args.command, args.username)
        print(json.dumps(result, ensure_ascii=False))
    elif args.action == 'status':
        result = get_wiper_status(args.username)
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(json.dumps({"success": False, "error": "不支持的操作"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
