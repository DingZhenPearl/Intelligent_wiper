#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import json
import traceback
import requests
import base64
import hmac
import time
import argparse
import threading
from datetime import datetime, timedelta
from urllib.parse import quote
from rainfall_db import log, get_rainfall_level, insert_raw_rainfall, get_db_connection

# 导入OneNET API配置
from onenet_api import (
    ONENET_API_BASE,
    PRODUCT_ID,
    DEVICE_NAME,
    DATASTREAM_ID,
    ACCESS_KEY,
    generate_token
)

# 全局变量
running = True
last_sync_time = datetime.now()

def fetch_latest_onenet_data(last_timestamp=None):
    """从OneNET平台获取最新的原始数据

    参数:
        last_timestamp: 上次同步的最后时间戳，用于只获取新数据

    返回:
        dict: 包含原始数据点的字典
    """
    try:
        log("从OneNET平台获取最新原始数据")

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

        # 设置时间范围
        now = datetime.now()

        # 如果提供了上次同步时间，则只获取该时间之后的数据
        # 否则获取过去10分钟的数据
        if last_timestamp:
            start_time = last_timestamp
        else:
            start_time = now - timedelta(minutes=10)

        # 设置请求参数
        params = {
            "product_id": PRODUCT_ID,
            "device_name": DEVICE_NAME,
            "identifier": DATASTREAM_ID,  # 数据流ID
            "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "end_time": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "limit": 100  # 最多获取100个数据点
        }

        log(f"请求OneNET API: {url}, 参数: {params}")

        # 发送GET请求
        response = requests.get(url, params=params, headers=headers)

        # 检查响应状态码
        if response.status_code == 200:
            # 解析响应数据
            response_data = response.json()

            log(f"OneNET API响应: {response_data}")

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

def get_last_sync_timestamp(username='admin'):
    """获取上次同步的最后时间戳

    参数:
        username: 用户名，默认为'admin'

    返回:
        datetime: 上次同步的最后时间戳，如果没有则返回None
    """
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # 获取最后一条记录的时间戳
            sql = '''
                SELECT timestamp FROM rainfall_raw
                WHERE username = %s
                ORDER BY timestamp DESC
                LIMIT 1
            '''
            cursor.execute(sql, (username,))
            result = cursor.fetchone()

            if result:
                return result['timestamp']
            return None
    except Exception as e:
        log(f"获取上次同步时间戳失败: {str(e)}")
        return None
    finally:
        conn.close()

def check_data_exists(username, timestamp, rainfall_value):
    """检查特定时间戳和雨量值的数据点是否已存在

    参数:
        username: 用户名
        timestamp: 时间戳
        rainfall_value: 雨量值

    返回:
        bool: 如果数据点已存在则返回True，否则返回False
    """
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # 查询是否存在相同时间戳和雨量值的数据点
            # 使用时间戳的精确匹配和雨量值的近似匹配（考虑浮点数精度问题）
            sql = '''
                SELECT COUNT(*) as count FROM rainfall_raw
                WHERE username = %s
                AND timestamp = %s
                AND ABS(rainfall_value - %s) < 0.01
            '''
            cursor.execute(sql, (username, timestamp, rainfall_value))
            result = cursor.fetchone()

            # 如果count大于0，说明数据点已存在
            exists = result and result['count'] > 0

            if exists:
                log(f"数据点已存在: 用户名={username}, 时间戳={timestamp}, 雨量值={rainfall_value}")

            return exists
    except Exception as e:
        log(f"检查数据点是否存在失败: {str(e)}")
        # 如果查询失败，为安全起见，假设数据点不存在
        return False
    finally:
        conn.close()

def sync_onenet_data(username='admin'):
    """同步OneNET数据到本地数据库

    参数:
        username: 用户名，默认为'admin'

    返回:
        dict: 包含同步结果的字典
    """
    try:
        # 获取上次同步的最后时间戳
        last_timestamp = get_last_sync_timestamp(username)
        log(f"上次同步时间戳: {last_timestamp}")

        # 获取最新数据
        result = fetch_latest_onenet_data(last_timestamp)

        if not result['success']:
            return result

        datapoints = result['datapoints']

        if not datapoints:
            return {"success": True, "message": "没有新数据需要同步", "synced_count": 0}

        # 同步数据到本地数据库
        synced_count = 0
        skipped_count = 0
        for point in datapoints:
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

            # 检查数据点是否已存在
            if check_data_exists(username, timestamp, rainfall_value):
                log(f"跳过已存在的数据点: 时间戳={timestamp}, 雨量值={rainfall_value}")
                skipped_count += 1
                continue

            # 获取雨量级别和百分比
            rainfall_level, rainfall_percentage = get_rainfall_level(rainfall_value)

            # 插入数据库
            insert_result = insert_raw_rainfall(
                username,
                timestamp,
                rainfall_value,
                rainfall_level,
                rainfall_percentage
            )

            if insert_result['success']:
                synced_count += 1
                log(f"成功插入新数据点: 时间戳={timestamp}, 雨量值={rainfall_value}")
            else:
                log(f"插入数据失败: {insert_result['error']}")

        return {
            "success": True,
            "message": f"成功同步 {synced_count} 条数据，跳过 {skipped_count} 条重复数据",
            "synced_count": synced_count,
            "skipped_count": skipped_count
        }
    except Exception as e:
        error_msg = f"同步OneNET数据错误: {str(e)}"
        log(error_msg)
        log(traceback.format_exc())
        return {"success": False, "error": error_msg}

def periodic_sync(username='admin', interval=5):
    """定期同步OneNET数据

    参数:
        username: 用户名，默认为'admin'
        interval: 同步间隔，单位为秒，默认为5秒
    """
    global running, last_sync_time

    log(f"启动定期同步线程，用户名: {username}，间隔: {interval}秒")

    while running:
        now = datetime.now()
        # 每interval秒执行一次同步
        if (now - last_sync_time).total_seconds() >= interval:
            log(f"执行定期同步，用户名: {username}，上次同步时间: {last_sync_time}")
            try:
                # 执行同步并获取结果
                result = sync_onenet_data(username)
                last_sync_time = now

                # 记录同步结果
                if result["success"]:
                    log(f"数据同步成功，用户名: {username}，消息: {result.get('message', '无消息')}")
                else:
                    log(f"数据同步返回错误，用户名: {username}，错误: {result.get('error', '未知错误')}")
            except Exception as e:
                log(f"数据同步失败，用户名: {username}，错误: {str(e)}")
                log(traceback.format_exc())

        # 休眠1秒，更频繁地检查
        time.sleep(1)

def start_sync(username='admin', interval=5):
    """启动同步服务

    参数:
        username: 用户名，默认为'admin'
        interval: 同步间隔，单位为秒，默认为5秒
    """
    global running

    # 确保running为True
    running = True

    log(f"启动OneNET同步服务，用户名: {username}，间隔: {interval}秒")

    # 创建并启动同步线程
    sync_thread = threading.Thread(target=lambda: periodic_sync(username, interval))
    sync_thread.daemon = True
    sync_thread.start()

    log(f"OneNET同步线程已启动，用户名: {username}")

    try:
        # 保持主线程运行
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        log("收到中断信号，停止同步服务")
        running = False

    log("OneNET同步服务已停止")

def stop_sync():
    """停止同步服务"""
    global running
    running = False
    log("OneNET同步服务停止命令已发送")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='OneNET数据同步工具')
    parser.add_argument('--action', choices=['start', 'stop', 'sync_once'],
                        default='sync_once', help='执行的操作')
    parser.add_argument('--username', default='admin', help='用户名')
    parser.add_argument('--interval', type=int, default=5, help='同步间隔（秒）')

    args = parser.parse_args()

    if args.action == 'start':
        start_sync(args.username, args.interval)
    elif args.action == 'stop':
        stop_sync()
    elif args.action == 'sync_once':
        result = sync_onenet_data(args.username)
        print(json.dumps(result, ensure_ascii=False))
