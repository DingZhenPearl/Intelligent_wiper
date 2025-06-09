#!/usr/bin/env python3
"""
数据库升级脚本
将现有的users表升级为支持设备绑定的扩展版本
"""

import pymysql
import sys
import traceback

# 数据库配置
db_config = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "mwYgR7#*X2",
    "database": "intelligent_wiper_db"
}

def log(message):
    print(f"LOG: {message}")
    sys.stdout.flush()

def get_db_connection():
    try:
        connection = pymysql.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database'],
            port=db_config['port'],
            cursorclass=pymysql.cursors.DictCursor
        )
        return connection
    except Exception as e:
        log(f"数据库连接失败: {str(e)}")
        raise

def check_column_exists(cursor, table_name, column_name):
    """检查表中是否存在指定列"""
    cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE '{column_name}'")
    return cursor.fetchone() is not None

def upgrade_users_table():
    """升级users表结构"""
    log("开始升级users表结构...")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 检查并添加设备激活相关字段
            device_fields = [
                ("activation_code", "VARCHAR(20) NULL"),
                ("onenet_device_id", "VARCHAR(50) NULL"),
                ("onenet_device_name", "VARCHAR(100) NULL"),
                ("device_key", "TEXT NULL"),
                ("product_id", "VARCHAR(20) DEFAULT '66eIb47012'"),
                ("serial_number", "VARCHAR(50) NULL"),
                ("device_model", "VARCHAR(100) DEFAULT '智能雨刷设备'"),
                ("firmware_version", "VARCHAR(20) DEFAULT 'v2.0'"),
            ]
            
            for field_name, field_definition in device_fields:
                if not check_column_exists(cursor, 'users', field_name):
                    sql = f"ALTER TABLE users ADD COLUMN {field_name} {field_definition}"
                    log(f"添加字段: {field_name}")
                    cursor.execute(sql)
                else:
                    log(f"字段已存在: {field_name}")
            
            # 检查并添加硬件绑定相关字段
            hardware_fields = [
                ("hardware_mac", "VARCHAR(17) NULL"),
                ("hardware_serial", "VARCHAR(50) NULL"),
                ("hardware_identifier", "VARCHAR(100) NULL"),
            ]
            
            for field_name, field_definition in hardware_fields:
                if not check_column_exists(cursor, 'users', field_name):
                    sql = f"ALTER TABLE users ADD COLUMN {field_name} {field_definition}"
                    log(f"添加字段: {field_name}")
                    cursor.execute(sql)
                else:
                    log(f"字段已存在: {field_name}")
            
            # 检查并添加状态和时间字段
            status_fields = [
                ("device_status", "ENUM('not_activated', 'virtual_only', 'hardware_bound', 'both_active') DEFAULT 'not_activated'"),
                ("activated_at", "TIMESTAMP NULL"),
                ("last_hardware_access", "TIMESTAMP NULL"),
                ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            ]
            
            for field_name, field_definition in status_fields:
                if not check_column_exists(cursor, 'users', field_name):
                    sql = f"ALTER TABLE users ADD COLUMN {field_name} {field_definition}"
                    log(f"添加字段: {field_name}")
                    cursor.execute(sql)
                else:
                    log(f"字段已存在: {field_name}")
            
            # 添加索引
            indexes = [
                ("idx_activation_code", "activation_code"),
                ("idx_onenet_device_id", "onenet_device_id"),
                ("idx_hardware_mac", "hardware_mac"),
                ("idx_device_status", "device_status"),
            ]
            
            for index_name, column_name in indexes:
                try:
                    cursor.execute(f"SHOW INDEX FROM users WHERE Key_name = '{index_name}'")
                    if not cursor.fetchone():
                        sql = f"ALTER TABLE users ADD INDEX {index_name} ({column_name})"
                        log(f"添加索引: {index_name}")
                        cursor.execute(sql)
                    else:
                        log(f"索引已存在: {index_name}")
                except Exception as e:
                    log(f"添加索引 {index_name} 失败: {str(e)}")
        
        conn.commit()
        log("users表升级完成")
        return True
        
    except Exception as e:
        conn.rollback()
        log(f"升级users表失败: {str(e)}")
        log(traceback.format_exc())
        return False
    finally:
        conn.close()

def create_hardware_access_logs_table():
    """创建硬件访问日志表"""
    log("创建硬件访问日志表...")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 检查表是否已存在
            cursor.execute("SHOW TABLES LIKE 'hardware_access_logs'")
            if cursor.fetchone():
                log("hardware_access_logs表已存在")
                return True
            
            # 创建表
            create_sql = '''
                CREATE TABLE hardware_access_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    username VARCHAR(50) NOT NULL,
                    hardware_identifier VARCHAR(100) NULL,
                    access_ip VARCHAR(45) NULL,
                    request_type ENUM('get_credentials', 'status_update', 'heartbeat') DEFAULT 'get_credentials',
                    response_status ENUM('success', 'failed', 'unauthorized') DEFAULT 'success',
                    access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    request_details TEXT NULL,
                    response_details TEXT NULL,
                    
                    INDEX idx_user_id (user_id),
                    INDEX idx_username (username),
                    INDEX idx_access_time (access_time),
                    INDEX idx_hardware_identifier (hardware_identifier),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            '''
            
            cursor.execute(create_sql)
            log("hardware_access_logs表创建成功")
        
        conn.commit()
        return True
        
    except Exception as e:
        conn.rollback()
        log(f"创建hardware_access_logs表失败: {str(e)}")
        log(traceback.format_exc())
        return False
    finally:
        conn.close()

def verify_upgrade():
    """验证升级结果"""
    log("验证数据库升级结果...")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 检查users表结构
            cursor.execute("DESCRIBE users")
            users_columns = [row['Field'] for row in cursor.fetchall()]
            log(f"users表字段: {', '.join(users_columns)}")
            
            # 检查必要字段是否存在
            required_fields = [
                'activation_code', 'onenet_device_id', 'onenet_device_name',
                'device_key', 'product_id', 'serial_number', 'device_model',
                'firmware_version', 'hardware_mac', 'hardware_serial',
                'hardware_identifier', 'device_status', 'activated_at',
                'last_hardware_access', 'updated_at'
            ]
            
            missing_fields = [field for field in required_fields if field not in users_columns]
            if missing_fields:
                log(f"缺少字段: {', '.join(missing_fields)}")
                return False
            else:
                log("所有必要字段都已存在")
            
            # 检查hardware_access_logs表
            cursor.execute("SHOW TABLES LIKE 'hardware_access_logs'")
            if cursor.fetchone():
                log("hardware_access_logs表存在")
            else:
                log("hardware_access_logs表不存在")
                return False
        
        return True
        
    except Exception as e:
        log(f"验证升级结果失败: {str(e)}")
        return False
    finally:
        conn.close()

def main():
    log("开始数据库升级...")
    
    try:
        # 1. 升级users表
        if not upgrade_users_table():
            log("升级users表失败")
            sys.exit(1)
        
        # 2. 创建硬件访问日志表
        if not create_hardware_access_logs_table():
            log("创建硬件访问日志表失败")
            sys.exit(1)
        
        # 3. 验证升级结果
        if not verify_upgrade():
            log("验证升级结果失败")
            sys.exit(1)
        
        log("数据库升级完成!")
        
    except Exception as e:
        log(f"数据库升级过程中发生错误: {str(e)}")
        log(traceback.format_exc())
        sys.exit(1)

if __name__ == '__main__':
    main()
