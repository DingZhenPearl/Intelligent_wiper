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
    generate_token
)

def send_wiper_command(command):
    """通过OneNET API发送雨刷控制命令

    参数:
        command: 雨刷控制命令，可选值: off, low, medium, high, interval, smart

    返回:
        dict: 包含命令发送结果的字典
    """
    try:
        # 验证命令值
        if command not in ["off", "low", "medium", "high", "interval", "smart"]:
            return {"success": False, "error": f"无效的雨刷控制命令: {command}"}

        log(f"准备发送雨刷控制命令: {command}")

        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 构建API URL
        url = f"{ONENET_API_BASE}/thing/property/set"

        # 设置请求头，包含JWT token
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 构建请求体
        request_body = {
            "product_id": PRODUCT_ID,
            "device_name": DEVICE_NAME,
            "params": {
                "wiper_control": {
                    "value": command
                }
            }
        }

        log(f"请求OneNET API: {url}")
        log(f"请求体: {json.dumps(request_body)}")

        # 发送POST请求
        response = requests.post(url, json=request_body, headers=headers)

        # 检查响应状态码
        if response.status_code == 200:
            # 解析响应数据
            response_data = response.json()

            log(f"OneNET API响应: {response_data}")

            # 检查是否成功发送命令
            if response_data.get("code") == 0:
                return {
                    "success": True,
                    "message": "雨刷控制命令发送成功",
                    "command": command,
                    "response": response_data
                }
            else:
                error_msg = f"OneNET API返回错误: {response_data.get('msg')}"
                log(error_msg)
                return {"success": False, "error": error_msg}
        else:
            error_msg = f"OneNET API请求失败，状态码: {response.status_code}, 响应: {response.text}"
            log(error_msg)
            return {"success": False, "error": error_msg}
    except Exception as e:
        error_msg = f"发送雨刷控制命令失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def get_wiper_status():
    """获取雨刷当前状态

    返回:
        dict: 包含雨刷状态的字典
    """
    try:
        log("准备获取雨刷当前状态")

        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 构建API URL
        url = f"{ONENET_API_BASE}/thing/property/get"

        # 设置请求头，包含JWT token
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 构建请求体
        request_body = {
            "product_id": PRODUCT_ID,
            "device_name": DEVICE_NAME,
            "params": ["wiper_status"]
        }

        log(f"请求OneNET API: {url}")

        # 发送POST请求
        response = requests.post(url, json=request_body, headers=headers)

        # 检查响应状态码
        if response.status_code == 200:
            # 解析响应数据
            response_data = response.json()

            log(f"OneNET API响应: {response_data}")

            # 检查是否成功获取状态
            if response_data.get("code") == 0 and "data" in response_data:
                data = response_data["data"]

                # 尝试获取雨刷状态
                if "wiper_status" in data:
                    status = data["wiper_status"]["value"]

                    log(f"获取到雨刷状态: {status}")

                    return {
                        "success": True,
                        "status": status
                    }
                else:
                    error_msg = "未找到雨刷状态信息"
                    log(error_msg)
                    return {"success": False, "error": error_msg}
            else:
                error_msg = f"OneNET API返回错误: {response_data.get('msg')}"
                log(error_msg)
                return {"success": False, "error": error_msg}
        else:
            error_msg = f"OneNET API请求失败，状态码: {response.status_code}, 响应: {response.text}"
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

    args = parser.parse_args()

    if args.action == 'control':
        if not args.command:
            print(json.dumps({"success": False, "error": "控制操作需要指定--command参数"}, ensure_ascii=False))
            return

        result = send_wiper_command(args.command)
        print(json.dumps(result, ensure_ascii=False))
    elif args.action == 'status':
        result = get_wiper_status()
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(json.dumps({"success": False, "error": "不支持的操作"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
