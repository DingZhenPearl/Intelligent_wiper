#!/usr/bin/env python
# -*- coding: utf-8 -*-

import pymysql

# 数据库配置
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
        connection = pymysql.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database'],
            port=db_config['port'],
            cursorclass=pymysql.cursors.DictCursor
        )
        print("Database connection successful")
        return connection
    except pymysql.Error as e:
        print(f"Database connection error: {str(e)}")
        raise

def check_table_structure(table_name):
    """检查表结构"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"DESCRIBE {table_name}")
            results = cursor.fetchall()
            print(f"\n{table_name} 表结构:")
            for row in results:
                print(f"字段: {row['Field']}, 类型: {row['Type']}, 可空: {row['Null']}, 键: {row['Key']}, 默认值: {row['Default']}")
    except Exception as e:
        print(f"Error checking table structure: {str(e)}")
    finally:
        conn.close()

def check_table_data(table_name, limit=5):
    """检查表数据"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
            results = cursor.fetchall()
            print(f"\n{table_name} 表数据 (前{limit}条):")
            for row in results:
                print(row)
    except Exception as e:
        print(f"Error checking table data: {str(e)}")
    finally:
        conn.close()

if __name__ == "__main__":
    # 检查小时聚合表
    check_table_structure("rainfall_hourly")
    check_table_data("rainfall_hourly")
    
    # 检查10分钟聚合表
    check_table_structure("rainfall_10min")
    check_table_data("rainfall_10min")
