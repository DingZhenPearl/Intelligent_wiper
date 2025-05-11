#!/usr/bin/env python
# -*- coding: utf-8 -*-

import pymysql
import sys

# 数据库配置
db_config = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "mwYgR7#*X2",
    "database": "intelligent_wiper_db"
}

def log(message):
    print(f"LOG: {message}", file=sys.stderr)
    sys.stderr.flush()

def get_db_connection():
    """获取数据库连接"""
    try:
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
        raise

def fix_hourly_data(username='admin'):
    """修复小时聚合数据"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 获取所有小时时间段
            cursor.execute('''
                SELECT timestamp
                FROM rainfall_hourly
                WHERE username = %s
            ''', (username,))
            hour_slots = cursor.fetchall()
            log(f"找到 {len(hour_slots)} 个小时时间段需要修复")

            # 对每个小时时间段单独处理
            for slot in hour_slots:
                hour_slot = slot['timestamp']

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

                if ten_min_values:
                    # 计算10分钟点的总和，然后除以6（一小时有6个10分钟段）
                    # 无论实际有多少个10分钟点，都除以6，缺失的点视为0
                    avg_rainfall = round(sum(ten_min_values) / 6, 1)

                    # 计算累计雨量 - 每个10分钟段的累计雨量 = 10分钟平均雨量(mm/h) * (10/60)小时
                    # 小时累计雨量 = 所有10分钟段的累计雨量之和
                    total_rainfall = round(sum([val * (10/60) for val in ten_min_values]), 1)

                    log(f"小时段 {hour_slot}: 10分钟点值={ten_min_values}, 新平均雨量={sum(ten_min_values)}/6={avg_rainfall}, 新累计雨量={total_rainfall}")

                    # 更新小时聚合数据 - 使用参数化查询
                    update_sql = '''
                        UPDATE rainfall_hourly
                        SET avg_rainfall = %s, total_rainfall = %s
                        WHERE username = %s AND id = %s
                    '''

                    # 先查询ID
                    cursor.execute('''
                        SELECT id FROM rainfall_hourly
                        WHERE username = %s AND timestamp = %s
                    ''', (username, hour_slot))

                    id_result = cursor.fetchone()
                    if id_result:
                        record_id = id_result['id']
                        log(f"找到记录ID: {record_id}")

                        # 执行更新
                        cursor.execute(update_sql, (avg_rainfall, total_rainfall, username, record_id))
                        log(f"执行SQL: UPDATE rainfall_hourly SET avg_rainfall = {avg_rainfall}, total_rainfall = {total_rainfall} WHERE username = '{username}' AND id = {record_id}")

                    log(f"小时数据修复完成: {hour_slot}, 平均雨量={avg_rainfall}, 累计雨量={total_rainfall}")
                else:
                    log(f"小时段 {hour_slot} 没有10分钟数据点，跳过")

        conn.commit()
        log("所有小时数据修复完成")
        return {"success": True, "message": "Hourly data fixed successfully"}
    except Exception as e:
        log(f"修复小时数据失败: {str(e)}")
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

if __name__ == "__main__":
    result = fix_hourly_data()
    print(result)
