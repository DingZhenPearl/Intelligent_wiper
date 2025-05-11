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
import os

# 设置环境变量，确保Python使用UTF-8编码
os.environ['PYTHONIOENCODING'] = 'utf-8'

# 尝试设置stdout和stderr的编码为UTF-8
try:
    # Python 3.7+
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    else:
        # 兼容旧版本
        if sys.stdout.encoding != 'utf-8':
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        if sys.stderr.encoding != 'utf-8':
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
except Exception as e:
    print(f"无法设置标准输出编码: {e}", file=sys.stderr)

# 添加日志记录
def log(message):
    try:
        # 确保消息是字符串
        if not isinstance(message, str):
            message = str(message)
        # 使用 utf-8 编码输出日志
        print(f"LOG: {message}", file=sys.stderr)
        sys.stderr.flush()  # 确保日志立即输出
    except Exception as e:
        # 如果出现编码错误，尝试使用 ASCII 编码
        print(f"LOG: [编码错误] {str(e)}", file=sys.stderr)
        try:
            # 尝试将消息转换为 ASCII
            ascii_message = message.encode('ascii', 'replace').decode('ascii')
            print(f"LOG: {ascii_message}", file=sys.stderr)
        except:
            # 如果仍然失败，输出一个通用消息
            print("LOG: [无法显示日志消息]", file=sys.stderr)
        sys.stderr.flush()

# 使用与db_service.py相同的数据库配置
db_config = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "mwYgR7#*X2",
    "database": "intelligent_wiper_db"
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
    """初始化雨量数据相关的表结构，如果表不存在则创建，保留现有数据"""
    conn = get_db_connection()
    try:
        # 不再删除现有的表，只在表不存在时创建
        log("初始化雨量数据表，保留现有数据")

        # 创建新的表
        with conn.cursor() as cursor:
            # 创建原始雨量数据表 (5秒一个数据点)
            # 使用IF NOT EXISTS确保不会删除现有数据
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
            # 使用IF NOT EXISTS确保不会删除现有数据
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rainfall_10min (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL COMMENT '用户名',
                    timestamp DATETIME NOT NULL COMMENT '10分钟时间段的开始时间',
                    avg_rainfall DECIMAL(5,1) NOT NULL COMMENT '平均雨量 (mm/h)',
                    max_rainfall DECIMAL(5,1) NOT NULL COMMENT '最大雨量 (mm/h)',
                    min_rainfall DECIMAL(5,1) NOT NULL COMMENT '最小雨量 (mm/h)',
                    dominant_level ENUM('none', 'light', 'medium', 'heavy') NOT NULL COMMENT '主要雨量级别',
                    data_points INT NOT NULL COMMENT '实际数据点数量',
                    expected_points INT NOT NULL DEFAULT 120 COMMENT '应有数据点数量 (10分钟内应有120个5秒点)',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    UNIQUE KEY uk_username_timestamp (username, timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='10分钟聚合雨量数据';
            ''')

            # 检查并添加expected_points列（如果不存在）
            cursor.execute('''
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'rainfall_10min'
                AND COLUMN_NAME = 'expected_points'
            ''')
            result = cursor.fetchone()
            if result and result['count'] == 0:
                log("向rainfall_10min表添加expected_points列")
                cursor.execute('''
                    ALTER TABLE rainfall_10min
                    ADD COLUMN expected_points INT NOT NULL DEFAULT 120 COMMENT '应有数据点数量 (10分钟内应有120个5秒点)' AFTER data_points
                ''')
                log("expected_points列添加成功")

            # 创建小时聚合数据表
            # 使用IF NOT EXISTS确保不会删除现有数据
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
                    data_points INT NOT NULL COMMENT '实际数据点数量',
                    expected_points INT NOT NULL DEFAULT 6 COMMENT '应有数据点数量 (1小时内应有6个10分钟点)',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    UNIQUE KEY uk_username_timestamp (username, timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小时聚合雨量数据';
            ''')

            # 检查并添加expected_points列（如果不存在）
            cursor.execute('''
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'rainfall_hourly'
                AND COLUMN_NAME = 'expected_points'
            ''')
            result = cursor.fetchone()
            if result and result['count'] == 0:
                log("向rainfall_hourly表添加expected_points列")
                cursor.execute('''
                    ALTER TABLE rainfall_hourly
                    ADD COLUMN expected_points INT NOT NULL DEFAULT 6 COMMENT '应有数据点数量 (1小时内应有6个10分钟点)' AFTER data_points
                ''')
                log("expected_points列添加成功")

            # 创建日聚合数据表
            # 使用IF NOT EXISTS确保不会删除现有数据
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
                    data_points INT NOT NULL DEFAULT 0 COMMENT '实际数据点数量',
                    expected_points INT NOT NULL DEFAULT 24 COMMENT '应有数据点数量 (1天内应有24个小时点)',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    UNIQUE KEY uk_username_date (username, date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='日聚合雨量数据';
            ''')

            # 检查并添加data_points和expected_points列（如果不存在）
            cursor.execute('''
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'rainfall_daily'
                AND COLUMN_NAME = 'data_points'
            ''')
            result = cursor.fetchone()
            if result and result['count'] == 0:
                log("向rainfall_daily表添加data_points列")
                cursor.execute('''
                    ALTER TABLE rainfall_daily
                    ADD COLUMN data_points INT NOT NULL DEFAULT 0 COMMENT '实际数据点数量' AFTER rainy_hours
                ''')
                log("data_points列添加成功")

            cursor.execute('''
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'rainfall_daily'
                AND COLUMN_NAME = 'expected_points'
            ''')
            result = cursor.fetchone()
            if result and result['count'] == 0:
                log("向rainfall_daily表添加expected_points列")
                cursor.execute('''
                    ALTER TABLE rainfall_daily
                    ADD COLUMN expected_points INT NOT NULL DEFAULT 24 COMMENT '应有数据点数量 (1天内应有24个小时点)' AFTER data_points
                ''')
                log("expected_points列添加成功")

            # 创建月聚合数据表
            # 使用IF NOT EXISTS确保不会删除现有数据
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
                    data_points INT NOT NULL DEFAULT 0 COMMENT '实际数据点数量',
                    expected_points INT NOT NULL DEFAULT 0 COMMENT '应有数据点数量 (根据月份天数计算)',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    UNIQUE KEY uk_username_year_month (username, year, month)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='月聚合雨量数据';
            ''')

            # 检查并添加data_points和expected_points列（如果不存在）
            cursor.execute('''
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'rainfall_monthly'
                AND COLUMN_NAME = 'data_points'
            ''')
            result = cursor.fetchone()
            if result and result['count'] == 0:
                log("向rainfall_monthly表添加data_points列")
                cursor.execute('''
                    ALTER TABLE rainfall_monthly
                    ADD COLUMN data_points INT NOT NULL DEFAULT 0 COMMENT '实际数据点数量' AFTER rainy_days
                ''')
                log("data_points列添加成功")

            cursor.execute('''
                SELECT COUNT(*) as count
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'rainfall_monthly'
                AND COLUMN_NAME = 'expected_points'
            ''')
            result = cursor.fetchone()
            if result and result['count'] == 0:
                log("向rainfall_monthly表添加expected_points列")
                cursor.execute('''
                    ALTER TABLE rainfall_monthly
                    ADD COLUMN expected_points INT NOT NULL DEFAULT 0 COMMENT '应有数据点数量 (根据月份天数计算)' AFTER data_points
                ''')
                log("expected_points列添加成功")

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
    # 详细输出用户名信息
    log(f"插入原始雨量数据，原始用户名: '{username}', 类型: {type(username)}")

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

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 强制使用传入的用户名，确保数据库中存储的是正确的用户名
            sql = '''
                INSERT INTO rainfall_raw
                (username, timestamp, rainfall_value, rainfall_level, rainfall_percentage)
                VALUES (%s, %s, %s, %s, %s)
            '''
            log(f"执行SQL，参数: username='{username}', timestamp={timestamp}, rainfall_value={rainfall_value}, rainfall_level={rainfall_level}, rainfall_percentage={rainfall_percentage}")

            # 再次确认用户名
            log(f"最终插入数据库的用户名: '{username}'")
            cursor.execute(sql, (username, timestamp, rainfall_value, rainfall_level, rainfall_percentage))
        conn.commit()
        log(f"原始雨量数据插入成功，用户名: '{username}'")
        return {"success": True, "message": "原始雨量数据插入成功"}
    except Exception as e:
        log(f"原始雨量数据插入失败: {str(e)}, 用户名: '{username}'")
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def get_rainfall_level(value):
    """根据雨量值获取雨量级别

    各个雨量级别的范围：
    - none: < 0.3 mm/h
    - light: 0.3-2.2 mm/h
    - medium: 2.2-4.0 mm/h
    - heavy: 4.0-33 mm/h

    各个级别的百分比范围均匀分布：
    - none: 0-25%
    - light: 26-50%
    - medium: 51-75%
    - heavy: 76-100%
    """
    if value < 0.3:
        # 将范围 0-0.3 映射到 0-25
        percentage = round(min(value, 0.3) * 25 / 0.3)
        return 'none', percentage
    elif value >= 0.3 and value <= 2.2:
        # 将范围 0.3-2.2 映射到 26-50
        percentage = round(26 + (value - 0.3) * (50 - 26) / (2.2 - 0.3))
        return 'light', percentage
    elif value > 2.2 and value <= 4.0:
        # 将范围 2.2-4.0 映射到 51-75
        percentage = round(51 + (value - 2.2) * (75 - 51) / (4.0 - 2.2))
        return 'medium', percentage
    else:
        # 将范围 4.0-33 映射到 76-100
        percentage = round(76 + (min(value, 33) - 4.0) * (100 - 76) / (33 - 4.0))
        return 'heavy', percentage

def generate_mock_data(username='admin', days=7):
    """初始化一个起始数据点，不再清除现有数据

    参数:
        username: 用户名，默认为'admin'
        days: 参数保留但不再使用，仅用于兼容现有API
    """
    # 详细输出用户名信息
    log(f"初始化模拟数据，原始用户名: '{username}', 类型: {type(username)}")

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

    conn = get_db_connection()
    try:
        # 不再清除现有数据，保留历史数据
        log(f"初始化模拟数据，保留用户 {username} 的历史数据")

        # 生成一个新的数据点，作为起始点
        now = datetime.now()

        # 随机选择一个雨量级别，概率相等
        rain_type = random.choice(['none', 'light', 'medium', 'heavy'])

        # 根据选择的级别生成对应范围内的随机值
        if rain_type == 'none':
            rainfall_value = round(random.uniform(0, 0.29), 1)
        elif rain_type == 'light':
            rainfall_value = round(random.uniform(0.3, 2.2), 1)
        elif rain_type == 'medium':
            rainfall_value = round(random.uniform(2.21, 4.0), 1)
        else:  # heavy
            rainfall_value = round(random.uniform(4.01, 33.0), 1)

        level, percentage = get_rainfall_level(rainfall_value)

        log(f"生成新的起始数据点: {rainfall_value} mm/h ({level}, {percentage}%), 用户名: {username}")

        # 插入原始数据表
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO rainfall_raw (username, timestamp, rainfall_value, rainfall_level, rainfall_percentage)
                VALUES (%s, %s, %s, %s, %s)
            """, (username, now, rainfall_value, level, percentage))

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
    # 详细输出用户名信息
    log(f"聚合数据，原始用户名: '{username}', 类型: {type(username)}")

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

    conn = get_db_connection()
    try:
        # 检查是否有原始数据
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT COUNT(*) as count FROM rainfall_raw
                WHERE username = %s
            ''', (username,))
            result = cursor.fetchone()
            raw_count = result['count'] if result else 0
            log(f"原始数据点数量: {raw_count}")

            if raw_count == 0:
                log(f"没有原始数据点，跳过聚合")
                return {"success": True, "message": "No raw data points to aggregate"}

        # 1. 聚合到10分钟表 - 修改后的逻辑
        log(f"开始聚合10分钟数据...")
        with conn.cursor() as cursor:
            try:
                # 先查询可能被聚合的数据
                cursor.execute('''
                    SELECT
                        DATE_FORMAT(timestamp, '%%Y-%%m-%%d %%H:%%i:00') - INTERVAL MINUTE(timestamp) %% 10 MINUTE as time_slot,
                        COUNT(*) as count
                    FROM rainfall_raw
                    WHERE username = %s
                    GROUP BY time_slot
                ''', (username,))
                time_slots = cursor.fetchall()
                log(f"找到 {len(time_slots)} 个10分钟时间段需要聚合")

                # 对每个10分钟时间段单独处理
                for slot in time_slots:
                    time_slot = slot['time_slot']
                    actual_count = slot['count']

                    # 计算这10分钟内应该有的所有5秒原始点数量
                    # 10分钟 = 600秒，每5秒一个点，应该有120个点
                    expected_points = 120

                    log(f"处理10分钟时间段: {time_slot}, 实际数据点: {actual_count}, 应有数据点: {expected_points}")

                    # 查询该时间段内的实际数据
                    cursor.execute('''
                        SELECT
                            SUM(rainfall_value) as total_rainfall,
                            MAX(rainfall_value) as max_rainfall,
                            MIN(rainfall_value) as min_rainfall,
                            COUNT(*) as actual_points
                        FROM rainfall_raw
                        WHERE username = %s
                        AND timestamp >= %s
                        AND timestamp < %s + INTERVAL 10 MINUTE
                    ''', (username, time_slot, time_slot))

                    result = cursor.fetchone()

                    if result and result['actual_points'] > 0:
                        total_rainfall = result['total_rainfall'] or 0
                        max_rainfall = result['max_rainfall'] or 0
                        min_rainfall = result['min_rainfall'] or 0
                        actual_points = result['actual_points']

                        # 计算平均值，使用应有的点数作为分母
                        # 确保所有值都是浮点数，避免decimal和float混合计算
                        total_rainfall_float = float(total_rainfall)
                        expected_points_float = float(expected_points)

                        # 使用浮点数计算
                        avg_rainfall = round(total_rainfall_float / expected_points_float, 1)

                        # 记录详细的计算过程，用于调试
                        log(f"  10分钟聚合 - 强制使用预期点数计算平均值: {total_rainfall} / {expected_points} = {round(float(total_rainfall) / float(expected_points), 3)}")
                        log(f"  10分钟聚合 - 验证平均值: 原始值=[{total_rainfall}], 平均值={avg_rainfall}")
                        log(f"  总雨量: {total_rainfall}, 实际点数: {actual_points}, 预期点数: {expected_points}, 平均值: {avg_rainfall}")
                        log(f"  10分钟聚合 - 原始点值: [{total_rainfall}]")
                        log(f"  10分钟聚合 - 计算平均值: {total_rainfall} / {expected_points} = {avg_rainfall}")

                        log(f"10分钟段 {time_slot}: 总雨量={total_rainfall}, 平均雨量={avg_rainfall}, 实际点数={actual_points}, 应有点数={expected_points}")

                        # 获取主要雨量级别
                        cursor.execute('''
                            SELECT rainfall_level, COUNT(*) as level_count
                            FROM rainfall_raw
                            WHERE username = %s
                            AND timestamp >= %s
                            AND timestamp < %s + INTERVAL 10 MINUTE
                            GROUP BY rainfall_level
                            ORDER BY level_count DESC
                            LIMIT 1
                        ''', (username, time_slot, time_slot))

                        level_result = cursor.fetchone()
                        dominant_level = level_result['rainfall_level'] if level_result else 'none'

                        # 插入或更新10分钟聚合数据
                        cursor.execute('''
                            INSERT INTO rainfall_10min
                            (username, timestamp, avg_rainfall, max_rainfall, min_rainfall, dominant_level, data_points, expected_points)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                avg_rainfall = VALUES(avg_rainfall),
                                max_rainfall = VALUES(max_rainfall),
                                min_rainfall = VALUES(min_rainfall),
                                dominant_level = VALUES(dominant_level),
                                data_points = VALUES(data_points),
                                expected_points = VALUES(expected_points),
                                updated_at = CURRENT_TIMESTAMP
                        ''', (
                            username, time_slot, avg_rainfall, max_rainfall, min_rainfall,
                            dominant_level, actual_points, expected_points
                        ))

                        log(f"10分钟数据聚合完成: {time_slot}, 平均雨量={avg_rainfall}")

                log(f"所有10分钟数据聚合完成，处理了 {len(time_slots)} 个时间段")
            except Exception as e:
                log(f"10分钟数据聚合错误: {str(e)}")
                log(traceback.format_exc())
                raise

        # 2. 聚合到小时表 - 修改后的逻辑
        log(f"开始聚合小时数据...")
        with conn.cursor() as cursor:
            try:
                # 先检查10分钟表中是否有数据
                cursor.execute('''
                    SELECT COUNT(*) as count FROM rainfall_10min
                    WHERE username = %s
                ''', (username,))
                result = cursor.fetchone()
                ten_min_count = result['count'] if result else 0
                log(f"10分钟数据点数量: {ten_min_count}")

                if ten_min_count == 0:
                    log(f"没有10分钟数据点，跳过小时聚合")
                else:
                    # 先查询可能被聚合的数据
                    cursor.execute('''
                        SELECT
                            DATE_FORMAT(timestamp, '%%Y-%%m-%%d %%H:00:00') as hour_slot,
                            COUNT(*) as count
                        FROM rainfall_10min
                        WHERE username = %s
                        GROUP BY hour_slot
                    ''', (username,))
                    hour_slots = cursor.fetchall()
                    log(f"找到 {len(hour_slots)} 个小时时间段需要聚合")

                    # 对每个小时时间段单独处理
                    for slot in hour_slots:
                        hour_slot = slot['hour_slot']
                        actual_count = slot['count']

                        # 计算这1小时内应该有的所有10分钟点数量
                        # 1小时 = 60分钟，每10分钟一个点，应该有6个点
                        expected_points = 6

                        log(f"处理小时时间段: {hour_slot}, 实际数据点: {actual_count}, 应有数据点: {expected_points}")

                        # 查询该时间段内的实际数据
                        cursor.execute('''
                            SELECT
                                SUM(avg_rainfall * data_points) as total_rainfall_value,
                                MAX(max_rainfall) as max_rainfall,
                                MIN(min_rainfall) as min_rainfall,
                                SUM(data_points) as total_data_points
                            FROM rainfall_10min
                            WHERE username = %s
                            AND timestamp >= %s
                            AND timestamp < %s + INTERVAL 1 HOUR
                        ''', (username, hour_slot, hour_slot))

                        result = cursor.fetchone()

                        if result and result['total_data_points'] > 0:
                            total_rainfall_value = result['total_rainfall_value'] or 0
                            max_rainfall = result['max_rainfall'] or 0
                            min_rainfall = result['min_rainfall'] or 0
                            # 获取实际数据点数量，但不使用该变量（仅用于日志记录）
                            actual_data_points = result['total_data_points'] or 0

                            # 计算平均值，使用应有的点数作为分母
                            # 这里我们需要考虑每个10分钟段内的实际数据点数量
                            # 计算每个10分钟段的原始数据点总数
                            total_expected_raw_points = expected_points * 120  # 6个10分钟段 * 每段120个5秒点

                            # 计算平均雨量 (mm/h)
                            # 这里我们需要考虑10分钟段的原始数据
                            # 10分钟段的平均雨量已经考虑了缺失的5秒点
                            # 所以我们只需要考虑缺失的10分钟段

                            # 查询该小时内的10分钟数据点
                            cursor.execute('''
                                SELECT avg_rainfall
                                FROM rainfall_10min
                                WHERE username = %s
                                AND timestamp >= %s
                                AND timestamp < %s + INTERVAL 1 HOUR
                                ORDER BY timestamp
                            ''', (username, hour_slot, hour_slot))

                            ten_min_data = cursor.fetchall()
                            ten_min_values = [float(r['avg_rainfall']) for r in ten_min_data] if ten_min_data else []

                            # 修改计算方式 - 使用10分钟点的总和除以6（一小时有6个10分钟段）
                            if ten_min_values:
                                # 计算10分钟点的总和，然后除以6（一小时有6个10分钟段）
                                # 无论实际有多少个10分钟点，都除以6，缺失的点视为0
                                avg_rainfall = round(sum(ten_min_values) / 6, 1)

                                # 计算累计雨量 - 每个10分钟段的累计雨量 = 10分钟平均雨量(mm/h) * (10/60)小时
                                # 小时累计雨量 = 所有10分钟段的累计雨量之和
                                total_rainfall = round(sum([val * (10/60) for val in ten_min_values]), 1)
                            else:
                                avg_rainfall = 0.0
                                total_rainfall = 0.0

                            # 记录详细的计算过程，用于调试
                            log(f"  小时聚合 - 10分钟点值: {ten_min_values}")
                            log(f"  小时聚合 - 平均值: 10分钟点总和 / 6 = {sum(ten_min_values) if ten_min_values else 0} / 6 = {avg_rainfall}")
                            log(f"  小时聚合 - 累计雨量: 10分钟点的累计雨量总和 = {total_rainfall}")
                            log(f"  实际点数: {actual_count}, 预期点数: {expected_points}")

                            log(f"小时段 {hour_slot}: 总雨量值={total_rainfall_value}, 平均雨量={avg_rainfall}, 累计雨量={total_rainfall}, 实际10分钟点数={actual_count}, 应有10分钟点数={expected_points}, 实际原始点数={actual_data_points}")

                            # 获取主要雨量级别
                            cursor.execute('''
                                SELECT dominant_level, COUNT(*) as level_count
                                FROM rainfall_10min
                                WHERE username = %s
                                AND timestamp >= %s
                                AND timestamp < %s + INTERVAL 1 HOUR
                                GROUP BY dominant_level
                                ORDER BY level_count DESC
                                LIMIT 1
                            ''', (username, hour_slot, hour_slot))

                            level_result = cursor.fetchone()
                            dominant_level = level_result['dominant_level'] if level_result else 'none'

                            # 插入或更新小时聚合数据
                            cursor.execute('''
                                INSERT INTO rainfall_hourly
                                (username, timestamp, avg_rainfall, max_rainfall, min_rainfall, total_rainfall, dominant_level, data_points, expected_points)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON DUPLICATE KEY UPDATE
                                    avg_rainfall = VALUES(avg_rainfall),
                                    max_rainfall = VALUES(max_rainfall),
                                    min_rainfall = VALUES(min_rainfall),
                                    total_rainfall = VALUES(total_rainfall),
                                    dominant_level = VALUES(dominant_level),
                                    data_points = VALUES(data_points),
                                    expected_points = VALUES(expected_points),
                                    updated_at = CURRENT_TIMESTAMP
                            ''', (
                                username, hour_slot, avg_rainfall, max_rainfall, min_rainfall,
                                total_rainfall, dominant_level, actual_count, expected_points
                            ))

                            log(f"小时数据聚合完成: {hour_slot}, 平均雨量={avg_rainfall}, 累计雨量={total_rainfall}")

                    log(f"所有小时数据聚合完成，处理了 {len(hour_slots)} 个时间段")
            except Exception as e:
                log(f"小时数据聚合错误: {str(e)}")
                log(traceback.format_exc())
                # 继续执行其他聚合，不抛出异常

        # 3. 聚合到日表 - 修改后的逻辑
        log(f"开始聚合日数据...")
        with conn.cursor() as cursor:
            try:
                # 先检查小时表中是否有数据
                cursor.execute('''
                    SELECT COUNT(*) as count FROM rainfall_hourly
                    WHERE username = %s
                ''', (username,))
                result = cursor.fetchone()
                hourly_count = result['count'] if result else 0
                log(f"小时数据点数量: {hourly_count}")

                if hourly_count == 0:
                    log(f"没有小时数据点，跳过日聚合")
                else:
                    # 先查询可能被聚合的数据
                    cursor.execute('''
                        SELECT
                            DATE(timestamp) as day_slot,
                            COUNT(*) as count
                        FROM rainfall_hourly
                        WHERE username = %s
                        GROUP BY day_slot
                    ''', (username,))
                    day_slots = cursor.fetchall()
                    log(f"找到 {len(day_slots)} 个日期需要聚合")

                    # 对每个日期单独处理
                    for slot in day_slots:
                        day_slot = slot['day_slot']
                        actual_count = slot['count']

                        # 计算这1天内应该有的所有小时点数量
                        # 1天 = 24小时，每小时一个点，应该有24个点
                        expected_points = 24

                        log(f"处理日期: {day_slot}, 实际数据点: {actual_count}, 应有数据点: {expected_points}")

                        # 查询该日期内的实际数据
                        cursor.execute('''
                            SELECT
                                SUM(avg_rainfall * data_points) as total_rainfall_value,
                                MAX(max_rainfall) as max_rainfall,
                                MIN(min_rainfall) as min_rainfall,
                                SUM(data_points) as total_data_points,
                                SUM(total_rainfall) as day_total_rainfall,
                                SUM(CASE WHEN avg_rainfall >= 0.3 THEN 1 ELSE 0 END) as rainy_hours
                            FROM rainfall_hourly
                            WHERE username = %s
                            AND DATE(timestamp) = %s
                        ''', (username, day_slot))

                        result = cursor.fetchone()

                        if result:
                            total_rainfall_value = result['total_rainfall_value'] or 0
                            max_rainfall = result['max_rainfall'] or 0
                            min_rainfall = result['min_rainfall'] or 0
                            # 获取实际数据点数量，用于日志记录
                            actual_data_points = result['total_data_points'] or 0
                            day_total_rainfall = result['day_total_rainfall'] or 0
                            rainy_hours = result['rainy_hours'] or 0

                            # 计算平均值，使用应有的点数作为分母
                            # 这里我们需要考虑每个小时内的实际数据点数量
                            # 计算每个小时的原始数据点总数
                            total_expected_raw_points = expected_points * 6 * 120  # 24小时 * 每小时6个10分钟段 * 每段120个5秒点

                            # 计算平均雨量 (mm/h)
                            if total_expected_raw_points > 0:
                                # 这里我们需要考虑小时段的原始数据
                                # 小时段的平均雨量已经考虑了缺失的10分钟点和5秒点
                                # 所以我们只需要考虑缺失的小时段
                                if actual_count > 0:
                                    # 使用小时聚合数据的平均雨量，除以24小时
                                    # 小时聚合数据的平均雨量已经考虑了缺失的10分钟点和5秒点
                                    # 所以我们需要计算：小时平均雨量 * 实际小时数 / 24小时

                                    # 确保所有值都是浮点数，避免decimal和float混合计算
                                    day_total_rainfall_float = float(day_total_rainfall)
                                    expected_points_float = float(expected_points)

                                    # 使用浮点数计算
                                    avg_rainfall = round(day_total_rainfall_float / expected_points_float, 1)

                                    # 记录详细的计算过程，用于调试
                                    log(f"  日聚合 - 计算平均值: {day_total_rainfall} / {expected_points} = {avg_rainfall}")
                                else:
                                    avg_rainfall = 0.0
                            else:
                                avg_rainfall = 0.0

                            # 累计雨量保持不变，是各小时累计雨量的总和
                            total_rainfall = round(day_total_rainfall, 1)

                            log(f"日期 {day_slot}: 总雨量值={total_rainfall_value}, 平均雨量={avg_rainfall}, 累计雨量={total_rainfall}, 实际小时点数={actual_count}, 应有小时点数={expected_points}, 实际原始点数={actual_data_points}, 有雨小时数={rainy_hours}")

                            # 插入或更新日聚合数据
                            cursor.execute('''
                                INSERT INTO rainfall_daily
                                (username, date, avg_rainfall, max_rainfall, min_rainfall, total_rainfall, rainy_hours, data_points, expected_points)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON DUPLICATE KEY UPDATE
                                    avg_rainfall = VALUES(avg_rainfall),
                                    max_rainfall = VALUES(max_rainfall),
                                    min_rainfall = VALUES(min_rainfall),
                                    total_rainfall = VALUES(total_rainfall),
                                    rainy_hours = VALUES(rainy_hours),
                                    data_points = VALUES(data_points),
                                    expected_points = VALUES(expected_points),
                                    updated_at = CURRENT_TIMESTAMP
                            ''', (
                                username, day_slot, avg_rainfall, max_rainfall, min_rainfall,
                                total_rainfall, rainy_hours, actual_count, expected_points
                            ))

                            log(f"日数据聚合完成: {day_slot}, 平均雨量={avg_rainfall}, 累计雨量={total_rainfall}")

                    log(f"所有日数据聚合完成，处理了 {len(day_slots)} 个日期")
            except Exception as e:
                log(f"日数据聚合错误: {str(e)}")
                log(traceback.format_exc())
                # 继续执行其他聚合，不抛出异常

        # 4. 聚合到月表 - 修改后的逻辑
        log(f"开始聚合月数据...")
        with conn.cursor() as cursor:
            try:
                # 先检查日表中是否有数据
                cursor.execute('''
                    SELECT COUNT(*) as count FROM rainfall_daily
                    WHERE username = %s
                ''', (username,))
                result = cursor.fetchone()
                daily_count = result['count'] if result else 0
                log(f"日数据点数量: {daily_count}")

                if daily_count == 0:
                    log(f"没有日数据点，跳过月聚合")
                else:
                    # 先查询可能被聚合的数据
                    cursor.execute('''
                        SELECT
                            YEAR(date) as year_val,
                            MONTH(date) as month_val,
                            COUNT(*) as count
                        FROM rainfall_daily
                        WHERE username = %s
                        GROUP BY year_val, month_val
                    ''', (username,))
                    month_slots = cursor.fetchall()
                    log(f"找到 {len(month_slots)} 个月份需要聚合")

                    # 对每个月份单独处理
                    for slot in month_slots:
                        year_val = slot['year_val']
                        month_val = slot['month_val']
                        actual_count = slot['count']

                        # 计算这个月应该有的天数
                        # 使用calendar模块获取月份的天数
                        import calendar
                        days_in_month = calendar.monthrange(year_val, month_val)[1]
                        expected_points = days_in_month

                        log(f"处理月份: {year_val}-{month_val}, 实际数据点: {actual_count}, 应有数据点: {expected_points}")

                        # 查询该月份内的实际数据
                        cursor.execute('''
                            SELECT
                                SUM(total_rainfall) as month_total_rainfall,
                                AVG(total_rainfall) as avg_daily_rainfall,
                                MAX(total_rainfall) as max_daily_rainfall,
                                SUM(CASE WHEN total_rainfall >= 0.3 THEN 1 ELSE 0 END) as rainy_days,
                                SUM(data_points) as total_data_points
                            FROM rainfall_daily
                            WHERE username = %s
                            AND YEAR(date) = %s
                            AND MONTH(date) = %s
                        ''', (username, year_val, month_val))

                        result = cursor.fetchone()

                        if result:
                            month_total_rainfall = result['month_total_rainfall'] or 0
                            avg_daily_rainfall = result['avg_daily_rainfall'] or 0
                            max_daily_rainfall = result['max_daily_rainfall'] or 0
                            rainy_days = result['rainy_days'] or 0
                            # 获取实际数据点数量，用于日志记录
                            actual_data_points = result['total_data_points'] or 0

                            # 月聚合保持原有逻辑，使用各天累计雨量的总和
                            total_rainfall = round(month_total_rainfall, 1)

                            # 平均日雨量，考虑应有的天数
                            if expected_points > 0:
                                # 如果实际天数少于应有天数，将缺少的天视为0
                                if actual_count < expected_points:
                                    # 调整平均值计算，将缺少的天视为0
                                    # 确保所有值都是浮点数，避免decimal和float混合计算
                                    month_total_rainfall_float = float(month_total_rainfall)
                                    expected_points_float = float(expected_points)

                                    # 使用浮点数计算
                                    avg_daily_rainfall = round(month_total_rainfall_float / expected_points_float, 1)

                                    # 记录详细的计算过程，用于调试
                                    log(f"  月聚合 - 计算平均值: {month_total_rainfall} / {expected_points} = {avg_daily_rainfall}")
                                else:
                                    # 如果实际天数等于或大于应有天数，使用原有平均值
                                    avg_daily_rainfall = round(avg_daily_rainfall, 1)
                            else:
                                avg_daily_rainfall = 0.0

                            log(f"月份 {year_val}-{month_val}: 总雨量={total_rainfall}, 平均日雨量={avg_daily_rainfall}, 最大日雨量={max_daily_rainfall}, 实际天数={actual_count}, 应有天数={expected_points}, 实际原始点数={actual_data_points}, 有雨天数={rainy_days}")

                            # 插入或更新月聚合数据
                            cursor.execute('''
                                INSERT INTO rainfall_monthly
                                (username, year, month, avg_daily_rainfall, max_daily_rainfall, total_rainfall, rainy_days, data_points, expected_points)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON DUPLICATE KEY UPDATE
                                    avg_daily_rainfall = VALUES(avg_daily_rainfall),
                                    max_daily_rainfall = VALUES(max_daily_rainfall),
                                    total_rainfall = VALUES(total_rainfall),
                                    rainy_days = VALUES(rainy_days),
                                    data_points = VALUES(data_points),
                                    expected_points = VALUES(expected_points),
                                    updated_at = CURRENT_TIMESTAMP
                            ''', (
                                username, year_val, month_val, avg_daily_rainfall, max_daily_rainfall,
                                total_rainfall, rainy_days, actual_count, expected_points
                            ))

                            log(f"月数据聚合完成: {year_val}-{month_val}, 平均日雨量={avg_daily_rainfall}, 累计雨量={total_rainfall}")

                    log(f"所有月数据聚合完成，处理了 {len(month_slots)} 个月份")
            except Exception as e:
                log(f"月数据聚合错误: {str(e)}")
                log(traceback.format_exc())
                # 继续执行，不抛出异常

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

        # Output result in standard JSON format with UTF-8 encoding
        try:
            json_output = json.dumps(result, ensure_ascii=False, default=str)
            print(json_output)
            sys.stdout.flush()
        except Exception as json_err:
            log(f"JSON序列化错误: {str(json_err)}")
            # 尝试使用ASCII编码输出
            print(json.dumps(result, ensure_ascii=True, default=str))
            sys.stdout.flush()

    except Exception as e:
        log(f"脚本执行错误: {str(e)}")
        log(traceback.format_exc())
        error_result = {"success": False, "error": f"脚本执行错误: {str(e)}"}
        try:
            print(json.dumps(error_result, ensure_ascii=False))
        except:
            # 如果UTF-8编码失败，使用ASCII编码
            print(json.dumps(error_result, ensure_ascii=True))
        sys.stdout.flush()
