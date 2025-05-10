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

# OneNET平台API配置 - 新版API基地址
ONENET_API_BASE = "https://iot-api.heclouds.com"

# TODO: 【必填】替换为实际的产品ID，在OneNET平台的产品详情页获取
PRODUCT_ID = "66eIb47012"
# TODO: 【必填】替换为实际的设备名称，在OneNET平台的设备列表或设备详情页获取
DEVICE_NAME = "test"
# TODO: 【必填】替换为实际的数据流ID，根据您在OneNET平台上定义的数据流名称
DATASTREAM_ID = "rain_info"            # 雨量数据流ID
# TODO: 【必填】替换为实际的访问密钥(Access Key)，在OneNET平台的产品详情页获取
ACCESS_KEY = "Rk9mVGdrQWE5dzJqWU12bzFsSFFpZWtRZDVWdTFZZlU="



def generate_token():
    """生成OneNET平台的JWT token

    返回:
        str: JWT token字符串
    """
    try:
        # 设置token参数
        version = '2018-10-31'
        res = f"products/{PRODUCT_ID}/devices/{DEVICE_NAME}"
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

        log(f"生成的OneNET token: {token[:30]}...")
        return token
    except Exception as e:
        error_msg = f"生成OneNET token失败: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return None

def get_onenet_data():
    """从OneNET平台获取雨量数据

    返回:
        dict: 包含雨量数据的字典
    """
    try:
        log("从OneNET平台获取雨量数据")

        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 构建API URL，获取最新的数据点
        url = f"{ONENET_API_BASE}/datapoint/current-datapoints"

        # 设置请求参数
        params = {
            "product_id": PRODUCT_ID,
            "device_name": DEVICE_NAME
        }

        # 设置请求头，包含JWT token
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        log(f"请求OneNET API: {url}")

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

                # 方式1: 直接在data中查找DATASTREAM_ID
                if DATASTREAM_ID in data:
                    datapoint = data[DATASTREAM_ID]
                    timestamp_str = datapoint.get("at")
                    rainfall_value = float(datapoint.get("value", 0))
                    log(f"使用方式1解析数据点: {datapoint}")

                # 方式2: 在devices结构中查找
                elif "devices" in data and len(data["devices"]) > 0:
                    device = data["devices"][0]

                    # 检查是否有数据流
                    if "datastreams" in device and len(device["datastreams"]) > 0:
                        # 查找rain_info数据流
                        for stream in device["datastreams"]:
                            if stream.get("id") == DATASTREAM_ID:
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
                    error_msg = f"未找到ID为 {DATASTREAM_ID} 的数据流或数据点"
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

def main():
    """主函数，处理命令行参数并执行相应操作"""
    parser = argparse.ArgumentParser(description='OneNET API工具')
    parser.add_argument('--action', dest='action', choices=['get'], help='要执行的操作')
    # 为了兼容旧的位置参数格式，也添加一个位置参数
    parser.add_argument('action_pos', nargs='?', choices=['get'], help='要执行的操作（位置参数）')

    args = parser.parse_args()

    # 优先使用位置参数，如果没有则使用选项参数
    action = args.action_pos if args.action_pos else args.action

    if action == 'get':
        result = get_onenet_data()
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(json.dumps({"success": False, "error": "不支持的操作"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
