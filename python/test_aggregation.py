#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
测试聚合逻辑是否正确修改
"""

import sys
import json
import traceback
from datetime import datetime, timedelta
import pymysql
from rainfall_db import get_db_connection, log, aggregate_data

def test_aggregation_logic():
    """测试聚合逻辑是否正确修改"""
    log("开始测试聚合逻辑...")

    # 1. 先清空测试数据
    clear_test_data()

    # 2. 插入一些测试数据
    insert_test_data()

    # 3. 执行聚合
    username = 'test_user'
    aggregate_data(username)

    # 4. 查询聚合结果并验证
    verify_aggregation_results(username)

def clear_test_data():
    """清空测试数据"""
    log("清空测试数据...")
    username = 'test_user'

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 清空原始数据
            cursor.execute("DELETE FROM rainfall_raw WHERE username = %s", (username,))
            log(f"清空原始数据: {cursor.rowcount} 行")

            # 清空10分钟聚合数据
            cursor.execute("DELETE FROM rainfall_10min WHERE username = %s", (username,))
            log(f"清空10分钟聚合数据: {cursor.rowcount} 行")

            # 清空小时聚合数据
            cursor.execute("DELETE FROM rainfall_hourly WHERE username = %s", (username,))
            log(f"清空小时聚合数据: {cursor.rowcount} 行")

            # 清空日聚合数据
            cursor.execute("DELETE FROM rainfall_daily WHERE username = %s", (username,))
            log(f"清空日聚合数据: {cursor.rowcount} 行")

            # 清空月聚合数据
            cursor.execute("DELETE FROM rainfall_monthly WHERE username = %s", (username,))
            log(f"清空月聚合数据: {cursor.rowcount} 行")

        conn.commit()
        log("清空测试数据完成")
    except Exception as e:
        log(f"清空测试数据出错: {str(e)}")
        log(traceback.format_exc())
    finally:
        conn.close()

def insert_test_data():
    """插入测试数据"""
    log("插入测试数据...")
    username = 'test_user'

    # 创建一个10分钟时间段内的数据，但只有部分5秒点
    # 10分钟内应该有120个5秒点，我们只插入60个
    now = datetime.now()
    # 设置为整10分钟
    start_time = now.replace(minute=now.minute // 10 * 10, second=0, microsecond=0)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 插入60个5秒点
            for i in range(60):
                timestamp = start_time + timedelta(seconds=i * 5)
                rainfall_value = 10.0  # 固定雨量值
                rainfall_level = 'medium'

                # 计算雨量百分比
                rainfall_percentage = 50  # 固定百分比值

                cursor.execute('''
                    INSERT INTO rainfall_raw
                    (username, timestamp, rainfall_value, rainfall_level, rainfall_percentage)
                    VALUES (%s, %s, %s, %s, %s)
                ''', (username, timestamp, rainfall_value, rainfall_level, rainfall_percentage))

            log(f"插入原始数据: {cursor.rowcount} 行")

        conn.commit()
        log("插入测试数据完成")
    except Exception as e:
        log(f"插入测试数据出错: {str(e)}")
        log(traceback.format_exc())
    finally:
        conn.close()

def verify_aggregation_results(username):
    """验证聚合结果"""
    log("验证聚合结果...")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 查询10分钟聚合数据
            cursor.execute('''
                SELECT * FROM rainfall_10min
                WHERE username = %s
                ORDER BY timestamp DESC
                LIMIT 1
            ''', (username,))
            ten_min_data = cursor.fetchone()

            if ten_min_data:
                log("10分钟聚合数据:")
                log(f"  时间戳: {ten_min_data['timestamp']}")
                log(f"  平均雨量: {ten_min_data['avg_rainfall']} mm/h")
                log(f"  最大雨量: {ten_min_data['max_rainfall']} mm/h")
                log(f"  最小雨量: {ten_min_data['min_rainfall']} mm/h")
                log(f"  主要级别: {ten_min_data['dominant_level']}")
                log(f"  实际数据点: {ten_min_data['data_points']}")
                log(f"  应有数据点: {ten_min_data['expected_points']}")

                # 验证平均雨量计算是否正确
                # 我们插入了60个点，每个点雨量为10.0，但应该有120个点
                # 平均雨量应该是 (60 * 10.0) / 120 = 5.0
                expected_avg = 5.0
                actual_avg = float(ten_min_data['avg_rainfall'])

                if abs(actual_avg - expected_avg) < 0.1:
                    log("✓ 10分钟平均雨量计算正确")
                else:
                    log(f"✗ 10分钟平均雨量计算错误: 期望 {expected_avg}, 实际 {actual_avg}")

                # 验证数据点数量是否正确
                if ten_min_data['data_points'] == 60:
                    log("✓ 实际数据点数量正确")
                else:
                    log(f"✗ 实际数据点数量错误: 期望 60, 实际 {ten_min_data['data_points']}")

                if ten_min_data['expected_points'] == 120:
                    log("✓ 应有数据点数量正确")
                else:
                    log(f"✗ 应有数据点数量错误: 期望 120, 实际 {ten_min_data['expected_points']}")
            else:
                log("未找到10分钟聚合数据")

            # 查询小时聚合数据
            cursor.execute('''
                SELECT * FROM rainfall_hourly
                WHERE username = %s
                ORDER BY timestamp DESC
                LIMIT 1
            ''', (username,))
            hourly_data = cursor.fetchone()

            if hourly_data:
                log("\n小时聚合数据:")
                log(f"  时间戳: {hourly_data['timestamp']}")
                log(f"  平均雨量: {hourly_data['avg_rainfall']} mm/h")
                log(f"  最大雨量: {hourly_data['max_rainfall']} mm/h")
                log(f"  最小雨量: {hourly_data['min_rainfall']} mm/h")
                log(f"  累计雨量: {hourly_data['total_rainfall']} mm")
                log(f"  主要级别: {hourly_data['dominant_level']}")
                log(f"  实际数据点: {hourly_data['data_points']}")
                log(f"  应有数据点: {hourly_data['expected_points']}")

                # 验证小时聚合逻辑
                # 我们只有一个10分钟段，但应该有6个10分钟段
                # 平均雨量应该是 (1 * 5.0) / 6 = 0.83
                expected_avg = 5.0 / 6
                actual_avg = float(hourly_data['avg_rainfall'])

                if abs(actual_avg - expected_avg) < 0.1:
                    log("✓ 小时平均雨量计算正确")
                else:
                    log(f"✗ 小时平均雨量计算错误: 期望 {expected_avg}, 实际 {actual_avg}")
            else:
                log("未找到小时聚合数据")

            # 查询日聚合数据
            cursor.execute('''
                SELECT * FROM rainfall_daily
                WHERE username = %s
                ORDER BY date DESC
                LIMIT 1
            ''', (username,))
            daily_data = cursor.fetchone()

            if daily_data:
                log("\n日聚合数据:")
                log(f"  日期: {daily_data['date']}")
                log(f"  平均雨量: {daily_data['avg_rainfall']} mm/h")
                log(f"  最大雨量: {daily_data['max_rainfall']} mm/h")
                log(f"  最小雨量: {daily_data['min_rainfall']} mm/h")
                log(f"  累计雨量: {daily_data['total_rainfall']} mm")
                log(f"  有雨小时数: {daily_data['rainy_hours']}")
                log(f"  实际数据点: {daily_data['data_points']}")
                log(f"  应有数据点: {daily_data['expected_points']}")

                # 验证日聚合逻辑
                # 我们只有一个小时段，但应该有24个小时段
                # 平均雨量应该是 (1 * 0.83) / 24 = 0.035
                # 但由于四舍五入到小数点后一位，结果为0.0
                expected_avg = 0.0
                actual_avg = float(daily_data['avg_rainfall'])

                if abs(actual_avg - expected_avg) < 0.01:
                    log("✓ 日平均雨量计算正确")
                else:
                    log(f"✗ 日平均雨量计算错误: 期望 {expected_avg}, 实际 {actual_avg}")
            else:
                log("未找到日聚合数据")

        log("验证聚合结果完成")
    except Exception as e:
        log(f"验证聚合结果出错: {str(e)}")
        log(traceback.format_exc())
    finally:
        conn.close()

if __name__ == "__main__":
    test_aggregation_logic()
