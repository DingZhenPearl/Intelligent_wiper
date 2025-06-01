#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import json
import traceback
import io
import requests
import base64
import hmac
import time
from datetime import datetime, timedelta
import argparse
import random
from urllib.parse import quote
from rainfall_db import log, get_rainfall_level

# OneNET平台API配置
ONENET_API_BASE = "https://iot-api.heclouds.com"  # 新版API基地址（用于获取数据）
ONENET_API_BASE_OLD = "http://api.heclouds.com"   # 旧版API基地址（用于创建数据流）
ONENET_CONSOLE_API_BASE = "https://open.iot.10086.cn"  # 控制台API基地址（用于管理操作）

# TODO: 【必填】替换为实际的产品ID，在OneNET平台的产品详情页获取
PRODUCT_ID = "66eIb47012"
# TODO: 【必填】替换为实际的设备名称，在OneNET平台的设备列表或设备详情页获取
DEVICE_NAME = "test"
# TODO: 【必填】替换为实际的设备ID，在OneNET平台的设备详情页获取
DEVICE_ID = "2441202951"  # 从API响应中获取的实际设备ID
# TODO: 【必填】替换为实际的访问密钥(Access Key)，在OneNET平台的产品详情页获取
ACCESS_KEY = "Rk9mVGdrQWE5dzJqWU12bzFsSFFpZWtRZDVWdTFZZlU="

def get_user_datastream_id(username):
    """根据用户名生成数据流ID

    参数:
        username: 用户名

    返回:
        str: 数据流ID
    """
    # 特殊处理：如果用户名是 'default' 或 'legacy'，使用原始的数据流ID
    if username in ['default', 'legacy', 'original']:
        return "rain_info"

    # 为其他用户生成唯一的数据流ID
    return f"rain_info_{username}"

def get_device_id_by_name(device_name):
    """根据设备名称查询设备ID

    参数:
        device_name: 设备名称

    返回:
        str: 设备ID，如果未找到返回None
    """
    try:
        # 生成token
        token = generate_token()
        if not token:
            log(f"无法生成token，无法查询设备 {device_name}")
            return None

        # 查询产品下的所有设备 - 尝试多个可能的API端点
        api_endpoints = [
            f"{ONENET_API_BASE}/device",
            f"{ONENET_API_BASE}/devices",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/device",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/devices"
        ]

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }
        params = {
            "product_id": PRODUCT_ID,
            "limit": 100
        }

        # 尝试每个API端点
        for url in api_endpoints:
            log(f"尝试查询设备API端点: {url}")
            try:
                response = requests.get(url, headers=headers, params=params)
                log(f"响应状态码: {response.status_code}")

                if response.status_code == 200:
                    data = response.json()
                    # 检查不同的成功标识
                    if data.get('code') == 0 or data.get('errno') == 0:
                        devices = data.get('data', {}).get('devices', [])
                        log(f"找到 {len(devices)} 个设备")
                        for device in devices:
                            # 检查不同的设备名称字段
                            device_title = device.get('title', device.get('name', ''))
                            if device_title == device_name:
                                device_id = device.get('id')
                                log(f"找到设备 {device_name}，ID: {device_id}")
                                return str(device_id) if device_id else None

                        # 如果在这个端点找到了设备列表但没有目标设备，继续尝试其他端点
                        log(f"在端点 {url} 中未找到设备: {device_name}")
                        continue
                    else:
                        log(f"OneNET API错误: {data.get('msg', data.get('error', 'Unknown error'))}")
                        continue
                else:
                    log(f"查询设备失败，HTTP错误: {response.status_code}")
                    continue

            except Exception as e:
                log(f"API端点 {url} 调用失败: {str(e)}")
                continue

        # 所有端点都尝试过了，仍未找到设备
        log(f"所有API端点都尝试过了，未找到设备: {device_name}")
        return None

    except Exception as e:
        log(f"查询设备ID时出错: {str(e)}")
        return None

def get_user_device_config(username):
    """获取用户的设备配置

    新方案：每个用户一个独立设备，而不是共享设备的不同数据流

    参数:
        username: 用户名

    返回:
        dict: 包含设备名称、设备ID和数据流ID的配置
    """
    log(f"🔍 获取用户 {username} 的设备配置")

    # 🚨 重要修复：只有真正的admin用户才使用test设备
    # 其他所有用户（包括session失效时的默认admin）都使用专用设备
    if username == "admin":
        # 检查是否存在admin专用设备，如果存在则使用专用设备
        admin_device_name = "intelligent_wiper_admin"
        admin_device_id = get_device_id_by_name(admin_device_name)

        if admin_device_id:
            log(f"✅ 使用admin专用设备: {admin_device_name}")
            return {
                "device_name": admin_device_name,
                "device_id": admin_device_id,
                "datastream_id": "rain_info"
            }
        else:
            log(f"⚠️ admin专用设备不存在，使用原始test设备: {DEVICE_NAME}")
            return {
                "device_name": DEVICE_NAME,  # 原始设备名称 (test)
                "device_id": DEVICE_ID,     # 原始设备ID
                "datastream_id": "rain_info"  # 原始数据流ID
            }
    else:
        # 所有其他用户使用专用设备
        user_device_name = f"intelligent_wiper_{username}"
        log(f"🎯 为用户 {username} 使用专用设备: {user_device_name}")

        # 动态查询设备ID
        device_id = get_device_id_by_name(user_device_name)

        return {
            "device_name": user_device_name,  # 用户专用设备名称
            "device_id": device_id,  # 动态查询的设备ID
            "datastream_id": "rain_info"  # 使用标准数据流ID（在设备的物模型中）
        }

def create_device_for_user(username):
    """为用户创建OneNET设备

    新方案：每个用户一个独立设备，而不是共享设备的不同数据流

    参数:
        username: 用户名

    返回:
        dict: 创建结果
    """
    try:
        log(f"为用户 {username} 创建OneNET设备")

        # 获取用户设备配置
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        device_id = device_config['device_id']
        datastream_id = device_config['datastream_id']

        # 如果是管理员用户，直接返回现有设备信息
        if device_id is not None:
            log(f"用户 {username} 使用现有设备: {device_name} (ID: {device_id})")
            return {
                "success": True,
                "method": "existing_device",
                "device_name": device_name,
                "device_id": device_id,
                "datastream_id": datastream_id,
                "message": f"用户 {username} 使用现有设备 {device_name}"
            }

        # 方法1：尝试使用旧版API创建设备
        log("尝试使用旧版API创建设备")
        result1 = create_device_old_api(device_name, username)
        if result1["success"]:
            return result1

        # 方法2：尝试使用新版API创建设备
        log("旧版API失败，尝试使用新版API创建设备")
        result2 = create_device_new_api(device_name, username)
        if result2["success"]:
            return result2

        # 所有方法都失败，返回详细的手动操作指导
        return {
            "success": False,
            "device_name": device_name,
            "datastream_id": datastream_id,
            "error": "所有自动创建设备方法都失败",
            "old_api_error": result1.get("error"),
            "new_api_error": result2.get("error"),
            "solution": "需要在OneNet平台手动创建设备",
            "manual_steps": [
                "🎯 手动创建设备步骤：",
                "",
                "1. 登录OneNet平台 (https://open.iot.10086.cn/)",
                "2. 进入OneNet Studio → 设备接入与管理 → 产品管理",
                f"3. 找到产品ID {PRODUCT_ID}，点击详情",
                "4. 点击'设备管理'选项卡",
                "5. 点击'添加设备'按钮",
                f"6. 设备名称填写: {device_name}",
                "7. 设备描述: 智能雨刷设备 - 用户{username}",
                "8. 点击'添加'完成设备创建",
                "9. 创建完成后，设备将自动继承产品的物模型",
                "10. 软件端将自动支持该用户的数据隔离！",
                "",
                "💡 优势：每个用户独立设备，数据完全隔离，管理更简单！"
            ]
        }

    except Exception as e:
        error_msg = f"创建设备时出错: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return {"success": False, "error": error_msg}

def create_device_old_api(device_name, username):
    """使用旧版API创建设备"""
    try:
        # 使用OneNet旧版API创建设备
        # URL格式: http://api.heclouds.com/devices
        url = f"{ONENET_API_BASE_OLD}/devices"

        # 设置请求头，包含API-KEY
        headers = {
            "api-key": ACCESS_KEY,
            "Content-Type": "application/json"
        }

        log(f"旧版设备创建API URL: {url}")
        log(f"使用API-KEY: {ACCESS_KEY[:20]}...")

        # 设置请求体，按照OneNet设备创建API格式
        device_data = {
            "title": device_name,
            "desc": f"智能雨刷设备 - 用户{username}",
            "tags": [f"user_{username}", "intelligent_wiper", "rainfall"],
            "location": {
                "lat": 39.9042,
                "lon": 116.4074
            },
            "private": False,
            "protocol": "MQTT"
        }

        log(f"旧版API设备创建请求数据: {device_data}")

        # 发送POST请求创建设备
        response = requests.post(url, json=device_data, headers=headers)

        log(f"旧版API设备创建响应状态码: {response.status_code}")
        log(f"旧版API设备创建响应内容: {response.text}")

        # 检查响应状态码
        if response.status_code == 200 or response.status_code == 201:
            # 解析响应数据
            try:
                response_data = response.json()
                if response_data.get("errno") == 0:
                    device_info = response_data.get("data", {})
                    device_id = device_info.get("device_id")
                    log(f"旧版API设备创建成功: {response_data}")
                    return {
                        "success": True,
                        "method": "old_api",
                        "device_name": device_name,
                        "device_id": device_id,
                        "device_info": device_info,
                        "message": f"通过旧版API成功创建设备 {device_name} (ID: {device_id})",
                        "response_data": response_data
                    }
                else:
                    error_msg = f"旧版API返回错误: {response_data.get('error', '未知错误')}"
                    log(error_msg)
                    return {"success": False, "error": error_msg, "response_data": response_data}
            except Exception as parse_error:
                log(f"旧版API解析响应数据失败: {parse_error}")
                return {
                    "success": False,
                    "error": f"解析响应失败: {parse_error}",
                    "response_text": response.text
                }
        else:
            # 请求失败
            error_msg = f"旧版API创建设备失败，状态码: {response.status_code}"
            try:
                error_data = response.json()
                error_msg += f", 错误信息: {error_data}"

                # 检查是否是设备已存在的错误
                if "already exists" in str(error_data).lower() or "已存在" in str(error_data) or response.status_code == 409:
                    log(f"旧版API: 设备 {device_name} 已存在")
                    return {
                        "success": True,
                        "method": "old_api",
                        "device_name": device_name,
                        "message": f"设备 {device_name} 已存在",
                        "response_data": error_data
                    }
            except:
                error_msg += f", 响应内容: {response.text}"

            log(error_msg)
            return {"success": False, "error": error_msg}

    except Exception as e:
        error_msg = f"旧版API创建设备时出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def create_device_new_api(device_name, username):
    """使用新版API创建设备"""
    try:
        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 尝试多种可能的设备创建API端点
        api_endpoints = [
            # 基于常见REST API模式的端点
            f"{ONENET_API_BASE}/device",
            f"{ONENET_API_BASE}/devices",
            f"{ONENET_API_BASE}/device/create",
            f"{ONENET_API_BASE}/devices/create",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/device",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/devices",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/device/create",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/devices/create",

            # 基于管理API的端点
            f"{ONENET_API_BASE}/management/device",
            f"{ONENET_API_BASE}/management/devices",
            f"{ONENET_API_BASE}/admin/device",
            f"{ONENET_API_BASE}/admin/devices",

            # 基于控制台API的端点
            f"{ONENET_CONSOLE_API_BASE}/api/device",
            f"{ONENET_CONSOLE_API_BASE}/api/devices",
            f"{ONENET_CONSOLE_API_BASE}/api/product/{PRODUCT_ID}/device",
            f"{ONENET_CONSOLE_API_BASE}/api/product/{PRODUCT_ID}/devices",
            f"{ONENET_CONSOLE_API_BASE}/studio/api/device",
            f"{ONENET_CONSOLE_API_BASE}/studio/api/devices"
        ]

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 设备定义
        device_definition = {
            "product_id": PRODUCT_ID,
            "device_name": device_name,
            "desc": f"智能雨刷设备 - 用户{username}",
            "tags": [f"user_{username}", "intelligent_wiper", "rainfall"],
            "location": "北京市",
            "protocol": "MQTT"
        }

        # 尝试每个API端点
        for i, url in enumerate(api_endpoints, 1):
            log(f"尝试设备创建API端点 {i}/{len(api_endpoints)}: {url}")
            log(f"请求数据: {device_definition}")

            try:
                # 对于控制台API，尝试不同的认证方式
                if "open.iot.10086.cn" in url:
                    # 控制台API可能需要不同的认证
                    console_headers = {
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    }

                    response = requests.post(url, json=device_definition, headers=console_headers)
                else:
                    # 对于iot-api.heclouds.com，使用JWT认证
                    response = requests.post(url, json=device_definition, headers=headers)

                log(f"设备创建响应状态码: {response.status_code}")
                log(f"设备创建响应内容: {response.text}")

                if response.status_code in [200, 201, 202]:
                    try:
                        response_data = response.json()
                        if response_data.get("code") == 0 or response_data.get("errno") == 0 or response_data.get("success"):
                            device_info = response_data.get("data", {})
                            device_id = device_info.get("device_id") or device_info.get("id") or device_info.get("did")
                            log(f"新版API设备创建成功: {response_data}")
                            return {
                                "success": True,
                                "method": "new_api",
                                "device_name": device_name,
                                "device_id": str(device_id),  # 确保设备ID是字符串格式
                                "device_info": device_info,
                                "api_endpoint": url,
                                "message": f"通过新版API成功创建设备 {device_name} (ID: {device_id})",
                                "response_data": response_data
                            }
                    except:
                        # 即使解析失败，200状态码也可能表示成功
                        if "success" in response.text.lower() or "成功" in response.text:
                            return {
                                "success": True,
                                "method": "new_api",
                                "device_name": device_name,
                                "api_endpoint": url,
                                "message": f"新版API可能成功创建设备 {device_name}",
                                "response_text": response.text
                            }

            except Exception as api_error:
                log(f"设备创建API端点 {url} 调用失败: {api_error}")
                continue

        return {
            "success": False,
            "error": "所有设备创建API端点都失败",
            "tried_endpoints": api_endpoints,
            "suggestion": "需要手动在OneNet平台创建设备"
        }

    except Exception as e:
        error_msg = f"新版API创建设备时出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def add_property_to_existing_thingmodel(datastream_id, username):
    """在现有物模型中添加新属性"""
    try:
        log(f"尝试在现有物模型中添加属性 {datastream_id}")

        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 尝试多种可能的物模型管理API端点
        api_endpoints = [
            # 基于常见REST API模式的端点
            f"{ONENET_API_BASE}/thingmodel/product/property/add",
            f"{ONENET_API_BASE}/thingmodel/product/property",
            f"{ONENET_API_BASE}/thingmodel/property/add",
            f"{ONENET_API_BASE}/product/thingmodel/property",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/thingmodel/property",

            # 基于产品管理的端点
            f"{ONENET_API_BASE}/product/thingmodel/property/create",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/thingmodel/property/create",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/property/add",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/property",

            # 基于物模型管理的端点
            f"{ONENET_API_BASE}/thingmodel/product/{PRODUCT_ID}/property",
            f"{ONENET_API_BASE}/thingmodel/product/{PRODUCT_ID}/property/add",
            f"{ONENET_API_BASE}/thingmodel/product/{PRODUCT_ID}/property/create",
            f"{ONENET_API_BASE}/thingmodel/model/property/add",
            f"{ONENET_API_BASE}/thingmodel/model/property",

            # 基于管理API的端点
            f"{ONENET_API_BASE}/management/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_API_BASE}/management/thingmodel/property",
            f"{ONENET_API_BASE}/admin/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_API_BASE}/admin/thingmodel/property",

            # 基于配置API的端点
            f"{ONENET_API_BASE}/config/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_API_BASE}/config/thingmodel/property",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/config/thingmodel/property",

            # 基于开发者API的端点
            f"{ONENET_API_BASE}/developer/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_API_BASE}/developer/thingmodel/property",
            f"{ONENET_API_BASE}/dev/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_API_BASE}/dev/thingmodel/property",

            # 基于控制台API的端点
            f"{ONENET_CONSOLE_API_BASE}/api/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_CONSOLE_API_BASE}/api/thingmodel/property",
            f"{ONENET_CONSOLE_API_BASE}/api/v1/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_CONSOLE_API_BASE}/api/v1/thingmodel/property",
            f"{ONENET_CONSOLE_API_BASE}/console/api/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_CONSOLE_API_BASE}/console/api/thingmodel/property",

            # 基于Studio API的端点
            f"{ONENET_CONSOLE_API_BASE}/studio/api/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_CONSOLE_API_BASE}/studio/api/thingmodel/property",
            f"{ONENET_CONSOLE_API_BASE}/studio/product/{PRODUCT_ID}/thingmodel/property",
            f"{ONENET_CONSOLE_API_BASE}/studio/thingmodel/property"
        ]

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 属性定义
        property_definition = {
            "product_id": PRODUCT_ID,
            "identifier": datastream_id,
            "name": f"雨量数据_{username}",
            "data_type": "DOUBLE",
            "unit": "mm/h",
            "unit_symbol": "mm/h",
            "description": f"用户 {username} 的雨量数据",
            "access_mode": "rw",
            "property_type": "property"
        }

        # 尝试每个API端点
        for i, url in enumerate(api_endpoints, 1):
            log(f"尝试API端点 {i}/{len(api_endpoints)}: {url}")
            log(f"请求数据: {property_definition}")

            try:
                # 对于控制台API，尝试不同的认证方式
                if "open.iot.10086.cn" in url:
                    # 控制台API可能需要不同的认证
                    console_headers = {
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    }

                    # 尝试不同的HTTP方法
                    methods_to_try = ["POST", "PUT", "PATCH"]

                    for method in methods_to_try:
                        log(f"尝试 {method} 方法: {url}")

                        if method == "POST":
                            response = requests.post(url, json=property_definition, headers=console_headers)
                        elif method == "PUT":
                            response = requests.put(url, json=property_definition, headers=console_headers)
                        elif method == "PATCH":
                            response = requests.patch(url, json=property_definition, headers=console_headers)

                        log(f"{method} 响应状态码: {response.status_code}")
                        log(f"{method} 响应内容: {response.text}")

                        if response.status_code in [200, 201, 202]:
                            try:
                                response_data = response.json()
                                if response_data.get("code") == 0 or response_data.get("errno") == 0 or response_data.get("success"):
                                    log(f"控制台API成功添加属性: {response_data}")
                                    return {
                                        "success": True,
                                        "method": f"console_api_{method.lower()}",
                                        "datastream_id": datastream_id,
                                        "api_endpoint": url,
                                        "message": f"通过控制台API成功添加属性 {datastream_id}",
                                        "response_data": response_data
                                    }
                            except:
                                # 即使解析失败，200状态码也可能表示成功
                                if "success" in response.text.lower() or "成功" in response.text:
                                    return {
                                        "success": True,
                                        "method": f"console_api_{method.lower()}",
                                        "datastream_id": datastream_id,
                                        "api_endpoint": url,
                                        "message": f"控制台API可能成功添加属性 {datastream_id}",
                                        "response_text": response.text
                                    }

                        # 如果不是405错误，就不用尝试其他方法了
                        if response.status_code != 405:
                            break
                else:
                    # 对于iot-api.heclouds.com，使用JWT认证
                    response = requests.post(url, json=property_definition, headers=headers)
                    log(f"响应状态码: {response.status_code}")
                    log(f"响应内容: {response.text}")

                    if response.status_code == 200:
                        try:
                            response_data = response.json()
                            if response_data.get("code") == 0 or response_data.get("errno") == 0:
                                log(f"成功在物模型中添加属性: {response_data}")
                                return {
                                    "success": True,
                                    "method": "thingmodel_property_add",
                                    "datastream_id": datastream_id,
                                    "api_endpoint": url,
                                    "message": f"成功在现有物模型中添加属性 {datastream_id}",
                                    "response_data": response_data
                                }
                        except:
                            # 即使解析失败，200状态码也可能表示成功
                            if "success" in response.text.lower() or "成功" in response.text:
                                return {
                                    "success": True,
                                    "method": "thingmodel_property_add",
                                    "datastream_id": datastream_id,
                                    "api_endpoint": url,
                                    "message": f"可能成功添加属性 {datastream_id}",
                                    "response_text": response.text
                                }

            except Exception as api_error:
                log(f"API端点 {url} 调用失败: {api_error}")
                continue

        return {
            "success": False,
            "error": "所有物模型管理API端点都失败",
            "tried_endpoints": api_endpoints,
            "suggestion": "需要手动在OneNet平台的物模型中添加属性"
        }

    except Exception as e:
        error_msg = f"在物模型中添加属性时出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def create_datastream_for_user(username):
    """为用户创建OneNET数据流（兼容函数）

    这个函数保留是为了兼容现有的API调用，实际上会调用新的设备创建函数

    参数:
        username: 用户名

    返回:
        dict: 创建结果
    """
    log(f"兼容模式：为用户 {username} 创建数据流（实际创建设备）")

    # 调用新的设备创建函数
    result = create_device_for_user(username)

    # 如果成功，调整返回格式以兼容旧的数据流创建API
    if result.get("success"):
        return {
            "success": True,
            "method": result.get("method", "device_creation"),
            "device_name": result.get("device_name"),
            "device_id": result.get("device_id"),
            "datastream_id": result.get("datastream_id", "rain_info"),
            "message": f"成功为用户 {username} 创建设备（新方案：每用户一设备）",
            "response_data": result.get("response_data", {}),
            "note": "新方案：每个用户使用独立设备，而不是共享设备的不同数据流"
        }
    else:
        return result

def create_datastream_old_api(datastream_id, username):
    """使用旧版API创建数据流"""
    try:
        # 使用OneNet旧版API创建数据流
        # URL格式: http://api.heclouds.com/devices/{device_id}/datastreams
        url = f"{ONENET_API_BASE_OLD}/devices/{DEVICE_ID}/datastreams"

        # 设置请求头，包含API-KEY
        # 注意：旧版API使用api-key而不是JWT token
        headers = {
            "api-key": ACCESS_KEY,
            "Content-Type": "application/json"
        }

        log(f"旧版API URL: {url}")
        log(f"使用API-KEY: {ACCESS_KEY[:20]}...")

        # 设置请求体，按照官方文档格式
        datastream_data = {
            "id": datastream_id,
            "tags": [f"user_{username}", "rainfall", "intelligent_wiper"],
            "unit": "mm/h",
            "unit_symbol": "mm/h"
        }

        log(f"旧版API请求数据: {datastream_data}")

        # 发送POST请求创建数据流
        response = requests.post(url, json=datastream_data, headers=headers)

        log(f"旧版API响应状态码: {response.status_code}")
        log(f"旧版API响应内容: {response.text}")

        # 检查响应状态码
        if response.status_code == 200 or response.status_code == 201:
            # 解析响应数据
            try:
                response_data = response.json()
                if response_data.get("errno") == 0:
                    log(f"旧版API数据流创建成功: {response_data}")
                    return {
                        "success": True,
                        "method": "old_api",
                        "device_id": DEVICE_ID,
                        "datastream_id": datastream_id,
                        "ds_uuid": response_data.get("data", {}).get("ds_uuid"),
                        "message": f"通过旧版API成功创建数据流 {datastream_id}",
                        "response_data": response_data
                    }
                else:
                    error_msg = f"旧版API返回错误: {response_data.get('error', '未知错误')}"
                    log(error_msg)
                    return {"success": False, "error": error_msg, "response_data": response_data}
            except Exception as parse_error:
                log(f"旧版API解析响应数据失败: {parse_error}")
                return {
                    "success": True,  # 状态码200表示成功，即使解析失败
                    "method": "old_api",
                    "datastream_id": datastream_id,
                    "message": f"旧版API数据流创建成功，响应: {response.text}",
                    "response_text": response.text
                }
        else:
            # 请求失败
            error_msg = f"旧版API创建数据流失败，状态码: {response.status_code}"
            try:
                error_data = response.json()
                error_msg += f", 错误信息: {error_data}"

                # 检查是否是数据流已存在的错误
                if "already exists" in str(error_data).lower() or "已存在" in str(error_data) or response.status_code == 409:
                    log(f"旧版API: 数据流 {datastream_id} 已存在")
                    return {
                        "success": True,
                        "method": "old_api",
                        "datastream_id": datastream_id,
                        "message": f"数据流 {datastream_id} 已存在",
                        "response_data": error_data
                    }
            except:
                error_msg += f", 响应内容: {response.text}"

            log(error_msg)
            return {"success": False, "error": error_msg}

    except Exception as e:
        error_msg = f"旧版API创建数据流时出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def create_datastream_new_api(datastream_id, username):
    """使用新版API创建数据流（通过物模型属性上报）"""
    try:
        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 方法1: 尝试通过物模型属性上报来创建属性
        log("尝试通过物模型属性上报创建属性")
        result1 = create_thingmodel_property(datastream_id, username, token)
        if result1["success"]:
            return result1

        # 方法2: 尝试通过传统数据点方式
        log("物模型方式失败，尝试传统数据点方式")
        result2 = create_datastream_by_datapoint(datastream_id, username, token)
        if result2["success"]:
            return result2

        # 两种方法都失败
        return {
            "success": False,
            "error": "新版API两种方法都失败",
            "thingmodel_error": result1.get("error"),
            "datapoint_error": result2.get("error")
        }

    except Exception as e:
        error_msg = f"新版API创建数据流时出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def create_thingmodel_property(datastream_id, username, token):
    """通过物模型属性上报创建属性"""
    try:
        # 先检查属性是否存在
        log(f"检查物模型属性 {datastream_id} 是否存在")
        check_result = check_thingmodel_property_exists(datastream_id, token)

        if check_result.get("exists"):
            log(f"属性 {datastream_id} 已存在，直接返回成功")
            return {
                "success": True,
                "method": "thingmodel_property_exists",
                "datastream_id": datastream_id,
                "message": f"物模型属性 {datastream_id} 已存在",
                "property_info": check_result.get("property_info")
            }

        # 方法1: 尝试通过MQTT主题上报来激活属性
        log(f"尝试通过MQTT主题上报激活属性 {datastream_id}")
        mqtt_result = try_create_property_via_mqtt_topic(datastream_id, username, token)
        if mqtt_result["success"]:
            return mqtt_result

        # 方法2: 尝试通过设置属性来"创建"属性
        log(f"MQTT方式失败，尝试设置物模型属性 {datastream_id}")
        url = f"{ONENET_API_BASE}/thingmodel/set-device-property"

        # 设置请求头，包含JWT token
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 设置请求体 - 上报物模型属性
        property_data = {
            "product_id": PRODUCT_ID,
            "device_name": DEVICE_NAME,
            "params": {
                datastream_id: 0.0  # 初始值
            }
        }

        log(f"物模型API URL: {url}")
        log(f"物模型API请求数据: {property_data}")

        # 发送POST请求
        response = requests.post(url, json=property_data, headers=headers)

        log(f"物模型API响应状态码: {response.status_code}")
        log(f"物模型API响应内容: {response.text}")

        # 检查响应状态码和内容
        if response.status_code == 200:
            try:
                response_data = response.json()

                # 检查是否成功
                if response_data.get("code") == 0:
                    log(f"物模型属性设置成功: {response_data}")
                    return {
                        "success": True,
                        "method": "thingmodel_property",
                        "datastream_id": datastream_id,
                        "message": f"通过物模型属性上报成功创建属性 {datastream_id}",
                        "response_data": response_data
                    }
                elif "identifier not exist" in response_data.get("msg", ""):
                    # 属性不存在，尝试动态创建
                    log(f"属性 {datastream_id} 不存在，尝试动态创建")
                    dynamic_result = try_dynamic_property_creation(datastream_id, username, token)
                    if dynamic_result["success"]:
                        return dynamic_result

                    # 动态创建失败，返回手动创建指导
                    error_msg = f"物模型属性 {datastream_id} 不存在，需要在OneNet平台的物模型中预先定义此属性"
                    log(error_msg)
                    return {
                        "success": False,
                        "error": error_msg,
                        "suggestion": f"请在OneNet平台的产品物模型中添加属性 '{datastream_id}'，类型为数值型",
                        "manual_steps": [
                            "1. 登录OneNet平台 (https://open.iot.10086.cn/)",
                            "2. 进入OneNet Studio -> 设备接入与管理 -> 产品管理",
                            f"3. 找到产品ID {PRODUCT_ID}，点击详情",
                            "4. 点击'设置物模型'按钮",
                            "5. 点击'添加自定义功能'",
                            "6. 功能类型选择'属性'",
                            f"7. 标识符填写: {datastream_id}",
                            "8. 数据类型选择'数值型'，单位填写'mm/h'",
                            "9. 点击'添加'，然后点击'保存'",
                            "10. 保存完成后，重新运行此脚本"
                        ],
                        "response_data": response_data
                    }
                else:
                    error_msg = f"物模型API返回错误: {response_data.get('msg', '未知错误')}"
                    log(error_msg)
                    return {"success": False, "error": error_msg, "response_data": response_data}
            except Exception as parse_error:
                log(f"解析物模型API响应失败: {parse_error}")
                return {
                    "success": False,
                    "error": f"解析响应失败: {parse_error}",
                    "response_text": response.text
                }
        else:
            error_msg = f"物模型API失败，状态码: {response.status_code}, 响应: {response.text}"
            log(error_msg)
            return {"success": False, "error": error_msg}

    except Exception as e:
        error_msg = f"物模型API出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def try_create_property_via_mqtt_topic(datastream_id, username, token):
    """尝试通过MQTT主题上报来激活属性"""
    try:
        # 使用物模型属性上报的MQTT主题格式
        url = f"{ONENET_API_BASE}/thingmodel/property-post"

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 模拟MQTT属性上报
        mqtt_data = {
            "product_id": PRODUCT_ID,
            "device_name": DEVICE_NAME,
            "properties": {
                datastream_id: {
                    "value": 0.0,
                    "time": int(datetime.now().timestamp() * 1000)
                }
            }
        }

        log(f"MQTT主题上报URL: {url}")
        log(f"MQTT主题上报数据: {mqtt_data}")

        response = requests.post(url, json=mqtt_data, headers=headers)

        log(f"MQTT主题上报响应状态码: {response.status_code}")
        log(f"MQTT主题上报响应内容: {response.text}")

        if response.status_code == 200:
            try:
                response_data = response.json()
                if response_data.get("code") == 0:
                    log(f"通过MQTT主题上报成功激活属性: {response_data}")
                    return {
                        "success": True,
                        "method": "mqtt_topic_activation",
                        "datastream_id": datastream_id,
                        "message": f"通过MQTT主题上报成功激活属性 {datastream_id}",
                        "response_data": response_data
                    }
            except:
                pass

        return {"success": False, "error": f"MQTT主题上报失败: {response.text}"}

    except Exception as e:
        log(f"MQTT主题上报出错: {str(e)}")
        return {"success": False, "error": str(e)}

def try_dynamic_property_creation(datastream_id, username, token):
    """尝试动态创建属性"""
    try:
        # 尝试使用产品物模型管理API（如果存在）
        url = f"{ONENET_API_BASE}/thingmodel/product-model/property"

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 动态创建属性的数据
        property_definition = {
            "product_id": PRODUCT_ID,
            "identifier": datastream_id,
            "name": f"雨量数据_{username}",
            "data_type": "DOUBLE",
            "unit": "mm/h",
            "description": f"用户 {username} 的雨量数据",
            "access_mode": "rw"
        }

        log(f"动态创建属性URL: {url}")
        log(f"动态创建属性数据: {property_definition}")

        response = requests.post(url, json=property_definition, headers=headers)

        log(f"动态创建属性响应状态码: {response.status_code}")
        log(f"动态创建属性响应内容: {response.text}")

        if response.status_code == 200:
            try:
                response_data = response.json()
                if response_data.get("code") == 0:
                    log(f"动态创建属性成功: {response_data}")
                    return {
                        "success": True,
                        "method": "dynamic_property_creation",
                        "datastream_id": datastream_id,
                        "message": f"动态创建属性 {datastream_id} 成功",
                        "response_data": response_data
                    }
            except:
                pass

        return {"success": False, "error": f"动态创建属性失败: {response.text}"}

    except Exception as e:
        log(f"动态创建属性出错: {str(e)}")
        return {"success": False, "error": str(e)}

def check_thingmodel_property_exists(datastream_id, token):
    """检查物模型属性是否存在"""
    try:
        # 使用查询设备属性API
        url = f"{ONENET_API_BASE}/thingmodel/query-device-property"

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        params = {
            "product_id": PRODUCT_ID,
            "device_name": DEVICE_NAME,
            "identifier": datastream_id
        }

        log(f"检查属性存在性: {url}, 参数: {params}")

        response = requests.get(url, params=params, headers=headers)

        log(f"属性检查响应状态码: {response.status_code}")
        log(f"属性检查响应内容: {response.text}")

        if response.status_code == 200:
            try:
                response_data = response.json()
                if response_data.get("code") == 0 and response_data.get("data"):
                    return {"exists": True, "property_info": response_data.get("data")}
                else:
                    return {"exists": False, "error": response_data.get("msg")}
            except:
                return {"exists": False, "error": "解析响应失败"}
        else:
            return {"exists": False, "error": f"请求失败，状态码: {response.status_code}"}

    except Exception as e:
        log(f"检查属性存在性时出错: {str(e)}")
        return {"exists": False, "error": str(e)}

def create_datastream_by_datapoint(datastream_id, username, token):
    """通过传统数据点方式创建数据流"""
    try:
        # 尝试通过发送数据点来创建数据流
        url = f"{ONENET_API_BASE}/datapoint/datapoints"

        # 设置请求头，包含JWT token
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 设置请求体 - 发送一个初始数据点
        datapoint_data = {
            "product_id": PRODUCT_ID,
            "device_name": DEVICE_NAME,
            "datastreams": [
                {
                    "identifier": datastream_id,
                    "datapoints": [
                        {
                            "value": 0.0,
                            "at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
                        }
                    ]
                }
            ]
        }

        log(f"数据点API URL: {url}")
        log(f"数据点API请求数据: {datapoint_data}")

        # 发送POST请求
        response = requests.post(url, json=datapoint_data, headers=headers)

        log(f"数据点API响应状态码: {response.status_code}")
        log(f"数据点API响应内容: {response.text}")

        # 检查响应状态码
        if response.status_code == 200 or response.status_code == 201:
            try:
                response_data = response.json()
                log(f"数据点创建成功: {response_data}")
                return {
                    "success": True,
                    "method": "datapoint",
                    "datastream_id": datastream_id,
                    "message": f"通过数据点成功创建数据流 {datastream_id}",
                    "response_data": response_data
                }
            except:
                return {
                    "success": True,
                    "method": "datapoint",
                    "datastream_id": datastream_id,
                    "message": f"数据点创建成功，响应: {response.text}",
                    "response_text": response.text
                }
        else:
            error_msg = f"数据点API失败，状态码: {response.status_code}, 响应: {response.text}"
            log(error_msg)
            return {"success": False, "error": error_msg}

    except Exception as e:
        error_msg = f"数据点API出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}





def generate_token(device_name=None):
    """生成OneNET平台的JWT token

    参数:
        device_name: 设备名称，如果为None则使用默认的DEVICE_NAME

    返回:
        str: JWT token字符串
    """
    try:
        # 使用传入的设备名称，如果没有则使用默认的
        target_device_name = device_name if device_name is not None else DEVICE_NAME

        # 设置token参数
        version = '2018-10-31'
        res = f"products/{PRODUCT_ID}/devices/{target_device_name}"
        # 设置token过期时间，这里设置为10小时后过期
        et = str(int(time.time()) + 36000)
        # 签名方法，支持md5、sha1、sha256
        method = 'sha1'

        # 对access_key进行decode
        key = base64.b64decode(ACCESS_KEY)

        # 计算sign
        org = et + '\n' + method + '\n' + res + '\n' + version
        sign_b = hmac.new(key=key, msg=org.encode(), digestmod=method)
        sign = base64.b64encode(sign_b.digest()).decode()

        # value部分进行url编码
        sign = quote(sign, safe='')
        res = quote(res, safe='')

        # token参数拼接
        token = f'version={version}&res={res}&et={et}&method={method}&sign={sign}'

        log(f"生成的OneNET token for device {target_device_name}: {token[:30]}...")
        return token
    except Exception as e:
        error_msg = f"生成OneNET token失败: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return None

def find_user_device(username):
    """查找用户的设备

    参数:
        username: 用户名

    返回:
        dict: 查找结果
    """
    try:
        log(f"查找用户 {username} 的设备")

        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 尝试多种可能的设备列表API端点
        api_endpoints = [
            f"{ONENET_API_BASE}/device",
            f"{ONENET_API_BASE}/devices",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/device",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/devices",
            f"{ONENET_API_BASE}/device/list",
            f"{ONENET_API_BASE}/devices/list"
        ]

        # 设置请求参数
        params = {
            "product_id": PRODUCT_ID,
            "limit": 100  # 获取更多设备以便查找
        }

        # 设置请求头
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 尝试每个API端点
        for i, url in enumerate(api_endpoints, 1):
            log(f"尝试设备查找API端点 {i}/{len(api_endpoints)}: {url}")
            log(f"查找参数: {params}")

            try:
                # 发送GET请求
                response = requests.get(url, params=params, headers=headers)

                log(f"设备查找响应状态码: {response.status_code}")
                log(f"设备查找响应内容: {response.text}")

                if response.status_code == 200:
                    try:
                        response_data = response.json()
                        if response_data.get("code") == 0:
                            # 尝试不同的数据结构
                            devices = []
                            data = response_data.get("data", {})

                            # 方式1: data.devices
                            if "devices" in data:
                                devices = data["devices"]
                            # 方式2: data直接是设备列表
                            elif isinstance(data, list):
                                devices = data
                            # 方式3: data.list
                            elif "list" in data:
                                devices = data["list"]

                            log(f"找到 {len(devices)} 个设备")

                            # 查找用户的设备
                            expected_device_name = f"intelligent_wiper_{username}"
                            for device in devices:
                                device_name = device.get("name") or device.get("device_name") or device.get("title")
                                log(f"检查设备: {device_name}")
                                if device_name == expected_device_name:
                                    device_id = device.get("did") or device.get("device_id") or device.get("id")
                                    log(f"找到用户设备: {device_name} (ID: {device_id})")
                                    return {
                                        "success": True,
                                        "device_name": device_name,
                                        "device_id": str(device_id),
                                        "device_info": device
                                    }

                            # 如果找到了设备列表但没有找到目标设备
                            if devices:
                                log(f"未找到用户 {username} 的设备 {expected_device_name}")
                                available_devices = [d.get("name") or d.get("device_name") or d.get("title") for d in devices]
                                return {
                                    "success": False,
                                    "error": f"未找到设备 {expected_device_name}",
                                    "available_devices": available_devices,
                                    "api_endpoint": url
                                }
                        else:
                            log(f"API返回错误: {response_data.get('msg', '未知错误')}")
                            continue
                    except Exception as parse_error:
                        log(f"解析响应失败: {parse_error}")
                        continue
                else:
                    log(f"API失败，状态码: {response.status_code}")
                    continue

            except Exception as api_error:
                log(f"API端点 {url} 调用失败: {api_error}")
                continue

        # 所有端点都失败
        return {
            "success": False,
            "error": "所有设备查找API端点都失败",
            "tried_endpoints": api_endpoints
        }

    except Exception as e:
        error_msg = f"查找用户设备时出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def get_onenet_data(username='admin'):
    """从OneNET平台获取雨量数据

    参数:
        username: 用户名，用于确定设备名称

    返回:
        dict: 包含雨量数据的字典
    """
    try:
        log(f"从OneNET平台获取雨量数据，用户: {username}")

        # 获取用户设备配置
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        device_id = device_config.get('device_id')
        datastream_id = device_config['datastream_id']

        log(f"使用设备名称: {device_name}, 设备ID: {device_id}, 数据流ID: {datastream_id}")

        # 如果是新用户但没有设备ID，尝试查找已创建的设备
        if device_id is None and username not in ["admin", "default", "legacy", "original"]:
            log(f"用户 {username} 没有设备ID，尝试查找已创建的设备")
            device_search_result = find_user_device(username)
            if device_search_result.get("success"):
                device_id = device_search_result.get("device_id")
                device_name = device_search_result.get("device_name")
                log(f"找到用户 {username} 的设备: {device_name} (ID: {device_id})")
            else:
                log(f"未找到用户 {username} 的设备")
                return {
                    "success": False,
                    "error": f"用户 {username} 的设备尚未创建，请先调用设备创建API",
                    "suggestion": f"请先运行: python onenet_api.py --action create_device --username {username}",
                    "search_error": device_search_result.get("error")
                }

        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 构建API URL，获取最新的数据点
        url = f"{ONENET_API_BASE}/datapoint/current-datapoints"

        # 设置请求参数
        params = {
            "product_id": PRODUCT_ID,
            "device_name": device_name,
            "identifier": datastream_id  # 指定用户的数据流
        }

        # 设置请求头，包含JWT token
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        log(f"请求OneNET API: {url}, 设备: {device_name}, 数据流: {datastream_id}")

        # 发送GET请求
        response = requests.get(url, params=params, headers=headers)

        # 检查响应状态码
        if response.status_code == 200:
            # 解析响应数据
            response_data = response.json()

            log(f"OneNET API响应: {response_data}")

            # 打印更详细的响应结构信息，帮助调试
            if "data" in response_data:
                data_keys = response_data["data"].keys() if isinstance(response_data["data"], dict) else "不是字典类型"
                log(f"响应中的data字段包含以下键: {data_keys}")

            # 检查是否成功获取数据
            if response_data.get("code") == 0 and "data" in response_data:
                data = response_data["data"]

                # 尝试不同的数据结构解析方式
                datapoint = None
                rainfall_value = None
                timestamp_str = None

                # 方式1: 直接在data中查找用户特定的数据流ID
                if datastream_id in data:
                    datapoint = data[datastream_id]
                    timestamp_str = datapoint.get("at")
                    rainfall_value = float(datapoint.get("value", 0))
                    log(f"使用方式1解析数据点: {datapoint}")

                # 方式2: 在devices结构中查找
                elif "devices" in data and len(data["devices"]) > 0:
                    device = data["devices"][0]

                    # 检查是否有数据流
                    if "datastreams" in device and len(device["datastreams"]) > 0:
                        # 查找用户特定的数据流
                        for stream in device["datastreams"]:
                            if stream.get("id") == datastream_id:
                                datapoint = stream
                                timestamp_str = datapoint.get("at")
                                rainfall_value = float(datapoint.get("value", 0))
                                log(f"使用方式2解析数据点: {datapoint}")
                                break

                # 如果找到了数据点
                if datapoint and timestamp_str is not None and rainfall_value is not None:
                    # 将时间戳转换为datetime对象
                    try:
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        # 尝试其他可能的时间格式
                        try:
                            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
                        except ValueError:
                            try:
                                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
                            except ValueError:
                                timestamp = datetime.now()  # 如果无法解析，使用当前时间

                    # 确保雨量值保留一位小数
                    rainfall_value = round(rainfall_value, 1)

                    # 获取雨量级别和百分比
                    level, percentage = get_rainfall_level(rainfall_value)

                    return {
                        "success": True,
                        "data": {
                            "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                            "rainfall_value": rainfall_value,  # mm/h 单位
                            "rainfall_level": level,
                            "rainfall_percentage": percentage,
                            "source": "OneNET",  # 标记数据来源
                            "unit": "mm/h"  # 明确标记单位
                        }
                    }
                else:
                    error_msg = f"未找到ID为 {datastream_id} 的数据流或数据点"
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
        error_msg = f"从OneNET平台获取雨量数据失败: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return {"success": False, "error": error_msg}

def activate_device_for_user(username):
    """激活用户的设备 - 通过OneNET新版API HTTP属性上报激活设备"""
    try:
        log(f"开始激活用户 {username} 的设备")

        # 获取用户设备配置
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        device_id = device_config.get('device_id')
        datastream_id = device_config['datastream_id']

        log(f"激活设备: {device_name}, 设备ID: {device_id}, 数据流ID: {datastream_id}")

        # 如果是新用户但没有设备ID，尝试查找已创建的设备
        if device_id is None and username not in ["admin", "default", "legacy", "original"]:
            log(f"用户 {username} 没有设备ID，尝试查找已创建的设备")
            device_search_result = find_user_device(username)
            if device_search_result.get("success"):
                device_id = device_search_result.get("device_id")
                device_name = device_search_result.get("device_name")
                log(f"找到用户 {username} 的设备: {device_name} (ID: {device_id})")
            else:
                log(f"未找到用户 {username} 的设备，需要先创建设备")
                return {
                    "success": False,
                    "error": f"用户 {username} 的设备尚未创建，请先调用设备创建API",
                    "suggestion": f"请先运行: python onenet_api.py --action create_device --username {username}",
                    "search_error": device_search_result.get("error")
                }

        # 获取设备密钥
        device_key = get_device_key(device_name)
        if not device_key:
            return {"success": False, "error": "获取设备密钥失败"}

        # 生成设备级token
        device_token = generate_device_token(device_name, device_key)
        if not device_token:
            return {"success": False, "error": "生成设备token失败"}

        # 通过多种方式尝试激活设备
        log(f"开始激活设备 {device_name}")

        # 策略1: 尝试MQTT连接激活（真正的激活方式）
        activation_result = mqtt_connection_activation(device_name, device_token)

        if not activation_result.get("success"):
            # 策略2: 尝试简单的设备上线激活
            log("MQTT连接激活失败，尝试简单激活")
            activation_result = simple_device_activation(device_name, device_token)

            if not activation_result.get("success"):
                # 策略3: 尝试HTTP属性上报激活
                log("简单激活失败，尝试HTTP属性上报激活")
                device_model_info = query_device_thing_model(device_name, device_token)
                activation_result = http_property_post_activation(device_name, device_token, datastream_id, device_model_info)

        if activation_result.get("success"):
            return {
                "success": True,
                "device_name": device_name,
                "device_id": device_id,
                "message": f"设备 {device_name} 激活成功",
                "activation_method": "HTTP属性上报",
                "activation_details": activation_result
            }
        else:
            return {
                "success": False,
                "error": f"设备 {device_name} 激活失败",
                "activation_details": activation_result
            }

    except Exception as e:
        error_msg = f"激活设备时出错: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return {"success": False, "error": error_msg}

def get_device_key(device_name):
    """获取设备密钥"""
    try:
        log(f"获取设备 {device_name} 的密钥")

        # 生成平台级token
        token = generate_token()
        if not token:
            log("生成平台token失败")
            return None

        # 使用设备列表API查询设备信息
        url = f"{ONENET_API_BASE}/device/list"

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        params = {
            "product_id": PRODUCT_ID,
            "limit": 100
        }

        response = requests.get(url, params=params, headers=headers)

        if response.status_code == 200:
            try:
                response_data = response.json()
                if response_data.get("code") == 0:
                    devices = response_data.get("data", {}).get("list", [])

                    # 查找目标设备
                    for device in devices:
                        if device.get("name") == device_name:
                            sec_key = device.get("sec_key")
                            if sec_key:
                                log(f"找到设备密钥: {sec_key[:20]}...")
                                return sec_key
                            else:
                                log(f"设备 {device_name} 没有密钥")
                                return None

                    log(f"未找到设备 {device_name}")
                    return None
                else:
                    log(f"查询设备信息失败: {response_data.get('msg', '未知错误')}")
                    return None
            except:
                log(f"解析设备信息响应失败")
                return None
        else:
            log(f"查询设备信息API失败，状态码: {response.status_code}")
            return None

    except Exception as e:
        log(f"获取设备密钥出错: {str(e)}")
        return None

def generate_device_token(device_name, device_key):
    """生成设备级token"""
    try:
        import hmac
        import hashlib
        import base64
        import urllib.parse
        import time

        log(f"生成设备 {device_name} 的token")

        # OneNET新版API设备级token参数
        version = "2018-10-31"
        resource_name = f"products/{PRODUCT_ID}/devices/{device_name}"
        expiration_time = str(int(time.time()) + 100 * 24 * 60 * 60)  # 100天后过期
        signature_method = "sha1"

        # 构建签名字符串
        string_to_sign = f"{expiration_time}\n{signature_method}\n{resource_name}\n{version}"

        # 使用设备密钥进行HMAC-SHA1签名
        key_bytes = base64.b64decode(device_key)
        signature = hmac.new(key_bytes, string_to_sign.encode('utf-8'), hashlib.sha1).digest()
        signature_b64 = base64.b64encode(signature).decode('utf-8')

        # 构建token
        token_parts = [
            f"version={version}",
            f"res={urllib.parse.quote(resource_name, safe='')}",
            f"et={expiration_time}",
            f"method={signature_method}",
            f"sign={urllib.parse.quote(signature_b64, safe='')}"
        ]

        token = "&".join(token_parts)
        log(f"设备token生成成功: {token[:50]}...")
        return token

    except Exception as e:
        log(f"生成设备token出错: {str(e)}")
        return None

def mqtt_connection_activation(device_name, device_token):
    """通过MQTT连接激活设备 - 真正的激活方式"""
    try:
        log(f"尝试通过MQTT连接激活设备 {device_name}")

        # 检查是否安装了paho-mqtt
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            log("未安装paho-mqtt库，尝试安装...")
            try:
                import subprocess
                subprocess.check_call([sys.executable, "-m", "pip", "install", "paho-mqtt"])
                import paho.mqtt.client as mqtt
                log("paho-mqtt库安装成功")
            except Exception as e:
                log(f"无法安装paho-mqtt库: {e}")
                return {
                    "success": False,
                    "error": "无法安装paho-mqtt库，请手动安装: pip install paho-mqtt"
                }

        # OneNET MQTT连接参数
        mqtt_host = "183.230.40.96"  # OneNET MQTT服务器
        mqtt_port = 1883
        client_id = device_name
        username = PRODUCT_ID
        password = device_token

        # 创建MQTT客户端
        client = mqtt.Client(client_id=client_id)
        client.username_pw_set(username, password)

        # 连接状态标志
        connection_result = {"connected": False, "error": None}

        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                log(f"MQTT连接成功，设备 {device_name} 已激活")
                connection_result["connected"] = True

                # 发布多条消息来确保设备激活
                messages = [
                    {
                        "topic": f"$sys/{PRODUCT_ID}/{device_name}/thing/property/post",
                        "payload": {
                            "id": "123",
                            "version": "1.0",
                            "params": {
                                "status": {
                                    "value": "online",
                                    "time": int(time.time() * 1000)
                                }
                            }
                        }
                    },
                    {
                        "topic": f"$sys/{PRODUCT_ID}/{device_name}/thing/property/post",
                        "payload": {
                            "id": "124",
                            "version": "1.0",
                            "params": {
                                "temperature": {
                                    "value": 25.0,
                                    "time": int(time.time() * 1000)
                                }
                            }
                        }
                    },
                    {
                        "topic": f"$sys/{PRODUCT_ID}/{device_name}/thing/property/post",
                        "payload": {
                            "id": "125",
                            "version": "1.0",
                            "params": {
                                "humidity": {
                                    "value": 60.0,
                                    "time": int(time.time() * 1000)
                                }
                            }
                        }
                    }
                ]

                try:
                    for i, msg in enumerate(messages):
                        client.publish(msg["topic"], json.dumps(msg["payload"]))
                        log(f"发布激活消息 {i+1}/{len(messages)} 到主题: {msg['topic']}")
                        time.sleep(1)  # 每条消息间隔1秒
                except Exception as e:
                    log(f"发布消息失败: {e}")

                # 保持连接5秒钟，然后断开
                log("保持MQTT连接5秒钟以确保激活...")
                time.sleep(5)
                client.disconnect()
            else:
                error_msg = f"MQTT连接失败，返回码: {rc}"
                log(error_msg)
                connection_result["error"] = error_msg

        def on_disconnect(client, userdata, rc):
            log(f"MQTT连接已断开，返回码: {rc}")

        def on_publish(client, userdata, mid):
            log(f"消息发布成功，消息ID: {mid}")

        # 设置回调函数
        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_publish = on_publish

        # 尝试连接
        log(f"连接到MQTT服务器: {mqtt_host}:{mqtt_port}")
        log(f"客户端ID: {client_id}")
        log(f"用户名: {username}")
        log(f"密码: {password[:50]}...")

        try:
            client.connect(mqtt_host, mqtt_port, 60)

            # 等待连接结果
            start_time = time.time()
            timeout = 20  # 20秒超时，给足够时间处理消息

            while time.time() - start_time < timeout:
                client.loop(timeout=1)
                if connection_result["connected"] or connection_result["error"]:
                    break
                time.sleep(0.1)

            if connection_result["connected"]:
                return {
                    "success": True,
                    "message": f"设备 {device_name} 通过MQTT连接激活成功",
                    "activation_method": "MQTT连接",
                    "mqtt_host": mqtt_host,
                    "mqtt_port": mqtt_port
                }
            else:
                error = connection_result["error"] or "连接超时"
                return {
                    "success": False,
                    "error": f"MQTT连接激活失败: {error}",
                    "mqtt_host": mqtt_host,
                    "mqtt_port": mqtt_port
                }

        except Exception as e:
            error_msg = f"MQTT连接异常: {str(e)}"
            log(error_msg)
            return {
                "success": False,
                "error": error_msg
            }

    except Exception as e:
        error_msg = f"MQTT连接激活出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def simple_device_activation(device_name, device_token):
    """简单的设备激活方式 - 通过设备上线来激活"""
    try:
        log(f"尝试简单激活设备 {device_name}")

        # 尝试多种简单的激活方式
        activation_methods = [
            # 方法1: 设备上线通知
            {
                "url": "https://open.iot.10086.cn/fuse/http/device/thing/event/post",
                "params": {
                    "topic": f"$sys/{PRODUCT_ID}/{device_name}/thing/event/post",
                    "protocol": "mqtt"
                },
                "body": {
                    "id": "123",
                    "version": "1.0",
                    "params": {
                        "online": {
                            "value": {
                                "status": "online",
                                "timestamp": int(time.time() * 1000)
                            },
                            "time": int(time.time() * 1000)
                        }
                    }
                }
            },
            # 方法2: 设备状态上报
            {
                "url": "https://open.iot.10086.cn/fuse/http/device/thing/property/post",
                "params": {
                    "topic": f"$sys/{PRODUCT_ID}/{device_name}/thing/property/post",
                    "protocol": "mqtt"
                },
                "body": {
                    "id": "123",
                    "version": "1.0",
                    "params": {}  # 空参数，只是为了触发设备上线
                }
            },
            # 方法3: 设备心跳
            {
                "url": "https://open.iot.10086.cn/fuse/http/device/thing/event/post",
                "params": {
                    "topic": f"$sys/{PRODUCT_ID}/{device_name}/thing/event/heartbeat",
                    "protocol": "mqtt"
                },
                "body": {
                    "id": "123",
                    "version": "1.0",
                    "params": {
                        "heartbeat": {
                            "value": {
                                "timestamp": int(time.time() * 1000)
                            },
                            "time": int(time.time() * 1000)
                        }
                    }
                }
            }
        ]

        headers = {
            "Content-Type": "application/json",
            "token": device_token
        }

        for i, method in enumerate(activation_methods, 1):
            log(f"尝试简单激活方法 {i}/{len(activation_methods)}")
            log(f"URL: {method['url']}")
            log(f"参数: {method['params']}")

            try:
                response = requests.post(
                    method["url"],
                    params=method["params"],
                    headers=headers,
                    json=method["body"],
                    timeout=30
                )

                log(f"简单激活方法 {i} 响应状态码: {response.status_code}")
                log(f"简单激活方法 {i} 响应内容: {response.text}")

                if response.status_code == 200:
                    try:
                        response_data = response.json()
                        if response_data.get("errno") == 0:
                            log(f"设备 {device_name} 简单激活成功（方法 {i}）")
                            return {
                                "success": True,
                                "message": f"设备 {device_name} 简单激活成功（方法 {i}）",
                                "response_data": response_data,
                                "activation_method": f"简单激活方法{i}"
                            }
                    except:
                        pass

            except Exception as e:
                log(f"简单激活方法 {i} 失败: {e}")
                continue

        return {
            "success": False,
            "error": "所有简单激活方法都失败了",
            "attempted_methods": len(activation_methods)
        }

    except Exception as e:
        error_msg = f"简单激活出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def query_device_thing_model(device_name, device_token):
    """查询设备的物模型信息"""
    try:
        log(f"查询设备 {device_name} 的物模型信息")

        # 尝试查询设备的物模型
        url = f"https://open.iot.10086.cn/fuse/http/device/thing/model/get"

        params = {
            "topic": f"$sys/{PRODUCT_ID}/{device_name}/thing/model/get",
            "protocol": "mqtt"
        }

        headers = {
            "Content-Type": "application/json",
            "token": device_token
        }

        body = {
            "id": "123",
            "version": "1.0",
            "params": {}
        }

        response = requests.post(url, params=params, headers=headers, json=body, timeout=30)

        log(f"物模型查询响应状态码: {response.status_code}")
        log(f"物模型查询响应内容: {response.text}")

        if response.status_code == 200:
            try:
                response_data = response.json()
                if response_data.get("errno") == 0:
                    return response_data.get("data", {})
            except:
                pass

        # 如果查询失败，返回默认的物模型信息
        log("物模型查询失败，使用默认配置")
        return {
            "properties": [
                {"identifier": "temperature", "name": "温度"},
                {"identifier": "humidity", "name": "湿度"},
                {"identifier": "rainfall", "name": "雨量"},
                {"identifier": "rain", "name": "降雨"},
                {"identifier": "temp", "name": "温度"},
                {"identifier": "hum", "name": "湿度"}
            ]
        }

    except Exception as e:
        log(f"查询物模型出错: {str(e)}")
        return {
            "properties": [
                {"identifier": "temperature", "name": "温度"},
                {"identifier": "humidity", "name": "湿度"}
            ]
        }

def http_property_post_activation(device_name, device_token, datastream_id, device_model_info=None):
    """通过HTTP属性上报激活设备"""
    try:
        log(f"开始通过HTTP属性上报激活设备 {device_name}")

        # OneNET新版API HTTP属性上报端点
        topic = f"$sys/{PRODUCT_ID}/{device_name}/thing/property/post"

        url = f"https://open.iot.10086.cn/fuse/http/device/thing/property/post"

        # 请求参数 - 根据官方文档，protocol应该是http
        params = {
            "topic": topic,
            "protocol": "http"
        }

        # 请求头
        headers = {
            "Content-Type": "application/json",
            "token": device_token
        }

        # 请求体 - OneJSON格式，根据物模型信息构建
        params_dict = {}

        if device_model_info and "properties" in device_model_info:
            # 使用物模型中的属性
            properties = device_model_info["properties"]
            log(f"使用物模型属性: {[p.get('identifier') for p in properties]}")

            for prop in properties[:2]:  # 只使用前两个属性
                identifier = prop.get("identifier")
                if identifier:
                    if "temp" in identifier.lower():
                        params_dict[identifier] = {"value": 25.0}
                    elif "hum" in identifier.lower():
                        params_dict[identifier] = {"value": 60.0}
                    elif "rain" in identifier.lower():
                        params_dict[identifier] = {"value": 0.0}
                    else:
                        params_dict[identifier] = {"value": 1.0}

        # 如果没有物模型信息或没有属性，使用默认值
        if not params_dict:
            log("使用默认属性参数")
            params_dict = {
                "temperature": {"value": 25.0},
                "humidity": {"value": 60.0}
            }

        body = {
            "id": "123",
            "version": "1.0",
            "params": params_dict
        }

        log(f"HTTP属性上报URL: {url}")
        log(f"请求参数: {params}")
        log(f"请求体: {body}")

        # 发送POST请求
        response = requests.post(url, params=params, headers=headers, json=body, timeout=30)

        log(f"HTTP属性上报响应状态码: {response.status_code}")
        log(f"HTTP属性上报响应内容: {response.text}")

        if response.status_code == 200:
            try:
                response_data = response.json()
                if response_data.get("errno") == 0:
                    log(f"设备 {device_name} HTTP属性上报成功，设备已激活")
                    return {
                        "success": True,
                        "message": f"设备 {device_name} 通过HTTP属性上报激活成功",
                        "response_data": response_data
                    }
                else:
                    error_msg = response_data.get("error", "未知错误")
                    log(f"HTTP属性上报失败: {error_msg}")

                    # 如果是协议不匹配错误，尝试其他方法
                    if "protocol not match" in error_msg.lower():
                        log("协议不匹配，尝试使用MQTT协议格式")
                        return try_mqtt_style_activation(device_name, device_token, datastream_id, device_model_info)

                    return {
                        "success": False,
                        "error": f"HTTP属性上报失败: {error_msg}",
                        "response_data": response_data
                    }
            except:
                log(f"解析HTTP属性上报响应失败")
                return {
                    "success": False,
                    "error": "解析HTTP属性上报响应失败",
                    "response_text": response.text
                }
        else:
            return {
                "success": False,
                "error": f"HTTP属性上报请求失败，状态码: {response.status_code}",
                "response_text": response.text
            }

    except Exception as e:
        error_msg = f"HTTP属性上报激活出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def try_mqtt_style_activation(device_name, device_token, datastream_id, device_model_info=None):
    """尝试使用MQTT风格的激活方式"""
    try:
        log(f"尝试使用MQTT风格激活设备 {device_name}")

        # 尝试不同的URL和参数组合
        activation_attempts = [
            {
                "url": "https://open.iot.10086.cn/fuse/http/device/thing/property/post",
                "params": {
                    "topic": f"$sys/{PRODUCT_ID}/{device_name}/thing/property/post",
                    "protocol": "mqtt"
                }
            },
            {
                "url": "https://open.iot.10086.cn/fuse/http/device/thing/property/post",
                "params": {
                    "topic": f"$sys/{PRODUCT_ID}/{device_name}/thing/property/post"
                    # 不包含protocol参数
                }
            },
            {
                "url": "https://open.iot.10086.cn/fuse/http/device/thing/property/post",
                "params": {
                    "topic": f"{PRODUCT_ID}/{device_name}/thing/property/post",
                    "protocol": "http"
                }
            }
        ]

        headers = {
            "Content-Type": "application/json",
            "token": device_token
        }

        # 构建请求体，使用物模型信息
        params_dict = {}

        if device_model_info and "properties" in device_model_info:
            # 使用物模型中的属性
            properties = device_model_info["properties"]
            log(f"MQTT风格激活使用物模型属性: {[p.get('identifier') for p in properties]}")

            for prop in properties[:2]:  # 只使用前两个属性
                identifier = prop.get("identifier")
                if identifier:
                    if "temp" in identifier.lower():
                        params_dict[identifier] = {"value": 25.0}
                    elif "hum" in identifier.lower():
                        params_dict[identifier] = {"value": 60.0}
                    elif "rain" in identifier.lower():
                        params_dict[identifier] = {"value": 0.0}
                    else:
                        params_dict[identifier] = {"value": 1.0}

        # 如果没有物模型信息，尝试多种常见的标识符组合
        if not params_dict:
            log("MQTT风格激活使用默认属性参数")
            # 尝试多种可能的标识符组合
            identifier_combinations = [
                {"temp": {"value": 25.0}, "hum": {"value": 60.0}},
                {"temperature": {"value": 25.0}, "humidity": {"value": 60.0}},
                {"rainfall": {"value": 0.0}, "status": {"value": "online"}},
                {"rain": {"value": 0.0}, "temp": {"value": 25.0}},
                {"data": {"value": 1.0}, "state": {"value": "active"}}
            ]
            params_dict = identifier_combinations[0]  # 先使用第一个组合

        body = {
            "id": "123",
            "version": "1.0",
            "params": params_dict
        }

        for i, attempt in enumerate(activation_attempts, 1):
            log(f"尝试激活方式 {i}/{len(activation_attempts)}")
            log(f"URL: {attempt['url']}")
            log(f"参数: {attempt['params']}")

            try:
                response = requests.post(
                    attempt["url"],
                    params=attempt["params"],
                    headers=headers,
                    json=body,
                    timeout=30
                )

                log(f"响应状态码: {response.status_code}")
                log(f"响应内容: {response.text}")

                if response.status_code == 200:
                    try:
                        response_data = response.json()
                        if response_data.get("errno") == 0:
                            log(f"设备 {device_name} 激活成功（方式 {i}）")
                            return {
                                "success": True,
                                "message": f"设备 {device_name} 激活成功（使用方式 {i}）",
                                "response_data": response_data,
                                "activation_method": f"方式{i}"
                            }
                    except:
                        pass

            except Exception as e:
                log(f"激活方式 {i} 失败: {e}")
                continue

        return {
            "success": False,
            "error": "所有激活方式都失败了",
            "attempted_methods": len(activation_attempts)
        }

    except Exception as e:
        error_msg = f"MQTT风格激活出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def get_device_sec_key(device_name, token):
    """获取设备的安全密钥"""
    try:
        log(f"获取设备 {device_name} 的安全密钥")

        # 使用设备列表API查询设备信息
        url = f"{ONENET_API_BASE}/device/list"

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        params = {
            "product_id": PRODUCT_ID,
            "limit": 100
        }

        response = requests.get(url, params=params, headers=headers)

        if response.status_code == 200:
            try:
                response_data = response.json()
                if response_data.get("code") == 0:
                    devices = response_data.get("data", {}).get("list", [])

                    # 查找目标设备
                    for device in devices:
                        if device.get("name") == device_name:
                            sec_key = device.get("sec_key")
                            if sec_key:
                                log(f"找到设备安全密钥: {sec_key[:20]}...")
                                return sec_key
                            else:
                                log(f"设备 {device_name} 没有安全密钥")
                                return None

                    log(f"未找到设备 {device_name}")
                    return None
                else:
                    log(f"查询设备信息失败: {response_data.get('msg', '未知错误')}")
                    return None
            except:
                log(f"解析设备信息响应失败")
                return None
        else:
            log(f"查询设备信息API失败，状态码: {response.status_code}")
            return None

    except Exception as e:
        log(f"获取设备安全密钥出错: {str(e)}")
        return None

def http_activate_device(device_name, device_id, token):
    """通过HTTP数据上传激活设备"""
    try:
        log(f"尝试通过HTTP数据上传激活设备 {device_name}")

        # 使用新版OneNET物模型API端点
        api_endpoints = [
            f"{ONENET_API_BASE}/thingmodel/set-device-property",
            f"{ONENET_API_BASE}/thingmodel/query-device-property",
            f"{ONENET_API_BASE}/thingmodel/property-post",
            f"{ONENET_API_BASE}/thingmodel/device-property-post"
        ]

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 构建激活数据
        current_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        # 尝试常见的物模型属性标识符
        common_identifiers = [
            # 常见的雨量传感器标识符
            ["rainfall", "status"],
            ["rain", "online"],
            ["precipitation", "device_state"],
            ["water_level", "connection_status"],
            ["humidity", "power_status"],
            # 通用属性标识符
            ["temperature", "humidity"],
            ["temp", "hum"],
            ["value", "state"],
            ["data", "status"]
        ]

        activation_data_variants = []

        # 为每组标识符生成数据格式
        for identifiers in common_identifiers:
            rain_id, status_id = identifiers

            # 变体1: 设备属性设置格式（用于set-device-property）- 正确的Params格式
            activation_data_variants.append({
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "params": {
                    rain_id: 0.0,
                    status_id: "online"
                }
            })

            # 变体2: 物模型属性上报格式（用于property-post）
            activation_data_variants.append({
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "properties": {
                    rain_id: {
                        "value": 0.0,
                        "time": int(datetime.now().timestamp() * 1000)
                    },
                    status_id: {
                        "value": "online",
                        "time": int(datetime.now().timestamp() * 1000)
                    }
                }
            })

        # 尝试每个API端点和数据格式组合
        for i, url in enumerate(api_endpoints, 1):
            log(f"尝试HTTP激活API端点 {i}/{len(api_endpoints)}: {url}")

            for j, data in enumerate(activation_data_variants, 1):
                log(f"  尝试数据格式 {j}/{len(activation_data_variants)}")

                try:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
                    log(f"  HTTP激活响应状态码: {response.status_code}")
                    log(f"  HTTP激活响应内容: {response.text}")

                    if response.status_code in [200, 201, 204]:
                        try:
                            response_data = response.json()
                            if response_data.get("code") == 0 or response_data.get("errno") == 0:
                                log(f"HTTP激活成功: {response_data}")
                                return {
                                    "success": True,
                                    "message": f"设备 {device_name} HTTP激活成功",
                                    "api_endpoint": url,
                                    "data_format": j,
                                    "response_data": response_data
                                }
                        except:
                            # 如果没有JSON响应，但状态码成功，也认为成功
                            log(f"HTTP激活成功（无JSON响应）")
                            return {
                                "success": True,
                                "message": f"设备 {device_name} HTTP激活成功",
                                "api_endpoint": url,
                                "data_format": j,
                                "response_text": response.text
                            }

                except requests.exceptions.RequestException as e:
                    log(f"  HTTP激活请求失败: {e}")
                    continue

        # 所有尝试都失败
        return {
            "success": False,
            "error": f"所有HTTP激活尝试都失败，设备 {device_name} HTTP激活失败",
            "attempted_endpoints": api_endpoints
        }

    except Exception as e:
        error_msg = f"HTTP激活出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def mqtt_activate_device(device_name, device_id, sec_key=None):
    """通过MQTT连接激活设备"""
    try:
        log(f"尝试通过MQTT连接激活设备 {device_name}")

        # 调用MQTT设备激活器
        import subprocess
        import os

        # 获取当前脚本目录
        current_dir = os.path.dirname(os.path.abspath(__file__))
        mqtt_script = os.path.join(current_dir, "mqtt_device_activator.py")

        # 检查MQTT激活器脚本是否存在
        if not os.path.exists(mqtt_script):
            log(f"MQTT激活器脚本不存在: {mqtt_script}")
            return {
                "success": False,
                "error": "MQTT激活器脚本不存在"
            }

        # 调用MQTT激活器
        cmd = [
            sys.executable,  # 使用当前Python解释器
            mqtt_script,
            "activate",
            "--device_name", device_name,
            "--device_id", str(device_id)
        ]

        # 如果有sec_key，添加到命令中
        if sec_key:
            cmd.extend(["--sec_key", sec_key])
            log(f"使用设备sec_key: {sec_key[:20]}...")

        log(f"执行MQTT激活命令: {' '.join(cmd)}")

        # 执行命令
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore',
            timeout=60  # 60秒超时
        )

        log(f"MQTT激活命令退出码: {result.returncode}")
        log(f"MQTT激活标准输出: {result.stdout}")

        if result.stderr:
            log(f"MQTT激活标准错误: {result.stderr}")

        if result.returncode == 0:
            try:
                # 解析JSON输出
                if result.stdout and result.stdout.strip():
                    # 查找JSON输出（可能在多行输出中）
                    lines = result.stdout.strip().split('\n')
                    json_line = None
                    for line in lines:
                        line = line.strip()
                        if line.startswith('{') and line.endswith('}'):
                            json_line = line
                            break

                    if json_line:
                        mqtt_result = json.loads(json_line)
                        log(f"MQTT激活结果: {mqtt_result}")
                        return mqtt_result
                    else:
                        log(f"未找到JSON输出，原始输出: {result.stdout}")
                        return {
                            "success": False,
                            "error": "未找到有效的JSON输出",
                            "raw_output": result.stdout
                        }
                else:
                    log("MQTT激活器没有输出")
                    return {
                        "success": False,
                        "error": "MQTT激活器没有输出",
                        "raw_output": result.stdout
                    }
            except json.JSONDecodeError as e:
                log(f"解析MQTT激活结果失败: {e}")
                return {
                    "success": False,
                    "error": f"解析MQTT激活结果失败: {e}",
                    "raw_output": result.stdout
                }
        else:
            return {
                "success": False,
                "error": f"MQTT激活命令执行失败，退出码: {result.returncode}",
                "stderr": result.stderr,
                "stdout": result.stdout
            }

    except subprocess.TimeoutExpired:
        log("MQTT激活超时")
        return {
            "success": False,
            "error": "MQTT激活超时"
        }
    except Exception as e:
        error_msg = f"MQTT激活出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def update_device_activation_status(device_name, token):
    """通过OneNET API更新设备激活状态"""
    try:
        log(f"尝试通过API更新设备 {device_name} 的激活状态")

        # 首先获取设备ID
        device_id = None
        device_search_result = find_user_device(device_name.replace("intelligent_wiper_", ""))
        if device_search_result.get("success"):
            device_id = device_search_result.get("device_id")
            log(f"获取到设备ID: {device_id}")

        # 尝试多个可能的设备激活API端点
        api_endpoints = [
            f"{ONENET_API_BASE}/device/update",
            f"{ONENET_API_BASE}/device/activate",
            f"{ONENET_API_BASE}/device/online",
            f"{ONENET_API_BASE}/device/{device_name}/activate",
            f"{ONENET_API_BASE}/device/{device_name}/online",
            f"{ONENET_API_BASE}/device/{device_name}/status",
        ]

        # 如果有设备ID，添加基于ID的端点
        if device_id:
            api_endpoints.extend([
                f"{ONENET_API_BASE}/device/{device_id}/activate",
                f"{ONENET_API_BASE}/device/{device_id}/online",
                f"{ONENET_API_BASE}/device/{device_id}/status",
                f"{ONENET_API_BASE}/device/{device_id}/update",
                f"{ONENET_API_BASE}/devices/{device_id}/activate",
                f"{ONENET_API_BASE}/devices/{device_id}/online",
                f"{ONENET_API_BASE}/devices/{device_id}/status"
            ])

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 设备激活数据 - 尝试不同的参数格式
        current_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        activation_data_variants = [
            # 变体1: 完整激活参数 - 设置为已激活状态
            {
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "status": 0,  # 0表示已激活/在线
                "activate_time": current_time,
                "last_time": current_time,
                "enable_status": True,
                "online": True
            },
            # 变体2: 使用不同的时间格式
            {
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "status": 0,
                "activate_time": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+08:00",
                "last_time": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "+08:00"
            },
            # 变体3: 使用Unix时间戳
            {
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "status": 0,
                "activate_time": int(datetime.now().timestamp()),
                "last_time": int(datetime.now().timestamp())
            },
            # 变体4: 只设置状态为0
            {
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "status": 0
            },
            # 变体5: 使用act_time和last_login字段（从API响应中看到的字段）
            {
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "status": 0,
                "act_time": current_time,
                "last_login": current_time
            },
            # 变体6: 尝试online字段
            {
                "product_id": PRODUCT_ID,
                "device_name": device_name,
                "online": True,
                "status": 0
            }
        ]

        # 如果有设备ID，添加基于设备ID的激活数据
        if device_id:
            activation_data_variants.extend([
                # 使用设备ID的激活数据
                {
                    "product_id": PRODUCT_ID,
                    "device_id": device_id,
                    "status": 0,
                    "activate_time": current_time,
                    "last_time": current_time,
                    "online": True
                },
                {
                    "product_id": PRODUCT_ID,
                    "did": device_id,
                    "status": 0,
                    "activate_time": current_time,
                    "last_time": current_time
                },
                # 只使用设备ID
                {
                    "device_id": device_id,
                    "status": 0,
                    "activate_time": current_time,
                    "last_time": current_time
                },
                {
                    "did": device_id,
                    "status": 0,
                    "online": True
                }
            ])

        # 尝试每个API端点和数据格式组合
        for i, url in enumerate(api_endpoints, 1):
            log(f"尝试设备激活API端点 {i}/{len(api_endpoints)}: {url}")

            # 对每个端点尝试不同的数据格式
            for j, activation_data in enumerate(activation_data_variants, 1):
                log(f"  尝试数据格式 {j}/{len(activation_data_variants)}: {activation_data}")

                try:
                    # 尝试PUT方法
                    response = requests.put(url, json=activation_data, headers=headers, timeout=30)
                    log(f"  PUT请求响应状态码: {response.status_code}")
                    log(f"  PUT请求响应内容: {response.text}")

                    if response.status_code in [200, 201, 204]:
                        try:
                            response_data = response.json()
                            if response_data.get("code") == 0:
                                log(f"设备激活API调用成功: {response_data}")
                                return {
                                    "success": True,
                                    "message": f"设备 {device_name} 激活状态更新成功",
                                    "api_endpoint": url,
                                    "data_format": j,
                                    "response_data": response_data
                                }
                        except:
                            # 如果没有JSON响应，但状态码成功，也认为成功
                            log(f"设备激活API调用成功（无JSON响应）")
                            return {
                                "success": True,
                                "message": f"设备 {device_name} 激活状态更新成功",
                                "api_endpoint": url,
                                "data_format": j,
                                "response_text": response.text
                            }

                    # 如果PUT失败，尝试POST方法
                    response = requests.post(url, json=activation_data, headers=headers, timeout=30)
                    log(f"  POST请求响应状态码: {response.status_code}")
                    log(f"  POST请求响应内容: {response.text}")

                    if response.status_code in [200, 201, 204]:
                        try:
                            response_data = response.json()
                            if response_data.get("code") == 0:
                                log(f"设备激活API调用成功: {response_data}")
                                return {
                                    "success": True,
                                    "message": f"设备 {device_name} 激活状态更新成功",
                                    "api_endpoint": url,
                                    "data_format": j,
                                    "response_data": response_data
                                }
                        except:
                            # 如果没有JSON响应，但状态码成功，也认为成功
                            log(f"设备激活API调用成功（无JSON响应）")
                            return {
                                "success": True,
                                "message": f"设备 {device_name} 激活状态更新成功",
                                "api_endpoint": url,
                                "data_format": j,
                                "response_text": response.text
                            }

                except requests.exceptions.RequestException as e:
                    log(f"  API端点 {url} 数据格式 {j} 请求失败: {e}")
                    continue

        # 所有API端点都失败
        return {
            "success": False,
            "error": f"所有设备激活API端点都失败，设备 {device_name} 激活状态更新失败",
            "attempted_endpoints": api_endpoints
        }

    except Exception as e:
        error_msg = f"更新设备激活状态出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def send_device_status_data(device_name, token):
    """发送设备状态数据，模拟设备上线"""
    try:
        # 使用物模型属性上报API发送设备状态
        url = f"{ONENET_API_BASE}/thingmodel/property-post"

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 构建设备状态数据（使用物模型格式）
        status_data = {
            "product_id": PRODUCT_ID,
            "device_name": device_name,
            "properties": {
                "device_status": {
                    "value": "online",
                    "time": int(datetime.now().timestamp() * 1000)
                }
            }
        }

        log(f"发送设备状态数据: {url}")
        log(f"状态数据: {status_data}")

        response = requests.post(url, json=status_data, headers=headers)

        log(f"设备状态上传响应状态码: {response.status_code}")
        log(f"设备状态上传响应内容: {response.text}")

        if response.status_code in [200, 201]:
            try:
                response_data = response.json()
                if response_data.get("code") == 0:
                    log(f"设备状态上传成功: {response_data}")
                    return {
                        "success": True,
                        "message": "设备状态上传成功",
                        "response_data": response_data
                    }
                else:
                    return {
                        "success": False,
                        "error": f"设备状态上传失败: {response_data.get('msg', '未知错误')}"
                    }
            except:
                return {
                    "success": True,
                    "message": "设备状态上传成功",
                    "response_text": response.text
                }
        else:
            return {
                "success": False,
                "error": f"设备状态上传失败，状态码: {response.status_code}, 响应: {response.text}"
            }

    except Exception as e:
        error_msg = f"发送设备状态数据出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def send_initial_rainfall_data(device_name, datastream_id, token):
    """发送初始雨量数据，模拟设备首次数据上传"""
    try:
        # 使用物模型属性上报API发送雨量数据
        url = f"{ONENET_API_BASE}/thingmodel/property-post"

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 构建雨量数据（使用物模型格式）
        rainfall_data = {
            "product_id": PRODUCT_ID,
            "device_name": device_name,
            "properties": {
                datastream_id: {
                    "value": 0.0,  # 初始雨量值为0
                    "time": int(datetime.now().timestamp() * 1000)
                }
            }
        }

        log(f"发送初始雨量数据: {url}")
        log(f"雨量数据: {rainfall_data}")

        response = requests.post(url, json=rainfall_data, headers=headers)

        log(f"雨量数据上传响应状态码: {response.status_code}")
        log(f"雨量数据上传响应内容: {response.text}")

        if response.status_code in [200, 201]:
            try:
                response_data = response.json()
                if response_data.get("code") == 0:
                    log(f"雨量数据上传成功: {response_data}")
                    return {
                        "success": True,
                        "message": "雨量数据上传成功",
                        "response_data": response_data
                    }
                else:
                    return {
                        "success": False,
                        "error": f"雨量数据上传失败: {response_data.get('msg', '未知错误')}"
                    }
            except:
                return {
                    "success": True,
                    "message": "雨量数据上传成功",
                    "response_text": response.text
                }
        else:
            return {
                "success": False,
                "error": f"雨量数据上传失败，状态码: {response.status_code}, 响应: {response.text}"
            }

    except Exception as e:
        error_msg = f"发送初始雨量数据出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def check_device_activation_status(device_name, token):
    """检查设备激活状态"""
    try:
        # 使用设备列表API查询设备信息，检查activate_time是否已更新
        url = f"{ONENET_API_BASE}/device/list"

        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        params = {
            "product_id": PRODUCT_ID,
            "limit": 100
        }

        log(f"检查设备激活状态: {url}")
        log(f"查询参数: {params}")

        response = requests.get(url, params=params, headers=headers)

        log(f"设备状态查询响应状态码: {response.status_code}")
        log(f"设备状态查询响应内容: {response.text}")

        if response.status_code == 200:
            try:
                response_data = response.json()
                if response_data.get("code") == 0:
                    devices = response_data.get("data", {}).get("list", [])

                    # 查找目标设备
                    target_device = None
                    for device in devices:
                        if device.get("name") == device_name:
                            target_device = device
                            break

                    if target_device:
                        activate_time = target_device.get("activate_time")
                        last_time = target_device.get("last_time")

                        # 详细记录设备信息用于诊断
                        log(f"设备详细信息: {json.dumps(target_device, ensure_ascii=False, indent=2)}")
                        log(f"原始activate_time: '{activate_time}' (类型: {type(activate_time)})")
                        log(f"原始last_time: '{last_time}' (类型: {type(last_time)})")

                        # 检查是否已激活（activate_time不为默认值）
                        # 更宽松的激活状态判断逻辑
                        default_time_patterns = [
                            "0001-01-01T08:05:43+08:05",
                            "0001-01-01T00:00:00Z",
                            "1970-01-01T00:00:00Z",
                            "",
                            None
                        ]

                        is_activated = (
                            activate_time and
                            activate_time not in default_time_patterns and
                            str(activate_time).strip() != ""
                        )

                        # 额外检查：如果activate_time看起来是有效的时间戳，认为已激活
                        if not is_activated and activate_time:
                            try:
                                # 尝试解析时间，如果能解析且不是默认时间，认为已激活
                                from datetime import datetime
                                parsed_time = datetime.fromisoformat(activate_time.replace('Z', '+00:00'))
                                # 如果时间在2020年之后，认为是有效的激活时间
                                if parsed_time.year >= 2020:
                                    is_activated = True
                                    log(f"通过时间解析判断设备已激活: {parsed_time}")
                            except:
                                pass

                        log(f"设备激活状态检查结果: 已激活={is_activated}, activate_time={activate_time}, last_time={last_time}")

                        return {
                            "success": True,
                            "is_activated": is_activated,
                            "activate_time": activate_time,
                            "last_time": last_time,
                            "device_info": target_device,
                            "message": f"设备激活状态: {'已激活' if is_activated else '未激活'}",
                            "debug_info": {
                                "activate_time_raw": activate_time,
                                "last_time_raw": last_time,
                                "activation_logic": "enhanced_check"
                            }
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"未找到设备 {device_name}"
                        }
                else:
                    return {
                        "success": False,
                        "error": f"查询设备状态失败: {response_data.get('msg', '未知错误')}"
                    }
            except Exception as parse_error:
                log(f"解析设备状态响应失败: {parse_error}")
                return {
                    "success": False,
                    "error": f"解析设备状态响应失败: {parse_error}"
                }
        else:
            return {
                "success": False,
                "error": f"查询设备状态失败，状态码: {response.status_code}, 响应: {response.text}"
            }

    except Exception as e:
        error_msg = f"检查设备激活状态出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def check_device_status_for_user(username):
    """检查用户设备的激活状态"""
    try:
        log(f"检查用户 {username} 的设备状态")

        # 获取用户设备配置
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']

        log(f"检查设备状态: {device_name}")

        # 生成平台级token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 检查设备激活状态
        status_result = check_device_activation_status(device_name, token)

        if status_result.get("success"):
            is_activated = status_result.get("is_activated", False)
            device_info = status_result.get("device_info")

            return {
                "success": True,
                "device_name": device_name,
                "is_activated": is_activated,
                "activate_time": status_result.get("activate_time"),
                "last_time": status_result.get("last_time"),
                "message": f"设备 {device_name} 状态: {'已激活' if is_activated else '未激活'}",
                "device_info": device_info
            }
        else:
            # 即使查询失败，也尝试返回设备基本信息（如果有的话）
            return {
                "success": False,
                "device_name": device_name,
                "is_activated": False,
                "activate_time": None,
                "last_time": None,
                "device_info": None,
                "error": status_result.get("error", "检查设备状态失败")
            }

    except Exception as e:
        error_msg = f"检查设备状态时出错: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return {"success": False, "error": error_msg}

def main():
    """主函数，处理命令行参数并执行相应操作"""
    parser = argparse.ArgumentParser(description='OneNET API工具')
    parser.add_argument('--action', dest='action', choices=['get', 'create_device', 'create_datastream', 'activate_device', 'check_device_status'], help='要执行的操作')
    # 为了兼容旧的位置参数格式，也添加一个位置参数
    parser.add_argument('action_pos', nargs='?', choices=['get', 'create_device', 'create_datastream', 'activate_device', 'check_device_status'], help='要执行的操作（位置参数）')
    parser.add_argument('--username', default='admin', help='用户名')

    args = parser.parse_args()

    # 优先使用位置参数，如果没有则使用选项参数
    action = args.action_pos if args.action_pos else args.action

    if action == 'get':
        result = get_onenet_data(args.username)
        print(json.dumps(result, ensure_ascii=False))
    elif action == 'create_device':
        result = create_device_for_user(args.username)
        print(json.dumps(result, ensure_ascii=False))
    elif action == 'create_datastream':
        # 保留旧的数据流创建功能以便兼容
        result = create_datastream_for_user(args.username)
        print(json.dumps(result, ensure_ascii=False))
    elif action == 'activate_device':
        # 新增：激活设备功能
        result = activate_device_for_user(args.username)
        print(json.dumps(result, ensure_ascii=False))
    elif action == 'check_device_status':
        # 新增：检查设备状态功能
        result = check_device_status_for_user(args.username)
        print(json.dumps(result, ensure_ascii=False))
    else:
        # 默认操作：获取数据
        result = get_onenet_data(args.username)
        print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
