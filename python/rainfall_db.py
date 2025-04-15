#!/usr/bin/env python
# -*- coding: utf-8 -*-

import pymysql
import json
import sys
import traceback
import io
import time
from datetime import datetime, timedelta
import random

# 不设置 stdout 编码，使用系统默认编码
# Windows环境下通常是cp936或gbk

# 添加日志记录
def log(message):
    print(f"LOG: {message}", file=sys.stderr)
    sys.stderr.flush()  # 确保日志立即输出

# 使用与db_service.py相同的数据库配置
db_config = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "mwYgR7#*X2",
    "database": "wx_to_vue_db"
}

def get_db_connection():
    """获取数据库连接"""
    try:
        # 测试数据库连接
        log("Trying to connect to database...")
        connection = pymysql.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database'],
            port=db_config['port'],
            cursorclass=pymysql.cursors.DictCursor
        )
        log("Database connection successful")
        return connection
    except pymysql.Error as e:
        log(f"Database connection error: {str(e)}")
        # 尝试创建数据库
        try:
            log("Trying to create database...")
            temp_conn = pymysql.connect(
                host=db_config['host'],
                user=db_config['user'],
                password=db_config['password'],
                port=db_config['port']
            )
            with temp_conn.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_config['database']}")
            temp_conn.commit()
            temp_conn.close()

            # 重新尝试连接
            connection = pymysql.connect(
                host=db_config['host'],
                user=db_config['user'],
                password=db_config['password'],
                database=db_config['database'],
                port=db_config['port'],
                cursorclass=pymysql.cursors.DictCursor
            )
            log("Database created and connected successfully")
            return connection
        except Exception as create_err:
            log(f"Failed to create database: {str(create_err)}")
            raise

def init_rainfall_tables():
    """初始化雨量数据相关的表结构"""
    conn = get_db_connection()
    try:
        # 先删除现有的表，然后再创建新的表
        with conn.cursor() as cursor:
            # 删除现有的表
            cursor.execute("DROP TABLE IF EXISTS rainfall_raw")
            cursor.execute("DROP TABLE IF EXISTS rainfall_10min")
            cursor.execute("DROP TABLE IF EXISTS rainfall_hourly")
            cursor.execute("DROP TABLE IF EXISTS rainfall_daily")
            cursor.execute("DROP TABLE IF EXISTS rainfall_monthly")

        # 创建新的表
        with conn.cursor() as cursor:
            # 创建原始雨量数据表 (5秒一个数据点)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rainfall_raw (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL COMMENT '用户名',
                    timestamp DATETIME NOT NULL,
                    rainfall_value DECIMAL(5,1) NOT NULL COMMENT '雨量值 (mm/h)',
                    rainfall_level ENUM('none', 'light', 'medium', 'heavy') NOT NULL COMMENT '雨量级别',
                    rainfall_percentage INT NOT NULL COMMENT '雨量百分比 (0-100)',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_username (username),
                    INDEX idx_username_timestamp (username, timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='原始雨量数据 (5秒间隔)';
            ''')

            # 创建10分钟聚合数据表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rainfall_10min (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL COMMENT '用户名',
                    timestamp DATETIME NOT NULL COMMENT '10分钟时间段的开始时间',
                    avg_rainfall DECIMAL(5,1) NOT NULL COMMENT '平均雨量 (mm/h)',
                    max_rainfall DECIMAL(5,1) NOT NULL COMMENT '最大雨量 (mm/h)',
                    min_rainfall DECIMAL(5,1) NOT NULL COMMENT '最小雨量 (mm/h)',
                    dominant_level ENUM('none', 'light', 'medium', 'heavy') NOT NULL COMMENT '主要雨量级别',
                    data_points INT NOT NULL COMMENT '数据点数量',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    UNIQUE KEY uk_username_timestamp (username, timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='10分钟聚合雨量数据';
            ''')

            # 创建小时聚合数据表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rainfall_hourly (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL COMMENT '用户名',
                    timestamp DATETIME NOT NULL COMMENT '小时时间段的开始时间',
                    avg_rainfall DECIMAL(5,1) NOT NULL COMMENT '平均雨量 (mm/h)',
                    max_rainfall DECIMAL(5,1) NOT NULL COMMENT '最大雨量 (mm/h)',
                    min_rainfall DECIMAL(5,1) NOT NULL COMMENT '最小雨量 (mm/h)',
                    total_rainfall DECIMAL(6,1) NOT NULL COMMENT '累计雨量 (mm)',
                    dominant_level ENUM('none', 'light', 'medium', 'heavy') NOT NULL COMMENT '主要雨量级别',
                    data_points INT NOT NULL COMMENT '数据点数量',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    UNIQUE KEY uk_username_timestamp (username, timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小时聚合雨量数据';
            ''')

            # 创建日聚合数据表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rainfall_daily (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL COMMENT '用户名',
                    date DATE NOT NULL COMMENT '日期',
                    avg_rainfall DECIMAL(5,1) NOT NULL COMMENT '平均雨量 (mm/h)',
                    max_rainfall DECIMAL(5,1) NOT NULL COMMENT '最大雨量 (mm/h)',
                    min_rainfall DECIMAL(5,1) NOT NULL COMMENT '最小雨量 (mm/h)',
                    total_rainfall DECIMAL(6,1) NOT NULL COMMENT '累计雨量 (mm/天)',
                    rainy_hours INT NOT NULL COMMENT '有雨小时数',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    UNIQUE KEY uk_username_date (username, date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='日聚合雨量数据';
            ''')

            # 创建月聚合数据表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rainfall_monthly (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL COMMENT '用户名',
                    year INT NOT NULL COMMENT '年份',
                    month INT NOT NULL COMMENT '月份 (1-12)',
                    avg_daily_rainfall DECIMAL(6,1) NOT NULL COMMENT '平均日雨量 (mm/天)',
                    max_daily_rainfall DECIMAL(6,1) NOT NULL COMMENT '最大日雨量 (mm/天)',
                    total_rainfall DECIMAL(8,1) NOT NULL COMMENT '月累计雨量 (mm)',
                    rainy_days INT NOT NULL COMMENT '有雨天数',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    UNIQUE KEY uk_username_year_month (username, year, month)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='月聚合雨量数据';
            ''')

        conn.commit()
        return {"success": True, "message": "雨量数据表初始化成功"}
    except Exception as e:
        log(f"雨量数据表初始化失败: {str(e)}")
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def insert_raw_rainfall(username, timestamp, rainfall_value, rainfall_level, rainfall_percentage):
    """插入原始雨量数据

    参数:
        username: 用户名
        timestamp: 时间戳
        rainfall_value: 雨量值 (mm/h)
        rainfall_level: 雨量级别 ('none', 'light', 'medium', 'heavy')
        rainfall_percentage: 雨量百分比 (0-100)
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = '''
                INSERT INTO rainfall_raw
                (username, timestamp, rainfall_value, rainfall_level, rainfall_percentage)
                VALUES (%s, %s, %s, %s, %s)
            '''
            cursor.execute(sql, (username, timestamp, rainfall_value, rainfall_level, rainfall_percentage))
        conn.commit()
        return {"success": True, "message": "原始雨量数据插入成功"}
    except Exception as e:
        log(f"原始雨量数据插入失败: {str(e)}")
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def get_rainfall_level(value):
    """根据雨量值获取雨量级别"""
    if value < 0.3:
        return 'none', 0
    elif value >= 0.3 and value <= 2.2:
        # 将范围 0.3-2.2 映射到 1-25
        percentage = round(1 + (value - 0.3) * (25 - 1) / (2.2 - 0.3))
        return 'light', percentage
    elif value > 2.2 and value <= 4.0:
        # 将范围 2.2-4.0 映射到 26-50
        percentage = round(26 + (value - 2.2) * (50 - 26) / (4.0 - 2.2))
        return 'medium', percentage
    else:
        # 将范围 4.0-33 映射到 51-100
        percentage = round(51 + min(value, 33) - 4.0) * (100 - 51) / (33 - 4.0)
        return 'heavy', percentage

def generate_mock_data(username='admin', days=7):
    """清除现有数据并初始化一个起始数据点

    参数:
        username: 用户名，默认为'admin'
        days: 参数保留但不再使用，仅用于兼容现有API
    """
    conn = get_db_connection()
    try:
        # 清空指定用户的现有数据
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM rainfall_raw WHERE username = %s", (username,))
            cursor.execute("DELETE FROM rainfall_10min WHERE username = %s", (username,))
            cursor.execute("DELETE FROM rainfall_hourly WHERE username = %s", (username,))
            cursor.execute("DELETE FROM rainfall_daily WHERE username = %s", (username,))
            cursor.execute("DELETE FROM rainfall_monthly WHERE username = %s", (username,))
        conn.commit()

        # 只生成一个初始数据点
        current_time = datetime.now()
        # 初始雨量值设为0
        rainfall_value = 0.0
        # 获取雨量级别和百分比
        level, percentage = get_rainfall_level(rainfall_value)

        log(f"Initializing mock data for user {username} at {current_time}")

        # 插入初始数据点
        with conn.cursor() as cursor:
            sql = '''
                INSERT INTO rainfall_raw
                (username, timestamp, rainfall_value, rainfall_level, rainfall_percentage)
                VALUES (%s, %s, %s, %s, %s)
            '''
            cursor.execute(sql, (username, current_time, rainfall_value, level, percentage))
            conn.commit()

        # 不需要聚合数据，因为只有一个数据点
        # 数据采集器将负责后续数据的生成和聚合

        return {"success": True, "message": f"Successfully initialized mock data for user {username}. Data collection will continue at 5-second intervals."}
    except Exception as e:
        log(f"Failed to initialize mock data: {str(e)}")
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def aggregate_data(username='admin'):
    """聚合数据到各个时间粒度的表中

    参数:
        username: 用户名，默认为'admin'
    """
    conn = get_db_connection()
    try:
        # 1. 聚合到10分钟表
        with conn.cursor() as cursor:
            cursor.execute('''
                INSERT INTO rainfall_10min
                (username, timestamp, avg_rainfall, max_rainfall, min_rainfall, dominant_level, data_points)
                SELECT
                    %s as username,
                    DATE_FORMAT(timestamp, '%%Y-%%m-%%d %%H:%%i:00') - INTERVAL MINUTE(timestamp) %% 10 MINUTE as time_slot,
                    ROUND(AVG(rainfall_value), 1) as avg_rainfall,
                    MAX(rainfall_value) as max_rainfall,
                    MIN(rainfall_value) as min_rainfall,
                    (
                        SELECT r2.rainfall_level
                        FROM rainfall_raw r2
                        WHERE r2.username = %s
                        AND DATE_FORMAT(r2.timestamp, '%%Y-%%m-%%d %%H:%%i:00') - INTERVAL MINUTE(r2.timestamp) %% 10 MINUTE = time_slot
                        GROUP BY r2.rainfall_level
                        ORDER BY COUNT(*) DESC
                        LIMIT 1
                    ) as dominant_level,
                    COUNT(*) as data_points
                FROM rainfall_raw
                WHERE username = %s
                GROUP BY time_slot
                ON DUPLICATE KEY UPDATE
                    avg_rainfall = VALUES(avg_rainfall),
                    max_rainfall = VALUES(max_rainfall),
                    min_rainfall = VALUES(min_rainfall),
                    dominant_level = VALUES(dominant_level),
                    data_points = VALUES(data_points),
                    updated_at = CURRENT_TIMESTAMP
            ''', (username, username, username))
            log(f"10分钟数据聚合完成，影响行数: {cursor.rowcount}")

        # 2. 聚合到小时表
        with conn.cursor() as cursor:
            cursor.execute('''
                INSERT INTO rainfall_hourly
                (username, timestamp, avg_rainfall, max_rainfall, min_rainfall, total_rainfall, dominant_level, data_points)
                SELECT
                    %s as username,
                    DATE_FORMAT(timestamp, '%%Y-%%m-%%d %%H:00:00') as hour_slot,
                    ROUND(AVG(avg_rainfall), 1) as avg_rainfall,
                    MAX(max_rainfall) as max_rainfall,
                    MIN(min_rainfall) as min_rainfall,
                    ROUND(SUM(avg_rainfall) / 6, 1) as total_rainfall,
                    (
                        SELECT r2.dominant_level
                        FROM rainfall_10min r2
                        WHERE r2.username = %s
                        AND DATE_FORMAT(r2.timestamp, '%%Y-%%m-%%d %%H:00:00') = hour_slot
                        GROUP BY r2.dominant_level
                        ORDER BY COUNT(*) DESC
                        LIMIT 1
                    ) as dominant_level,
                    SUM(data_points) as data_points
                FROM rainfall_10min
                WHERE username = %s
                GROUP BY hour_slot
                ON DUPLICATE KEY UPDATE
                    avg_rainfall = VALUES(avg_rainfall),
                    max_rainfall = VALUES(max_rainfall),
                    min_rainfall = VALUES(min_rainfall),
                    total_rainfall = VALUES(total_rainfall),
                    dominant_level = VALUES(dominant_level),
                    data_points = VALUES(data_points),
                    updated_at = CURRENT_TIMESTAMP
            ''', (username, username, username))
            log(f"小时数据聚合完成，影响行数: {cursor.rowcount}")

        # 3. 聚合到日表
        with conn.cursor() as cursor:
            cursor.execute('''
                INSERT INTO rainfall_daily
                (username, date, avg_rainfall, max_rainfall, min_rainfall, total_rainfall, rainy_hours)
                SELECT
                    %s as username,
                    DATE(timestamp) as day_slot,
                    ROUND(AVG(avg_rainfall), 1) as avg_rainfall,
                    MAX(max_rainfall) as max_rainfall,
                    MIN(min_rainfall) as min_rainfall,
                    ROUND(SUM(total_rainfall), 1) as total_rainfall,
                    SUM(CASE WHEN avg_rainfall >= 0.3 THEN 1 ELSE 0 END) as rainy_hours
                FROM rainfall_hourly
                WHERE username = %s
                GROUP BY day_slot
                ON DUPLICATE KEY UPDATE
                    avg_rainfall = VALUES(avg_rainfall),
                    max_rainfall = VALUES(max_rainfall),
                    min_rainfall = VALUES(min_rainfall),
                    total_rainfall = VALUES(total_rainfall),
                    rainy_hours = VALUES(rainy_hours),
                    updated_at = CURRENT_TIMESTAMP
            ''', (username, username))
            log(f"Daily data aggregation completed, affected rows: {cursor.rowcount}")

        # 4. 聚合到月表
        with conn.cursor() as cursor:
            cursor.execute('''
                INSERT INTO rainfall_monthly
                (username, year, month, avg_daily_rainfall, max_daily_rainfall, total_rainfall, rainy_days)
                SELECT
                    %s as username,
                    YEAR(date) as year_val,
                    MONTH(date) as month_val,
                    ROUND(AVG(total_rainfall), 1) as avg_daily_rainfall,
                    MAX(total_rainfall) as max_daily_rainfall,
                    ROUND(SUM(total_rainfall), 1) as total_rainfall,
                    SUM(CASE WHEN total_rainfall >= 0.3 THEN 1 ELSE 0 END) as rainy_days
                FROM rainfall_daily
                WHERE username = %s
                GROUP BY year_val, month_val
                ON DUPLICATE KEY UPDATE
                    avg_daily_rainfall = VALUES(avg_daily_rainfall),
                    max_daily_rainfall = VALUES(max_daily_rainfall),
                    total_rainfall = VALUES(total_rainfall),
                    rainy_days = VALUES(rainy_days),
                    updated_at = CURRENT_TIMESTAMP
            ''', (username, username))
            log(f"Monthly data aggregation completed, affected rows: {cursor.rowcount}")

        conn.commit()
        return {"success": True, "message": "Data aggregation successful"}
    except Exception as e:
        log(f"Data aggregation failed: {str(e)}")
        log(traceback.format_exc())
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def get_recent_data(username='admin', period='10min', limit=100):
    """获取最近的数据

    参数:
        username: 用户名，默认为'admin'
        period: 时间粒度，可选值: 'raw', '10min', 'hourly', 'daily', 'monthly'
        limit: 返回的数据条数
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if period == 'raw':
                sql = '''
                    SELECT * FROM rainfall_raw
                    WHERE username = %s
                    ORDER BY timestamp DESC
                    LIMIT %s
                '''
                cursor.execute(sql, (username, limit))
            elif period == '10min':
                sql = '''
                    SELECT * FROM rainfall_10min
                    WHERE username = %s
                    ORDER BY timestamp DESC
                    LIMIT %s
                '''
                cursor.execute(sql, (username, limit))
            elif period == 'hourly':
                sql = '''
                    SELECT * FROM rainfall_hourly
                    WHERE username = %s
                    ORDER BY timestamp DESC
                    LIMIT %s
                '''
                cursor.execute(sql, (username, limit))
            elif period == 'daily':
                sql = '''
                    SELECT * FROM rainfall_daily
                    WHERE username = %s
                    ORDER BY date DESC
                    LIMIT %s
                '''
                cursor.execute(sql, (username, limit))
            elif period == 'monthly':
                sql = '''
                    SELECT * FROM rainfall_monthly
                    WHERE username = %s
                    ORDER BY year DESC, month DESC
                    LIMIT %s
                '''
                cursor.execute(sql, (username, limit))
            else:
                return {"success": False, "error": f"不支持的时间粒度: {period}"}

            result = cursor.fetchall()
            return {"success": True, "data": result}
    except Exception as e:
        log(f"获取数据失败: {str(e)}")
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def get_data_by_timerange(username='admin', period='10min', start_time=None, end_time=None):
    """根据时间范围获取数据

    参数:
        username: 用户名，默认为'admin'
        period: 时间粒度，可选值: 'raw', '10min', 'hourly', 'daily', 'monthly'
        start_time: 开始时间，格式: 'YYYY-MM-DD HH:MM:SS' 或 'YYYY-MM-DD'
        end_time: 结束时间，格式: 'YYYY-MM-DD HH:MM:SS' 或 'YYYY-MM-DD'
    """
    if not start_time:
        # 默认获取最近24小时的数据
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=24)
    elif not end_time:
        # 如果只提供了开始时间，结束时间默认为当前时间
        end_time = datetime.now()

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if period == 'raw':
                sql = '''
                    SELECT * FROM rainfall_raw
                    WHERE username = %s
                    AND timestamp BETWEEN %s AND %s
                    ORDER BY timestamp
                '''
                cursor.execute(sql, (username, start_time, end_time))
            elif period == '10min':
                sql = '''
                    SELECT * FROM rainfall_10min
                    WHERE username = %s
                    AND timestamp BETWEEN %s AND %s
                    ORDER BY timestamp
                '''
                cursor.execute(sql, (username, start_time, end_time))
            elif period == 'hourly':
                sql = '''
                    SELECT * FROM rainfall_hourly
                    WHERE username = %s
                    AND timestamp BETWEEN %s AND %s
                    ORDER BY timestamp
                '''
                cursor.execute(sql, (username, start_time, end_time))
            elif period == 'daily':
                sql = '''
                    SELECT * FROM rainfall_daily
                    WHERE username = %s
                    AND date BETWEEN %s AND %s
                    ORDER BY date
                '''
                cursor.execute(sql, (username, start_time, end_time))
            elif period == 'monthly':
                # 对于月数据，需要特殊处理
                start_year = int(start_time.split('-')[0]) if isinstance(start_time, str) else start_time.year
                start_month = int(start_time.split('-')[1]) if isinstance(start_time, str) else start_time.month
                end_year = int(end_time.split('-')[0]) if isinstance(end_time, str) else end_time.year
                end_month = int(end_time.split('-')[1]) if isinstance(end_time, str) else end_time.month

                sql = '''
                    SELECT * FROM rainfall_monthly
                    WHERE username = %s
                    AND (year > %s OR (year = %s AND month >= %s))
                    AND (year < %s OR (year = %s AND month <= %s))
                    ORDER BY year, month
                '''
                cursor.execute(sql, (username, start_year, start_year, start_month, end_year, end_year, end_month))
            else:
                return {"success": False, "error": f"不支持的时间粒度: {period}"}

            result = cursor.fetchall()
            return {"success": True, "data": result}
    except Exception as e:
        log(f"获取数据失败: {str(e)}")
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def get_current_hour_data(username='admin'):
    """获取当前小时的数据

    参数:
        username: 用户名，默认为'admin'
    """
    now = datetime.now()
    hour_start = now.replace(minute=0, second=0, microsecond=0)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 获取当前小时的原始数据
            sql = '''
                SELECT * FROM rainfall_raw
                WHERE username = %s
                AND timestamp BETWEEN %s AND %s
                ORDER BY timestamp
            '''
            cursor.execute(sql, (username, hour_start, now))
            raw_data = cursor.fetchall()

            # 计算当前小时的累计雨量
            if raw_data:
                # 计算平均雨量
                avg_rainfall = sum(float(item['rainfall_value']) for item in raw_data) / len(raw_data)

                # 计算已过去的时间比例
                minutes_passed = now.minute + (now.second / 60)
                hour_ratio = minutes_passed / 60

                # 估算累计雨量 (平均值 * 已过去的时间比例 * 60分钟)
                total_rainfall = round(float(avg_rainfall) * float(hour_ratio) * 60.0, 1)

                return {
                    "success": True,
                    "data": {
                        "hour": now.hour,
                        "avg_rainfall": round(avg_rainfall, 1),
                        "total_rainfall": total_rainfall,
                        "data_points": len(raw_data),
                        "minutes_passed": round(minutes_passed, 1)
                    }
                }
            else:
                return {
                    "success": True,
                    "data": {
                        "hour": now.hour,
                        "avg_rainfall": 0.0,
                        "total_rainfall": 0.0,
                        "data_points": 0,
                        "minutes_passed": round(now.minute + (now.second / 60), 1)
                    }
                }
    except Exception as e:
        log(f"获取当前小时数据失败: {str(e)}")
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='雨量数据库操作')
    parser.add_argument('--action', choices=['init', 'mock', 'aggregate', 'get_recent', 'get_range', 'get_hour'],
                        required=True, help='执行的操作')
    parser.add_argument('--username', type=str, default='admin', help='用户名，默认为admin')
    parser.add_argument('--days', type=int, default=7, help='生成模拟数据的天数')
    parser.add_argument('--period', choices=['raw', '10min', 'hourly', 'daily', 'monthly'],
                        default='10min', help='数据时间粒度')
    parser.add_argument('--limit', type=int, default=100, help='返回的数据条数')
    parser.add_argument('--start', help='开始时间，格式: YYYY-MM-DD HH:MM:SS 或 YYYY-MM-DD')
    parser.add_argument('--end', help='结束时间，格式: YYYY-MM-DD HH:MM:SS 或 YYYY-MM-DD')

    args = parser.parse_args()

    log(f"执行操作: {args.action}")

    try:
        if args.action == 'init':
            result = init_rainfall_tables()
        elif args.action == 'mock':
            result = generate_mock_data(args.username, args.days)
        elif args.action == 'aggregate':
            result = aggregate_data(args.username)
        elif args.action == 'get_recent':
            result = get_recent_data(args.username, args.period, args.limit)
        elif args.action == 'get_range':
            result = get_data_by_timerange(args.username, args.period, args.start, args.end)
        elif args.action == 'get_hour':
            result = get_current_hour_data(args.username)
        else:
            result = {"success": False, "error": "Unknown operation"}

        # Output result in standard JSON format
        print(json.dumps(result, ensure_ascii=False, default=str))
        sys.stdout.flush()

    except Exception as e:
        log(f"Script execution error: {str(e)}")
        log(traceback.format_exc())
        error_result = {"success": False, "error": f"Script execution error: {str(e)}"}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
