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
import os

# 添加当前目录到sys.path，确保能够导入rainfall_db模块
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# 定义日志函数，以防rainfall_db导入失败
def log(message):
    print(f"LOG: {message}", file=sys.stderr)
    sys.stderr.flush()  # 确保日志立即输出

try:
    from rainfall_db import get_rainfall_level
    log("成功导入rainfall_db模块")
except ImportError as e:
    log(f"导入rainfall_db模块失败: {str(e)}")
    log(f"当前目录: {current_dir}")
    log(f"sys.path: {sys.path}")

    # 定义一个简单的get_rainfall_level函数，以防导入失败
    def get_rainfall_level(value):
        """根据雨量值获取雨量级别"""
        if value < 0.3:
            percentage = round(min(value, 0.3) * 25 / 0.3)
            return 'none', percentage
        elif value >= 0.3 and value <= 2.2:
            percentage = round(26 + (value - 0.3) * (50 - 26) / (2.2 - 0.3))
            return 'light', percentage
        elif value > 2.2 and value <= 4.0:
            percentage = round(51 + (value - 2.2) * (75 - 51) / (4.0 - 2.2))
            return 'medium', percentage
        else:
            percentage = round(76 + (min(value, 33) - 4.0) * (100 - 76) / (33 - 4.0))
            return 'heavy', percentage

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

def fetch_raw_data(period='10min'):
    """从OneNET平台获取原始雨量数据

    参数:
        period: 时间粒度，可选值：10min, hourly, daily, all

    返回:
        list: 包含原始数据点的列表
    """
    try:
        log(f"从OneNET平台获取{period}原始雨量数据")

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
            "device_name": DEVICE_NAME,
            "identifier": DATASTREAM_ID,  # 数据流ID
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

                # 方式3: 在datastreams结构中查找
                elif "datastreams" in data and isinstance(data["datastreams"], list):
                    # 查找rain_info数据流
                    for stream in data["datastreams"]:
                        if stream.get("id") == DATASTREAM_ID and "datapoints" in stream:
                            datapoints = stream["datapoints"]
                            log(f"使用方式3解析数据点，找到 {len(datapoints)} 个数据点")
                            break

                # 方式4: 在devices结构中查找
                elif "devices" in data and len(data["devices"]) > 0:
                    device = data["devices"][0]

                    # 检查是否有数据流
                    if "datastreams" in device and len(device["datastreams"]) > 0:
                        # 查找rain_info数据流
                        for stream in device["datastreams"]:
                            if stream.get("id") == DATASTREAM_ID and "datapoints" in stream:
                                datapoints = stream["datapoints"]
                                log(f"使用方式4解析数据点，找到 {len(datapoints)} 个数据点")
                                break

                # 如果找到了数据点
                if datapoints:
                    return {"success": True, "datapoints": datapoints}
                else:
                    error_msg = "未找到任何数据点"
                    log(error_msg)
                    return {"success": False, "error": error_msg}
            else:
                error_msg = f"OneNET API返回错误: {response_data.get('msg')}"
                log(error_msg)
                return {"success": False, "error": error_msg}
        else:
            error_msg = f"OneNET API请求失败，状态码: {response.status_code}"
            log(error_msg)
            return {"success": False, "error": error_msg}
    except Exception as e:
        error_msg = f"获取OneNET原始数据错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return {"success": False, "error": error_msg}

def aggregate_data(raw_data, period='10min'):
    """聚合原始数据

    参数:
        raw_data: 原始数据点列表
        period: 时间粒度，可选值：10min, hourly, daily, all

    返回:
        list: 聚合后的数据点列表
    """
    try:
        log(f"开始聚合{period}数据，原始数据点数量: {len(raw_data)}")

        # 如果没有原始数据，返回空列表
        if not raw_data:
            return []

        # 根据不同的时间粒度进行聚合
        if period == '10min':
            # 10分钟内数据，按分钟聚合
            return aggregate_by_minute(raw_data)
        elif period == 'hourly':
            # 1小时内数据，按5分钟聚合
            return aggregate_by_5minutes(raw_data)
        elif period == 'daily':
            # 24小时内数据，按小时聚合
            return aggregate_by_hour(raw_data)
        elif period == 'all':
            # 30天内数据，按天聚合
            return aggregate_by_day(raw_data)
        else:
            log(f"不支持的时间粒度: {period}")
            return []
    except Exception as e:
        error_msg = f"聚合数据错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return []

def aggregate_by_minute(raw_data):
    """按分钟聚合数据

    参数:
        raw_data: 原始数据点列表

    返回:
        list: 聚合后的数据点列表
    """
    try:
        # 创建一个字典，用于存储每分钟的数据点
        minute_data = {}

        for point in raw_data:
            # 获取时间戳和值
            timestamp_str = point.get("at")
            rainfall_value = float(point.get("value", 0))

            # 解析时间戳
            try:
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                except ValueError:
                    try:
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
                    except ValueError:
                        try:
                            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
                        except ValueError:
                            log(f"无法解析时间戳: {timestamp_str}")
                            continue  # 跳过无法解析的时间戳

            # 将时间戳精确到分钟
            minute_key = timestamp.strftime("%Y-%m-%d %H:%M:00")

            # 将数据点添加到对应的分钟
            if minute_key not in minute_data:
                minute_data[minute_key] = []
            minute_data[minute_key].append(rainfall_value)

        # 计算每分钟的平均值
        aggregated_data = []
        for minute_key, values in sorted(minute_data.items()):
            avg_value = sum(values) / len(values)
            level, percentage = get_rainfall_level(avg_value)

            # 确保雨量值保留一位小数
            avg_value = round(avg_value, 1)

            aggregated_data.append({
                'value': [minute_key, avg_value],
                'rainfall_level': level,
                'rainfall_percentage': percentage,
                'unit': 'mm/h'  # 明确标记单位
            })

        log(f"按分钟聚合完成，聚合后数据点数量: {len(aggregated_data)}")

        # 如果没有聚合数据，但有原始数据，则使用原始数据创建聚合数据
        if not aggregated_data and raw_data:
            log("没有聚合数据，使用原始数据创建聚合数据")
            # 按时间戳排序
            sorted_data = sorted(raw_data, key=lambda x: x.get("at_timestamp", 0))

            for point in sorted_data:
                timestamp_str = point.get("at")
                rainfall_value = float(point.get("value", 0))
                level, percentage = get_rainfall_level(rainfall_value)

                # 确保雨量值保留一位小数
                rainfall_value = round(rainfall_value, 1)

                aggregated_data.append({
                    'value': [timestamp_str, rainfall_value],
                    'rainfall_level': level,
                    'rainfall_percentage': percentage,
                    'unit': 'mm/h'  # 明确标记单位
                })

            log(f"使用原始数据创建的聚合数据点数量: {len(aggregated_data)}")

        return aggregated_data
    except Exception as e:
        error_msg = f"按分钟聚合数据错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return []

def aggregate_by_5minutes(raw_data):
    """按5分钟聚合数据

    参数:
        raw_data: 原始数据点列表

    返回:
        list: 聚合后的数据点列表
    """
    try:
        # 创建一个字典，用于存储每5分钟的数据点
        five_minute_data = {}

        for point in raw_data:
            # 获取时间戳和值
            timestamp_str = point.get("at")
            rainfall_value = float(point.get("value", 0))

            # 解析时间戳
            try:
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                except ValueError:
                    try:
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
                    except ValueError:
                        try:
                            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
                        except ValueError:
                            log(f"无法解析时间戳: {timestamp_str}")
                            continue  # 跳过无法解析的时间戳

            # 将分钟调整为5的倍数
            minute = timestamp.minute
            adjusted_minute = (minute // 5) * 5
            adjusted_timestamp = timestamp.replace(minute=adjusted_minute, second=0, microsecond=0)
            five_minute_key = adjusted_timestamp.strftime("%Y-%m-%d %H:%M:00")

            # 将数据点添加到对应的5分钟
            if five_minute_key not in five_minute_data:
                five_minute_data[five_minute_key] = []
            five_minute_data[five_minute_key].append(rainfall_value)

        # 计算每5分钟的平均值
        aggregated_data = []
        for five_minute_key, values in sorted(five_minute_data.items()):
            avg_value = sum(values) / len(values)
            level, percentage = get_rainfall_level(avg_value)

            # 确保雨量值保留一位小数
            avg_value = round(avg_value, 1)

            aggregated_data.append({
                'value': [five_minute_key, avg_value],
                'rainfall_level': level,
                'rainfall_percentage': percentage,
                'unit': 'mm/h'  # 明确标记单位
            })

        log(f"按5分钟聚合完成，聚合后数据点数量: {len(aggregated_data)}")

        # 如果没有聚合数据，但有原始数据，则使用原始数据创建聚合数据
        if not aggregated_data and raw_data:
            log("没有聚合数据，使用原始数据创建聚合数据")
            # 按时间戳排序
            sorted_data = sorted(raw_data, key=lambda x: x.get("at_timestamp", 0))

            for point in sorted_data:
                timestamp_str = point.get("at")
                rainfall_value = float(point.get("value", 0))
                level, percentage = get_rainfall_level(rainfall_value)

                # 确保雨量值保留一位小数
                rainfall_value = round(rainfall_value, 1)

                aggregated_data.append({
                    'value': [timestamp_str, rainfall_value],
                    'rainfall_level': level,
                    'rainfall_percentage': percentage,
                    'unit': 'mm/h'  # 明确标记单位
                })

            log(f"使用原始数据创建的聚合数据点数量: {len(aggregated_data)}")

        return aggregated_data
    except Exception as e:
        error_msg = f"按5分钟聚合数据错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return []

def aggregate_by_hour(raw_data):
    """按小时聚合数据

    参数:
        raw_data: 原始数据点列表

    返回:
        list: 聚合后的数据点列表
    """
    try:
        # 创建一个字典，用于存储每小时的数据点
        hour_data = {}

        for point in raw_data:
            # 获取时间戳和值
            timestamp_str = point.get("at")
            rainfall_value = float(point.get("value", 0))

            # 解析时间戳
            try:
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                except ValueError:
                    try:
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
                    except ValueError:
                        try:
                            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
                        except ValueError:
                            log(f"无法解析时间戳: {timestamp_str}")
                            continue  # 跳过无法解析的时间戳

            # 将时间戳精确到小时
            hour_key = timestamp.strftime("%Y-%m-%d %H:00:00")

            # 将数据点添加到对应的小时
            if hour_key not in hour_data:
                hour_data[hour_key] = []
            hour_data[hour_key].append(rainfall_value)

        # 计算每小时的平均值
        aggregated_data = []
        for hour_key, values in sorted(hour_data.items()):
            avg_value = sum(values) / len(values)
            level, percentage = get_rainfall_level(avg_value)

            # 确保雨量值保留一位小数
            avg_value = round(avg_value, 1)

            aggregated_data.append({
                'value': [hour_key, avg_value],
                'rainfall_level': level,
                'rainfall_percentage': percentage,
                'unit': 'mm/h'  # 明确标记单位
            })

        log(f"按小时聚合完成，聚合后数据点数量: {len(aggregated_data)}")

        # 如果没有聚合数据，但有原始数据，则使用原始数据创建聚合数据
        if not aggregated_data and raw_data:
            log("没有聚合数据，使用原始数据创建聚合数据")
            # 按时间戳排序
            sorted_data = sorted(raw_data, key=lambda x: x.get("at_timestamp", 0))

            for point in sorted_data:
                timestamp_str = point.get("at")
                rainfall_value = float(point.get("value", 0))
                level, percentage = get_rainfall_level(rainfall_value)

                # 确保雨量值保留一位小数
                rainfall_value = round(rainfall_value, 1)

                aggregated_data.append({
                    'value': [timestamp_str, rainfall_value],
                    'rainfall_level': level,
                    'rainfall_percentage': percentage,
                    'unit': 'mm/h'  # 明确标记单位
                })

            log(f"使用原始数据创建的聚合数据点数量: {len(aggregated_data)}")

        return aggregated_data
    except Exception as e:
        error_msg = f"按小时聚合数据错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return []

def aggregate_by_day(raw_data):
    """按天聚合数据

    参数:
        raw_data: 原始数据点列表

    返回:
        list: 聚合后的数据点列表
    """
    try:
        # 创建一个字典，用于存储每天的数据点
        day_data = {}

        for point in raw_data:
            # 获取时间戳和值
            timestamp_str = point.get("at")
            rainfall_value = float(point.get("value", 0))

            # 解析时间戳
            try:
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                except ValueError:
                    try:
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
                    except ValueError:
                        try:
                            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
                        except ValueError:
                            log(f"无法解析时间戳: {timestamp_str}")
                            continue  # 跳过无法解析的时间戳

            # 将时间戳精确到天
            day_key = timestamp.strftime("%Y-%m-%d")

            # 将数据点添加到对应的天
            if day_key not in day_data:
                day_data[day_key] = []
            day_data[day_key].append(rainfall_value)

        # 计算每天的平均值
        aggregated_data = []
        for day_key, values in sorted(day_data.items()):
            avg_value = sum(values) / len(values)

            # 添加雨量级别和百分比，与其他时间粒度保持一致
            level, percentage = get_rainfall_level(avg_value)

            # 确保雨量值保留一位小数
            avg_value = round(avg_value, 1)

            aggregated_data.append({
                'value': [day_key, avg_value],
                'rainfall_level': level,
                'rainfall_percentage': percentage,
                'unit': 'mm/天'  # 明确标记单位为mm/天
            })

        log(f"按天聚合完成，聚合后数据点数量: {len(aggregated_data)}")

        # 如果没有聚合数据，但有原始数据，则使用原始数据创建聚合数据
        if not aggregated_data and raw_data:
            log("没有聚合数据，使用原始数据创建聚合数据")
            # 按时间戳排序
            sorted_data = sorted(raw_data, key=lambda x: x.get("at_timestamp", 0))

            # 获取唯一的日期
            unique_days = set()
            day_values = {}

            for point in sorted_data:
                timestamp_str = point.get("at")
                rainfall_value = float(point.get("value", 0))

                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    try:
                        timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                    except ValueError:
                        try:
                            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
                        except ValueError:
                            try:
                                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
                            except ValueError:
                                continue

                day_key = timestamp.strftime("%Y-%m-%d")
                unique_days.add(day_key)

                if day_key not in day_values:
                    day_values[day_key] = []
                day_values[day_key].append(rainfall_value)

            # 计算每天的平均值
            for day_key in sorted(unique_days):
                values = day_values[day_key]
                avg_value = sum(values) / len(values)

                # 添加雨量级别和百分比，与其他时间粒度保持一致
                level, percentage = get_rainfall_level(avg_value)

                # 确保雨量值保留一位小数
                avg_value = round(avg_value, 1)

                aggregated_data.append({
                    'value': [day_key, avg_value],
                    'rainfall_level': level,
                    'rainfall_percentage': percentage,
                    'unit': 'mm/天'  # 明确标记单位为mm/天
                })

            log(f"使用原始数据创建的聚合数据点数量: {len(aggregated_data)}")

        return aggregated_data
    except Exception as e:
        error_msg = f"按天聚合数据错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return []

def calculate_current_hour_data(aggregated_data, period):
    """计算当前小时数据

    参数:
        aggregated_data: 聚合后的数据点列表
        period: 时间粒度，可选值：10min, hourly, daily, all

    返回:
        dict: 当前小时数据
    """
    try:
        # 只对10min和hourly有效
        if period not in ['10min', 'hourly'] or not aggregated_data:
            return None

        # 获取当前时间
        now = datetime.now()
        current_hour_start = now.replace(minute=0, second=0, microsecond=0)

        # 筛选当前小时的数据点
        current_hour_data_points = []
        for point in aggregated_data:
            try:
                point_time = datetime.strptime(point['value'][0], "%Y-%m-%d %H:%M:%S")
                if point_time >= current_hour_start:
                    current_hour_data_points.append(point)
            except ValueError:
                continue

        if not current_hour_data_points:
            return None

        # 计算当前小时的平均雨量
        avg_rainfall = sum(point['value'][1] for point in current_hour_data_points) / len(current_hour_data_points)

        # 计算已过去的时间比例
        minutes_passed = now.minute + (now.second / 60)
        hour_ratio = minutes_passed / 60

        # 估算累计雨量
        total_rainfall = round(avg_rainfall * hour_ratio * 60, 1)

        return {
            'hour': now.hour,
            'avg_rainfall': round(avg_rainfall, 1),
            'total_rainfall': total_rainfall,
            'data_points': len(current_hour_data_points),
            'minutes_passed': round(minutes_passed, 1)
        }
    except Exception as e:
        error_msg = f"计算当前小时数据错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return None

def get_aggregated_data(period='10min'):
    """获取聚合后的数据

    参数:
        period: 时间粒度，可选值：10min, hourly, daily, all

    返回:
        dict: 包含聚合后数据的字典
    """
    try:
        # 获取原始数据
        raw_data_result = fetch_raw_data(period)

        if not raw_data_result['success']:
            return {
                'success': False,
                'error': raw_data_result['error']
            }

        # 获取原始数据点
        raw_datapoints = raw_data_result['datapoints']

        if not raw_datapoints:
            return {
                'success': False,
                'error': '未找到任何数据点'
            }

        # 聚合数据
        aggregated_data = aggregate_data(raw_datapoints, period)

        if not aggregated_data:
            return {
                'success': False,
                'error': f'聚合{period}数据失败'
            }

        # 计算当前小时数据
        current_hour_data = calculate_current_hour_data(aggregated_data, period)

        # 构建返回结果
        result = {
            'success': True,
            'data': aggregated_data,
            'unit': 'mm/天' if period == 'all' else 'mm/h'  # 根据时间粒度设置单位
        }

        if current_hour_data:
            result['currentHour'] = current_hour_data

        return result
    except Exception as e:
        error_msg = f"获取聚合数据错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return {
            'success': False,
            'error': error_msg
        }

def main():
    """主函数"""
    try:
        # 解析命令行参数
        parser = argparse.ArgumentParser(description='OneNET数据聚合工具')
        parser.add_argument('--period', type=str, default='10min', choices=['10min', 'hourly', 'daily', 'all'],
                            help='时间粒度，可选值：10min, hourly, daily, all')
        args = parser.parse_args()

        # 获取聚合后的数据
        result = get_aggregated_data(args.period)

        # 输出结果
        print(json.dumps(result, ensure_ascii=False))

        # 返回状态码
        return 0 if result['success'] else 1
    except Exception as e:
        error_msg = f"主函数错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        print(json.dumps({
            'success': False,
            'error': error_msg
        }, ensure_ascii=False))
        return 1

if __name__ == '__main__':
    sys.exit(main())
