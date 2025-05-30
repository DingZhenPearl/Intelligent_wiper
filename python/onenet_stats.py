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
from urllib.parse import quote

from rainfall_db import log, get_rainfall_level

# 导入OneNET API配置
from onenet_api import (
    ONENET_API_BASE,
    PRODUCT_ID,
    DEVICE_NAME,
    ACCESS_KEY,
    generate_token,
    get_user_device_config
)



def get_onenet_stats(username='admin', period='10min'):
    """从OneNET平台获取雨量统计数据

    参数:
        username: 用户名，用于确定数据流
        period: 时间粒度，可选值：10min, hourly, daily, all

    返回:
        dict: 包含统计数据的字典
    """
    try:
        log(f"从OneNET平台获取{period}雨量统计数据，用户: {username}")

        # 获取用户设备配置
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        datastream_id = device_config['datastream_id']

        log(f"使用设备: {device_name}, 数据流: {datastream_id}")

        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}

        # 构建API URL
        url = f"{ONENET_API_BASE}/datapoint/history-datapoints"

        # 设置请求头，包含JWT token
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }

        # 根据时间粒度设置不同的参数
        now = datetime.now()

        if period == '10min':
            # 过去10分钟的数据
            start_time = now - timedelta(minutes=10)
        elif period == 'hourly':
            # 过去1小时的数据
            start_time = now - timedelta(hours=1)
        elif period == 'daily':
            # 过去24小时的数据
            start_time = now - timedelta(days=1)
        elif period == 'all':
            # 过去30天的数据
            start_time = now - timedelta(days=30)
        else:
            error_msg = f"不支持的时间粒度: {period}"
            log(error_msg)
            return {"success": False, "error": error_msg}

        # 设置请求参数
        params = {
            "product_id": PRODUCT_ID,
            "device_name": device_name,
            "identifier": datastream_id,  # 用户特定的数据流ID
            "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "end_time": now.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        # 根据时间粒度设置不同的limit参数
        if period == '10min':
            params["limit"] = 120  # 最多获取120个数据点
        elif period == 'hourly':
            params["limit"] = 60  # 最多获取60个数据点
        elif period == 'daily':
            params["limit"] = 288  # 最多获取288个数据点 (24小时 * 12个点/小时)
        elif period == 'all':
            params["limit"] = 720  # 最多获取720个数据点 (30天 * 24个点/天)

        log(f"请求OneNET API: {url}, 参数: {params}")

        # 发送GET请求
        response = requests.get(url, params=params, headers=headers)

        # 检查响应状态码
        if response.status_code == 200:
            # 解析响应数据
            response_data = response.json()

            log(f"OneNET API响应状态码: {response.status_code}")
            log(f"OneNET API响应内容: {response_data}")

            # 检查是否成功获取数据
            if response_data.get("code") == 0 and "data" in response_data:
                data = response_data["data"]

                # 尝试不同的数据结构解析方式
                datapoints = []

                # 方式1: 直接在data中查找datapoints
                if "datapoints" in data and isinstance(data["datapoints"], list):
                    datapoints = data["datapoints"]
                    log(f"使用方式1解析数据点，找到 {len(datapoints)} 个数据点")

                # 方式2: 在data.items中查找
                elif "items" in data and isinstance(data["items"], list):
                    datapoints = data["items"]
                    log(f"使用方式2解析数据点，找到 {len(datapoints)} 个数据点")

                # 方式3: 在devices结构中查找
                elif "devices" in data and len(data["devices"]) > 0:
                    device = data["devices"][0]

                    # 检查是否有数据流
                    if "datastreams" in device and len(device["datastreams"]) > 0:
                        # 查找用户特定的数据流
                        for stream in device["datastreams"]:
                            if stream.get("id") == datastream_id and "datapoints" in stream:
                                datapoints = stream["datapoints"]
                                log(f"使用方式3解析数据点，找到 {len(datapoints)} 个数据点")
                                break

                # 如果找到了数据点
                if datapoints:
                    # 处理数据点
                    processed_data = []

                    for point in datapoints:
                        # 获取时间戳和值
                        timestamp_str = point.get("at")
                        rainfall_value = float(point.get("value", 0))

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

                        # 添加处理后的数据点
                        if period == 'all':
                            # 对于'all'时间粒度，只保留日期部分
                            processed_data.append({
                                'value': [timestamp.strftime("%Y-%m-%d"), rainfall_value],
                                'rainfall_level': level,
                                'rainfall_percentage': percentage,
                                'unit': 'mm/天'  # 日累计雨量单位
                            })
                        else:
                            processed_data.append({
                                'value': [timestamp.strftime("%Y-%m-%d %H:%M:%S"), rainfall_value],
                                'rainfall_level': level,
                                'rainfall_percentage': percentage,
                                'unit': 'mm/h'  # 明确标记单位
                            })

                    # 生成当前小时数据（仅对hourly和10min有效）
                    current_hour_data = None
                    if period in ['10min', 'hourly'] and processed_data:
                        # 计算当前小时的平均雨量
                        current_hour_start = now.replace(minute=0, second=0, microsecond=0)
                        current_hour_data_points = [
                            point for point in processed_data
                            if datetime.strptime(point['value'][0], "%Y-%m-%d %H:%M:%S") >= current_hour_start
                        ]

                        if current_hour_data_points:
                            avg_rainfall = sum(point['value'][1] for point in current_hour_data_points) / len(current_hour_data_points)

                            # 计算已过去的时间比例
                            minutes_passed = now.minute + (now.second / 60)
                            hour_ratio = minutes_passed / 60

                            # 估算累计雨量
                            total_rainfall = round(avg_rainfall * hour_ratio * 60, 1)

                            current_hour_data = {
                                'hour': now.hour,
                                'avg_rainfall': round(avg_rainfall, 1),
                                'total_rainfall': total_rainfall,
                                'data_points': len(current_hour_data_points),
                                'minutes_passed': round(minutes_passed, 1)
                            }

                    # 返回结果
                    result = {
                        'success': True,
                        'data': processed_data,
                        'unit': 'mm/天' if period == 'all' else 'mm/h'
                    }

                    if current_hour_data:
                        result['currentHour'] = current_hour_data

                    return result
                else:
                    error_msg = "未找到任何数据点"
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
        error_msg = f"从OneNET平台获取{period}雨量统计数据失败: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return {"success": False, "error": error_msg}

def main():
    """主函数，处理命令行参数并执行相应操作"""
    parser = argparse.ArgumentParser(description='OneNET统计数据API工具')
    parser.add_argument('--action', dest='action', choices=['stats'], help='要执行的操作')
    # 为了兼容旧的位置参数格式，也添加一个位置参数
    parser.add_argument('action_pos', nargs='?', choices=['stats'], help='要执行的操作（位置参数）')
    parser.add_argument('--username', default='admin', help='用户名')
    parser.add_argument('--period', default='10min', choices=['10min', 'hourly', 'daily', 'all'], help='时间粒度')

    args = parser.parse_args()

    # 优先使用位置参数，如果没有则使用选项参数
    action = args.action_pos if args.action_pos else args.action

    if action == 'stats':
        result = get_onenet_stats(args.username, args.period)
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(json.dumps({"success": False, "error": "不支持的操作"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
