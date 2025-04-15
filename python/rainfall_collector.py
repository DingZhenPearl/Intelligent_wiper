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
    """模拟生成雨量数据"""
    global last_value

    # 生成合理的随机变化
    change = (random.random() * 4 - 2) * 0.1
    last_value = max(0, min(33, last_value + change))

    # 计算雨量值，保留一位小数
    rainfall_value = round(last_value, 1)

    # 获取雨量级别和百分比
    level, percentage = get_rainfall_level(rainfall_value)

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

    while running:
        now = datetime.now()
        # 每10分钟执行一次聚合
        if (now - last_aggregate_time).total_seconds() >= 600:
            log(f"Performing periodic data aggregation, last time: {last_aggregate_time}")
            try:
                aggregate_data(username)
                last_aggregate_time = now
            except Exception as e:
                log(f"Data aggregation failed: {str(e)}")
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

    # 注册信号处理函数
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    log(f"Starting {'real' if use_real_data else 'simulated'} data collection, interval: {interval} seconds")

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
                log(f"Collected data: {data['rainfall_value']} mm/h ({data['rainfall_level']}, {data['rainfall_percentage']}%)")
                if not result["success"]:
                    log(f"Data insertion failed: {result['error']}")

            # 等待下一次采集
            time.sleep(interval)
    except Exception as e:
        log(f"Error during data collection: {str(e)}")
        log(traceback.format_exc())
    finally:
        log("Data collection stopped")
        # 确保最后执行一次聚合
        try:
            aggregate_data()
        except Exception as e:
            log(f"Final data aggregation failed: {str(e)}")

def collect_single_data(username='admin', use_real_data=False):
    """采集单次数据并返回

    参数:
        username: 用户名，默认为'admin'
        use_real_data: 是否使用真实数据，如果为False则使用模拟数据
    """
    try:
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

        if result["success"]:
            return {
                "success": True,
                "data": {
                    "timestamp": data["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                    "rainfall_value": data["rainfall_value"],
                    "rainfall_level": data["rainfall_level"],
                    "rainfall_percentage": data["rainfall_percentage"]
                }
            }
        else:
            return {"success": False, "error": result["error"]}
    except Exception as e:
        log(f"Single data collection failed: {str(e)}")
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
        if args.action == 'start':
            start_collection(args.username, args.interval, args.real, args.verbose)
        elif args.action == 'single':
            result = collect_single_data(args.username, args.real)
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
