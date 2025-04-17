#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import time
import json
import random
import traceback
import io
from datetime import datetime, timedelta
import argparse
import signal
import threading
from rainfall_db import (
    get_db_connection,
    insert_raw_rainfall,
    get_rainfall_level,
    aggregate_data,
    log
)

# 重新定义log函数，使用英文日志消息
def log(message):
    print(f"LOG: {message}", file=sys.stderr)
    sys.stderr.flush()  # 确保日志立即输出

# 不设置 stdout 编码，使用系统默认编码
# Windows环境下通常是cp936或gbk

# 全局变量
running = True
last_value = 0
last_aggregate_time = datetime.now()

def signal_handler(sig, frame):
    """处理信号，优雅地退出程序"""
    global running
    log("Received exit signal, stopping data collection...")
    running = False

def simulate_rainfall_data():
    """模拟生成雨量数据

    生成的数据将均匀分布在各个雨量级别中：
    - none: < 0.3 mm/h
    - light: 0.3-2.2 mm/h
    - medium: 2.2-4.0 mm/h
    - heavy: 4.0-33 mm/h
    """
    global last_value

    # 随机决定是否生成一个全新的值，而不是基于上一个值的微小变化
    # 这样可以确保各个雨量级别的概率相等
    if random.random() < 0.3:  # 30%的概率生成全新的值
        # 随机选择一个雨量级别，概率相等
        rain_type = random.choice(['none', 'light', 'medium', 'heavy'])

        # 根据选择的级别生成对应范围内的随机值
        if rain_type == 'none':
            last_value = random.uniform(0, 0.29)
        elif rain_type == 'light':
            last_value = random.uniform(0.3, 2.2)
        elif rain_type == 'medium':
            last_value = random.uniform(2.21, 4.0)
        else:  # heavy
            last_value = random.uniform(4.01, 33.0)
    else:
        # 70%的概率保持微小变化，以确保数据的连续性
        change = (random.random() * 4 - 2) * 0.1
        last_value = max(0, min(33, last_value + change))

    # 计算雨量值，保留一位小数
    rainfall_value = round(last_value, 1)

    # 获取雨量级别和百分比
    level, percentage = get_rainfall_level(rainfall_value)

    # 记录日志，方便调试
    log(f"Generated rainfall data: {rainfall_value} mm/h, level: {level}, percentage: {percentage}%")

    return {
        "timestamp": datetime.now(),
        "rainfall_value": rainfall_value,
        "rainfall_level": level,
        "rainfall_percentage": percentage
    }

def collect_real_data():
    """从硬件设备采集真实数据

    这里需要根据实际硬件接口实现
    """
    # TODO: 实现真实硬件数据采集
    # 暂时使用模拟数据代替
    return simulate_rainfall_data()

def periodic_aggregation(username='admin'):
    """定期执行数据聚合

    参数:
        username: 用户名，默认为'admin'
    """
    global last_aggregate_time, running

    log(f"Starting periodic aggregation thread for user: {username}")

    while running:
        now = datetime.now()
        # 每10分钟执行一次聚合
        if (now - last_aggregate_time).total_seconds() >= 600:
            log(f"Performing periodic data aggregation for user {username}, last time: {last_aggregate_time}")
            try:
                aggregate_data(username)
                last_aggregate_time = now
                log(f"Data aggregation completed for user: {username}")
            except Exception as e:
                log(f"Data aggregation failed for user {username}: {str(e)}")
                log(traceback.format_exc())

        # 休眠一分钟
        time.sleep(60)

def start_collection(username='admin', interval=5, use_real_data=False, verbose=False):
    """开始数据采集

    参数:
        username: 用户名，默认为'admin'
        interval: 采集间隔，单位为秒
        use_real_data: 是否使用真实数据，如果为False则使用模拟数据
        verbose: 是否输出详细日志
    """
    global running, last_aggregate_time

    # 详细输出用户名信息
    log(f"开始数据采集，原始用户名: '{username}', 类型: {type(username)}")

    # 检查用户名是否包含特殊字符
    if username:
        log(f"用户名长度: {len(username)}")
        for i, char in enumerate(username):
            log(f"字符 {i}: '{char}', 编码: {ord(char)}")

    # 强制使用传入的用户名，不再使用默认值
    if not username or username.strip() == '':
        log("用户名不能为空，使用默认用户名: admin")
        username = 'admin'
    else:
        username = username.strip()
        log(f"强制使用传入的用户名: '{username}', 长度: {len(username)}")

    # 注册信号处理函数
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    log(f"Starting {'real' if use_real_data else 'simulated'} data collection for user: {username}, interval: {interval} seconds")

    # 启动定期聚合线程
    aggregation_thread = threading.Thread(target=lambda: periodic_aggregation(username))
    aggregation_thread.daemon = True
    aggregation_thread.start()

    try:
        while running:
            # 采集数据
            if use_real_data:
                data = collect_real_data()
            else:
                data = simulate_rainfall_data()

            # 插入数据库
            result = insert_raw_rainfall(
                username,
                data["timestamp"],
                data["rainfall_value"],
                data["rainfall_level"],
                data["rainfall_percentage"]
            )

            if verbose:
                log(f"Collected data: {data['rainfall_value']} mm/h ({data['rainfall_level']}, {data['rainfall_percentage']}%), user: {username}")
                if not result["success"]:
                    log(f"Data insertion failed: {result['error']}")

            # 等待下一次采集
            time.sleep(interval)
    except Exception as e:
        log(f"Error during data collection: {str(e)}")
        log(traceback.format_exc())
    finally:
        log(f"Data collection stopped for user: {username}")
        # 确保最后执行一次聚合，传递正确的用户名
        try:
            log(f"Performing final data aggregation for user: {username}")
            aggregate_data(username)
        except Exception as e:
            log(f"Final data aggregation failed for user {username}: {str(e)}")

def collect_single_data(username='admin', use_real_data=False):
    """采集单次数据并返回

    参数:
        username: 用户名，默认为'admin'
        use_real_data: 是否使用真实数据，如果为False则使用模拟数据
    """
    # 详细输出用户名信息
    log(f"采集单次数据，原始用户名: '{username}', 类型: {type(username)}")

    # 检查用户名是否包含特殊字符
    if username:
        log(f"用户名长度: {len(username)}")
        for i, char in enumerate(username):
            log(f"字符 {i}: '{char}', 编码: {ord(char)}")

    # 强制使用传入的用户名，不再使用默认值
    if not username or username.strip() == '':
        log("用户名不能为空，使用默认用户名: admin")
        username = 'admin'
    else:
        username = username.strip()
        log(f"强制使用传入的用户名: '{username}', 长度: {len(username)}")

    log(f"Collecting single data point for user: {username}")
    try:
        # 采集数据
        if use_real_data:
            data = collect_real_data()
        else:
            data = simulate_rainfall_data()

        log(f"Generated data: {data['rainfall_value']} mm/h ({data['rainfall_level']}, {data['rainfall_percentage']}%) for user: {username}")

        # 插入数据库
        result = insert_raw_rainfall(
            username,
            data["timestamp"],
            data["rainfall_value"],
            data["rainfall_level"],
            data["rainfall_percentage"]
        )

        if result["success"]:
            log(f"Successfully inserted data for user: {username}")
            return {
                "success": True,
                "data": {
                    "timestamp": data["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                    "rainfall_value": data["rainfall_value"],
                    "rainfall_level": data["rainfall_level"],
                    "rainfall_percentage": data["rainfall_percentage"],
                    "username": username  # 添加用户名到返回数据中
                }
            }
        else:
            log(f"Failed to insert data for user: {username}, error: {result['error']}")
            return {"success": False, "error": result["error"]}
    except Exception as e:
        log(f"Single data collection failed for user {username}: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='雨量数据采集')
    parser.add_argument('--action', choices=['start', 'single'],
                        required=True, help='执行的操作')
    parser.add_argument('--username', type=str, default='admin',
                        help='用户名，默认为admin')
    parser.add_argument('--interval', type=int, default=5,
                        help='数据采集间隔，单位为秒')
    parser.add_argument('--real', action='store_true',
                        help='使用真实数据，默认使用模拟数据')
    parser.add_argument('--verbose', action='store_true',
                        help='输出详细日志')

    args = parser.parse_args()

    try:
        # 确保用户名不为空
        username = args.username
        log(f"原始命令行参数中的用户名: '{username}', 类型: {type(username)}")

        # 检查用户名是否包含特殊字符
        if username:
            log(f"用户名长度: {len(username)}")
            for i, char in enumerate(username):
                log(f"字符 {i}: '{char}', 编码: {ord(char)}")

        # 强制使用传入的用户名，不再使用默认值
        if not username or username.strip() == '':
            log("命令行参数中的用户名不能为空，使用默认用户名: admin")
            username = 'admin'
        else:
            username = username.strip()
            log(f"强制使用传入的用户名: '{username}', 长度: {len(username)}")

        if args.action == 'start':
            log(f"开始数据采集，用户名: {username}")
            start_collection(username, args.interval, args.real, args.verbose)
        elif args.action == 'single':
            log(f"采集单次数据，用户名: {username}")
            result = collect_single_data(username, args.real)
            print(json.dumps(result, ensure_ascii=False, default=str))
            sys.stdout.flush()
        else:
            print(json.dumps({"success": False, "error": "未知操作"}, ensure_ascii=False))
            sys.stdout.flush()
    except Exception as e:
        log(f"脚本执行错误: {str(e)}")
        log(traceback.format_exc())
        error_result = {"success": False, "error": f"脚本执行错误: {str(e)}"}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
