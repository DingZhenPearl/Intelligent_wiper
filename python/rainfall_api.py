#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import json
import traceback
import io
from datetime import datetime, timedelta
import argparse
from rainfall_db import (
    get_recent_data,
    get_data_by_timerange,
    get_current_hour_data,
    log
)
from rainfall_collector import collect_single_data

# 重新定义log函数，确保使用ASCII编码
def log(message):
    # 使用ASCII字符集输出日志，避免中文编码问题
    try:
        # 尝试将中文替换为英文描述
        message = message.encode('ascii', 'replace').decode('ascii')
    except:
        # 如果失败，使用原始消息
        pass

    print(f"LOG: {message}", file=sys.stderr)
    sys.stderr.flush()  # 确保日志立即输出

# 不设置 stdout 编码，使用系统默认编码
# Windows环境下通常是cp936或gbk

def get_statistics_data(username='admin', period='10min'):
    """获取统计页面所需的数据

    参数:
        username: 用户名，默认为'admin'
        period: 时间粒度，可选值: '10min', 'hourly', 'daily', 'all'
    """
    try:
        now = datetime.now()

        if period == '10min':
            # 获取最近10分钟的数据，使用原始数据
            start_time = now - timedelta(minutes=10)
            result = get_data_by_timerange(username, 'raw', start_time, now)

            if result["success"]:
                # 转换为前端所需格式
                formatted_data = []
                for item in result["data"]:
                    formatted_data.append({
                        "value": [
                            item["timestamp"].strftime("%H:%M:%S"),
                            item["rainfall_value"]
                        ],
                        "originalDate": item["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                        "timeKey": {
                            "second": item["timestamp"].strftime("%H:%M:%S"),
                            "minute": item["timestamp"].strftime("%H:%M"),
                            "tenMinute": f"{item['timestamp'].hour}:{item['timestamp'].minute // 10 * 10:02d}",
                            "hour": f"{item['timestamp'].hour}:00",
                            "day": f"{item['timestamp'].month}/{item['timestamp'].day}"
                        },
                        "rainfallValue": item["rainfall_value"],
                        "unit": "mm/h"
                    })

                # 获取当前小时累计雨量
                hour_data = get_current_hour_data(username)

                return {
                    "success": True,
                    "period": "10min",
                    "data": formatted_data,
                    "currentHour": hour_data["data"] if hour_data["success"] else None,
                    "unit": "mm/h"
                }
            else:
                return result

        elif period == 'hourly':
            # 获取最近1小时的数据，使用10分钟聚合数据
            start_time = now - timedelta(hours=1)
            result = get_data_by_timerange(username, '10min', start_time, now)

            if result["success"]:
                # 转换为前端所需格式
                formatted_data = []
                for item in result["data"]:
                    formatted_data.append({
                        "value": [
                            item["timestamp"].strftime("%H:%M"),
                            item["avg_rainfall"]
                        ],
                        "originalDate": item["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                        "timeKey": {
                            "minute": item["timestamp"].strftime("%H:%M"),
                            "tenMinute": f"{item['timestamp'].hour}:{item['timestamp'].minute // 10 * 10:02d}",
                            "hour": f"{item['timestamp'].hour}:00",
                            "day": f"{item['timestamp'].month}/{item['timestamp'].day}"
                        },
                        "rainfallValue": item["avg_rainfall"],
                        "unit": "mm/h"
                    })

                # 获取当前小时累计雨量
                hour_data = get_current_hour_data(username)

                return {
                    "success": True,
                    "period": "hourly",
                    "data": formatted_data,
                    "currentHour": hour_data["data"] if hour_data["success"] else None,
                    "unit": "mm/h"
                }
            else:
                return result

        elif period == 'daily':
            # 获取最近24小时的数据，使用小时聚合数据
            start_time = now - timedelta(days=1)
            result = get_data_by_timerange(username, 'hourly', start_time, now)

            if result["success"]:
                # 转换为前端所需格式
                formatted_data = []
                for item in result["data"]:
                    formatted_data.append({
                        "value": [
                            item["timestamp"].strftime("%H:00"),
                            item["avg_rainfall"]
                        ],
                        "originalDate": item["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                        "timeKey": {
                            "hour": f"{item['timestamp'].hour}:00",
                            "day": f"{item['timestamp'].month}/{item['timestamp'].day}"
                        },
                        "rainfallValue": item["avg_rainfall"],
                        "unit": "mm/h"
                    })

                return {
                    "success": True,
                    "period": "daily",
                    "data": formatted_data,
                    "unit": "mm/h"
                }
            else:
                return result

        elif period == 'all':
            # 获取最近30天的数据，使用日聚合数据
            start_time = now - timedelta(days=30)
            result = get_data_by_timerange(username, 'daily', start_time, now)

            if result["success"]:
                # 转换为前端所需格式
                formatted_data = []
                for item in result["data"]:
                    formatted_data.append({
                        "value": [
                            item["date"].strftime("%m/%d"),
                            item["total_rainfall"]
                        ],
                        "originalDate": item["date"].strftime("%Y-%m-%d"),
                        "timeKey": {
                            "day": f"{item['date'].month}/{item['date'].day}"
                        },
                        "rainfallValue": item["total_rainfall"],
                        "unit": "mm/天"
                    })

                return {
                    "success": True,
                    "period": "all",
                    "data": formatted_data,
                    "unit": "mm/天"
                }
            else:
                return result
        else:
            return {"success": False, "error": f"不支持的时间粒度: {period}"}
    except Exception as e:
        log(f"获取统计数据失败: {str(e)}")
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}

def get_home_data(username='admin'):
    """获取首页所需的实时雨量数据

    参数:
        username: 用户名，默认为'admin'
    """
    try:
        # 先尝试获取最近的一条数据
        recent_data = get_recent_data(username, 'raw', 1)

        if recent_data["success"] and recent_data["data"]:
            # 如果有最近的数据，使用它
            item = recent_data["data"][0]

            # 检查数据是否过时（超过10秒）
            data_time = item["timestamp"]
            now = datetime.now()
            time_diff = (now - data_time).total_seconds()

            if time_diff > 10:
                # 数据过时，返回数据但添加提示消息
                return {
                    "success": True,
                    "data": {
                        "timestamp": item["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                        "rainfall_value": item["rainfall_value"],
                        "rainfall_level": item["rainfall_level"],
                        "rainfall_percentage": item["rainfall_percentage"]
                    },
                    "message": "数据采集器已停止，请点击按钮开始收集数据"
                }
            else:
                # 数据未过时，正常返回
                return {
                    "success": True,
                    "data": {
                        "timestamp": item["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                        "rainfall_value": item["rainfall_value"],
                        "rainfall_level": item["rainfall_level"],
                        "rainfall_percentage": item["rainfall_percentage"]
                    }
                }
        else:
            # 如果没有最近的数据，返回默认值
            now = datetime.now()
            return {
                "success": True,
                "data": {
                    "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
                    "rainfall_value": 0.0,
                    "rainfall_level": "none",
                    "rainfall_percentage": 0
                },
                "message": "数据采集器未启动，请点击按钮开始收集数据"
            }
    except Exception as e:
        log(f"获取首页数据失败: {str(e)}")
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='雨量数据API')
    parser.add_argument('--action', choices=['stats', 'home'],
                        required=True, help='执行的操作')
    parser.add_argument('--username', type=str, default='admin',
                        help='用户名，默认为admin')
    parser.add_argument('--period', choices=['10min', 'hourly', 'daily', 'all'],
                        default='10min', help='统计数据的时间粒度')

    args = parser.parse_args()

    try:
        if args.action == 'stats':
            result = get_statistics_data(args.username, args.period)
        elif args.action == 'home':
            result = get_home_data(args.username)
        else:
            result = {"success": False, "error": "未知操作"}

        # 以标准JSON格式输出结果
        # 确保使用ASCII编码输出，避免中文编码问题
        try:
            print(json.dumps(result, ensure_ascii=True, default=str))
            sys.stdout.flush()
        except ValueError:
            # 如果stdout已关闭，则使用stderr
            print(json.dumps(result, ensure_ascii=True, default=str), file=sys.stderr)
            sys.stderr.flush()

    except Exception as e:
        log(f"脚本执行错误: {str(e)}")
        log(traceback.format_exc())
        error_result = {"success": False, "error": f"脚本执行错误: {str(e)}"}
        try:
            print(json.dumps(error_result, ensure_ascii=True))
            sys.stdout.flush()
        except ValueError:
            # 如果stdout已关闭，则使用stderr
            print(json.dumps(error_result, ensure_ascii=True), file=sys.stderr)
            sys.stderr.flush()
