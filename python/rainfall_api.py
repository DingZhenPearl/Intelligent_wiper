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
# 不再需要从rainfall_collector导入，因为我们已经删除了这个文件

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
                    # 将时间调整到最近的整5秒
                    original_timestamp = item["timestamp"]
                    seconds = original_timestamp.second
                    # 计算最近的整5秒
                    rounded_seconds = round(seconds / 5) * 5
                    if rounded_seconds == 60:  # 处理进位情况
                        rounded_timestamp = original_timestamp.replace(second=0)
                        rounded_timestamp = rounded_timestamp + timedelta(minutes=1)
                    else:
                        rounded_timestamp = original_timestamp.replace(second=rounded_seconds)

                    # 记录调整前后的时间戳信息
                    log(f"调整时间戳: {original_timestamp.strftime('%H:%M:%S')} -> {rounded_timestamp.strftime('%H:%M:%S')}")

                    formatted_data.append({
                        "value": [
                            rounded_timestamp.strftime("%H:%M:%S"),
                            item["rainfall_value"]
                        ],
                        "originalDate": original_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                        "adjustedDate": rounded_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                        "timeKey": {
                            "second": rounded_timestamp.strftime("%H:%M:%S"),
                            "minute": rounded_timestamp.strftime("%H:%M"),
                            "tenMinute": f"{rounded_timestamp.hour}:{rounded_timestamp.minute // 10 * 10:02d}",
                            "hour": f"{rounded_timestamp.hour}:00",
                            "day": f"{rounded_timestamp.month}/{rounded_timestamp.day}"
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

                # 生成过去1小时的每10分钟的时间点
                time_slots = []
                slot_start = start_time.replace(minute=start_time.minute // 10 * 10, second=0, microsecond=0)
                log(f"一小时视图: 开始时间 = {slot_start.strftime('%H:%M')}, 结束时间 = {now.strftime('%H:%M')}")
                while slot_start <= now:
                    time_slots.append(slot_start)
                    slot_start += timedelta(minutes=10)
                log(f"一小时视图: 生成了 {len(time_slots)} 个时间点")

                # 对每个时间点处理
                for slot in time_slots:
                    # 查找该时间点的数据
                    # 将时间戳的秒和微秒设为0进行比较
                    slot_data = [item for item in result["data"] if item["timestamp"].replace(second=0, microsecond=0) == slot]
                    log(f"一小时视图: 时间点 {slot.strftime('%H:%M')} 找到 {len(slot_data)} 个数据点")

                    if slot_data:  # 如果有数据，使用实际数据
                        item = slot_data[0]  # 取第一个数据点
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
                    else:  # 如果没有数据，显示为0
                        formatted_data.append({
                            "value": [
                                slot.strftime("%H:%M"),
                                0.0
                            ],
                            "originalDate": slot.strftime("%Y-%m-%d %H:%M:%S"),
                            "timeKey": {
                                "minute": slot.strftime("%H:%M"),
                                "tenMinute": f"{slot.hour}:{slot.minute // 10 * 10:02d}",
                                "hour": f"{slot.hour}:00",
                                "day": f"{slot.month}/{slot.day}"
                            },
                            "rainfallValue": 0.0,
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
            # 获取当天的数据，使用小时聚合数据
            # 设置开始时间为今天的0点
            start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
            log(f"一天视图: 使用当天开始时间 = {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
            result = get_data_by_timerange(username, 'hourly', start_time, now)

            if result["success"]:
                # 转换为前端所需格式
                formatted_data = []

                # 生成当天的每小时时间点
                time_slots = []
                # 确保开始时间是当天的0点
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                slot_start = today_start
                log(f"一天视图: 开始时间 = {slot_start.strftime('%Y-%m-%d %H:%M')}, 结束时间 = {now.strftime('%Y-%m-%d %H:%M')}")

                # 只生成当天的时间点
                while slot_start <= now:
                    # 确保时间点是当天的
                    if slot_start.date() == now.date():
                        time_slots.append(slot_start)
                    slot_start += timedelta(hours=1)

                log(f"一天视图: 生成了 {len(time_slots)} 个当天的时间点")

                # 对每个时间点处理
                for slot in time_slots:
                    # 查找该时间点的数据
                    # 将时间戳的分钟、秒和微秒设为0进行比较
                    # 同时确保数据点是当天的
                    slot_data = [
                        item for item in result["data"]
                        if (item["timestamp"].replace(minute=0, second=0, microsecond=0) == slot and
                            item["timestamp"].date() == now.date())
                    ]
                    log(f"一天视图: 时间点 {slot.strftime('%H:00')} 找到 {len(slot_data)} 个当天的数据点")

                    if slot_data:  # 如果有数据，使用实际数据
                        item = slot_data[0]  # 取第一个数据点
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
                    else:  # 如果没有数据，显示为0
                        formatted_data.append({
                            "value": [
                                slot.strftime("%H:00"),
                                0.0
                            ],
                            "originalDate": slot.strftime("%Y-%m-%d %H:%M:%S"),
                            "timeKey": {
                                "hour": f"{slot.hour}:00",
                                "day": f"{slot.month}/{slot.day}"
                            },
                            "rainfallValue": 0.0,
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

                # 生成过去30天的每天的时间点
                time_slots = []
                slot_start = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
                log(f"全部视图: 开始时间 = {slot_start.strftime('%Y-%m-%d')}, 结束时间 = {now.strftime('%Y-%m-%d')}")
                while slot_start <= now:
                    time_slots.append(slot_start)
                    slot_start += timedelta(days=1)
                log(f"全部视图: 生成了 {len(time_slots)} 个时间点")

                # 对每个时间点处理
                for slot in time_slots:
                    # 查找该时间点的数据
                    slot_date = slot.date()
                    # 注意：item["date"]已经是date类型，不需要再调用date()方法
                    slot_data = [item for item in result["data"] if item["date"] == slot_date]
                    log(f"全部视图: 时间点 {slot_date.strftime('%Y-%m-%d')} 找到 {len(slot_data)} 个数据点")

                    if slot_data:  # 如果有数据，使用实际数据
                        item = slot_data[0]  # 取第一个数据点
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
                    else:  # 如果没有数据，显示为0
                        formatted_data.append({
                            "value": [
                                slot.strftime("%m/%d"),
                                0.0
                            ],
                            "originalDate": slot.strftime("%Y-%m-%d"),
                            "timeKey": {
                                "day": f"{slot.month}/{slot.day}"
                            },
                            "rainfallValue": 0.0,
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
