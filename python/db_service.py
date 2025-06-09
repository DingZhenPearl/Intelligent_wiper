import pymysql
import json
import argparse
import sys
import traceback
from werkzeug.security import generate_password_hash, check_password_hash
import io

# 设置 stdout 和 stderr 编码为 utf-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

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

# 直接在代码中定义数据库配置
db_config = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "mwYgR7#*X2",
    "database": "intelligent_wiper_db"
}

def get_db_connection():
    try:
        # 测试数据库连接
        log("尝试连接数据库...")
        connection = pymysql.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database'],
            port=db_config['port'],
            cursorclass=pymysql.cursors.DictCursor
        )
        log("数据库连接成功")
        return connection
    except pymysql.Error as e:
        log(f"数据库连接错误: {str(e)}")
        # 尝试创建数据库
        try:
            log("尝试创建数据库...")
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
            log("数据库创建并连接成功")
            return connection
        except Exception as create_err:
            log(f"创建数据库失败: {str(create_err)}")
            raise

def init_db():
    """初始化数据库表结构"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 创建用户表（扩展版本，包含设备绑定信息）
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    -- 设备激活相关字段
                    activation_code VARCHAR(20) NULL,
                    onenet_device_id VARCHAR(50) NULL,
                    onenet_device_name VARCHAR(100) NULL,
                    device_key TEXT NULL,
                    product_id VARCHAR(20) DEFAULT '66eIb47012',
                    serial_number VARCHAR(50) NULL,
                    device_model VARCHAR(100) DEFAULT '智能雨刷设备',
                    firmware_version VARCHAR(20) DEFAULT 'v2.0',

                    -- 硬件绑定相关字段
                    hardware_mac VARCHAR(17) NULL,
                    hardware_serial VARCHAR(50) NULL,
                    hardware_identifier VARCHAR(100) NULL,

                    -- 状态和时间字段
                    device_status ENUM('not_activated', 'virtual_only', 'hardware_bound', 'both_active') DEFAULT 'not_activated',
                    activated_at TIMESTAMP NULL,
                    last_hardware_access TIMESTAMP NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                    -- 索引
                    INDEX idx_activation_code (activation_code),
                    INDEX idx_onenet_device_id (onenet_device_id),
                    INDEX idx_hardware_mac (hardware_mac),
                    INDEX idx_device_status (device_status)
                )
            ''')

            # 创建硬件访问日志表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS hardware_access_logs (
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
            ''')

        conn.commit()
        log("数据库表结构创建/更新成功")
        return {"success": True, "message": "数据库初始化成功"}
    except Exception as e:
        log(f"数据库初始化失败: {str(e)}")
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def register_user(username, password):
    """注册新用户"""
    if not username or not password:
        return {"success": False, "error": "用户名和密码不能为空"}

    hashed_password = generate_password_hash(password)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                'INSERT INTO users (username, password) VALUES (%s, %s)',
                (username, hashed_password)
            )
        conn.commit()
        return {"success": True, "message": "注册成功"}
    except pymysql.err.IntegrityError:
        return {"success": False, "error": "用户名已存在"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def authenticate_user(username, password):
    """验证用户登录"""
    log(f"尝试验证用户: {username}")

    if not username or not password:
        log("用户名或密码为空")
        return {"success": False, "error": "用户名和密码不能为空"}

    try:
        # 测试数据库连接
        conn = get_db_connection()
        try:
            # 检查用户表是否存在
            with conn.cursor() as cursor:
                cursor.execute("SHOW TABLES LIKE 'users'")
                if not cursor.fetchone():
                    log("用户表不存在，初始化数据库...")
                    init_db()

                cursor.execute('SELECT * FROM users WHERE username = %s', (username,))
                user = cursor.fetchone()

                if not user:
                    log(f"用户不存在: {username}")
                    return {"success": False, "error": "用户名或密码错误"}

                # 检查密码是否匹配
                try:
                    password_match = check_password_hash(user['password'], password)
                    log(f"密码验证结果: {password_match}")

                    if password_match:
                        return {
                            "success": True,
                            "message": "登录成功",
                            "user_id": user['id'],
                            "username": user['username']
                        }
                    else:
                        return {"success": False, "error": "用户名或密码错误"}
                except Exception as pwd_err:
                    log(f"密码验证错误: {str(pwd_err)}")
                    # 尝试不同的密码验证方式
                    if password == user['password']:  # 测试用：明文密码比较
                        log("使用明文密码登录成功")
                        return {
                            "success": True,
                            "message": "登录成功",
                            "user_id": user['id'],
                            "username": user['username']
                        }
                    return {"success": False, "error": "密码验证错误"}

        except Exception as query_err:
            log(f"查询数据库时发生错误: {str(query_err)}")
            log(traceback.format_exc())
            return {"success": False, "error": f"数据库查询错误: {str(query_err)}"}
        finally:
            conn.close()
    except Exception as conn_err:
        log(f"数据库连接失败: {str(conn_err)}")
        log(traceback.format_exc())
        return {"success": False, "error": f"数据库连接失败: {str(conn_err)}"}

# 添加更多数据库操作函数
def get_user_by_id(user_id):
    """通过ID获取用户信息"""
    if not user_id:
        return {"success": False, "error": "用户ID不能为空"}

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('SELECT id, username, created_at FROM users WHERE id = %s', (user_id,))
            user = cursor.fetchone()

            if user:
                return {
                    "success": True,
                    "user": user
                }
            else:
                return {"success": False, "error": "用户不存在"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def get_all_users():
    """获取所有用户列表"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('SELECT id, username, created_at FROM users ORDER BY created_at ASC')
            users_raw = cursor.fetchall()

            # 转换为字典列表，处理datetime对象
            users = []
            for user in users_raw:
                # 由于使用了 DictCursor，user 已经是字典格式
                created_at = user['created_at']
                if created_at and hasattr(created_at, 'isoformat'):
                    created_at_str = created_at.isoformat()
                elif created_at:
                    created_at_str = str(created_at)
                else:
                    created_at_str = None

                user_dict = {
                    'id': user['id'],
                    'username': user['username'],
                    'created_at': created_at_str
                }
                users.append(user_dict)

            return {
                "success": True,
                "users": users,
                "count": len(users)
            }
    except Exception as e:
        log(f"获取所有用户失败: {str(e)}")
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def delete_user_and_data(username):
    """删除用户及其所有相关数据"""
    if not username:
        return {"success": False, "error": "用户名不能为空"}

    log(f"开始删除用户 {username} 及其所有相关数据")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 检查用户是否存在
            cursor.execute('SELECT id FROM users WHERE username = %s', (username,))
            user = cursor.fetchone()

            if not user:
                return {"success": False, "error": f"用户 {username} 不存在"}

            user_id = user['id']
            log(f"找到用户 {username} (ID: {user_id})")

            # 删除硬件访问日志
            cursor.execute('DELETE FROM hardware_access_logs WHERE user_id = %s', (user_id,))
            log(f"删除用户 {username} 的硬件访问日志")

            # 删除雨量相关数据表中的数据
            tables_to_clean = [
                'rainfall_raw',      # 原始雨量数据
                'rainfall_10min',    # 10分钟聚合数据
                'rainfall_hourly',   # 小时聚合数据
                'rainfall_daily',    # 日聚合数据
                'rainfall_monthly'   # 月聚合数据
            ]

            deleted_counts = {}

            for table in tables_to_clean:
                try:
                    # 先查询要删除的记录数
                    cursor.execute(f'SELECT COUNT(*) as count FROM {table} WHERE username = %s', (username,))
                    count_result = cursor.fetchone()
                    count = count_result['count'] if count_result else 0

                    # 删除数据
                    cursor.execute(f'DELETE FROM {table} WHERE username = %s', (username,))
                    deleted_counts[table] = count
                    log(f"从表 {table} 删除了 {count} 条记录")
                except Exception as table_error:
                    log(f"删除表 {table} 中的数据时出错: {str(table_error)}")
                    # 继续处理其他表

            # 最后删除用户记录
            cursor.execute('DELETE FROM users WHERE username = %s', (username,))
            log(f"删除用户记录: {username}")

        conn.commit()

        log(f"成功删除用户 {username} 及其所有相关数据")
        return {
            "success": True,
            "message": f"成功删除用户 {username} 及其所有相关数据",
            "user_id": user_id,
            "deleted_counts": deleted_counts
        }

    except Exception as e:
        conn.rollback()
        error_msg = f"删除用户 {username} 时出错: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}
    finally:
        conn.close()

# ==================== 设备绑定相关函数 ====================

def store_device_binding(username, device_data):
    """存储用户的设备绑定信息到users表"""
    if not username or not device_data:
        return {"success": False, "error": "用户名和设备数据不能为空"}

    log(f"存储用户 {username} 的设备绑定信息")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 处理日期时间格式
            activated_at = device_data.get('activated_at')
            if activated_at:
                # 如果是ISO格式的字符串，转换为MySQL可接受的格式
                if isinstance(activated_at, str) and 'T' in activated_at:
                    # 移除毫秒部分和时区信息
                    activated_at = activated_at.split('.')[0].replace('T', ' ').replace('Z', '')

            # 更新用户的设备绑定信息
            update_sql = '''
                UPDATE users SET
                    activation_code = %s,
                    onenet_device_id = %s,
                    onenet_device_name = %s,
                    device_key = %s,
                    product_id = %s,
                    serial_number = %s,
                    device_model = %s,
                    firmware_version = %s,
                    device_status = %s,
                    activated_at = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE username = %s
            '''

            cursor.execute(update_sql, (
                device_data.get('activation_code'),
                device_data.get('onenet_device_id'),
                device_data.get('onenet_device_name'),
                device_data.get('device_key'),
                device_data.get('product_id', '66eIb47012'),
                device_data.get('serial_number'),
                device_data.get('device_model', '智能雨刷设备'),
                device_data.get('firmware_version', 'v2.0'),
                device_data.get('device_status', 'virtual_only'),
                activated_at,
                username
            ))

            if cursor.rowcount == 0:
                return {"success": False, "error": f"用户 {username} 不存在"}

        conn.commit()
        log(f"成功存储用户 {username} 的设备绑定信息")
        return {"success": True, "message": "设备绑定信息存储成功"}

    except Exception as e:
        conn.rollback()
        error_msg = f"存储设备绑定信息失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}
    finally:
        conn.close()

def get_device_credentials_by_activation_code(activation_code):
    """通过激活码获取设备凭证"""
    if not activation_code:
        return {"success": False, "error": "激活码不能为空"}

    log(f"通过激活码获取设备凭证: {activation_code}")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT id, username, activation_code, onenet_device_id, onenet_device_name,
                       device_key, product_id, serial_number, device_model, firmware_version,
                       device_status, activated_at, hardware_mac, hardware_serial
                FROM users
                WHERE activation_code = %s AND device_status != 'not_activated'
                ORDER BY activated_at DESC
                LIMIT 1
            ''', (activation_code,))

            user = cursor.fetchone()

            if not user:
                return {"success": False, "error": "未找到对应的设备绑定信息"}

            return {
                "success": True,
                "user_id": user['id'],
                "username": user['username'],
                "credentials": {
                    "device_id": user['onenet_device_id'],
                    "device_name": user['onenet_device_name'],
                    "product_id": user['product_id'],
                    "device_key": user['device_key'],
                    "mqtt_server": "183.230.40.39",
                    "mqtt_port": 6002
                },
                "device_info": {
                    "activation_code": user['activation_code'],
                    "serial_number": user['serial_number'],
                    "device_model": user['device_model'],
                    "firmware_version": user['firmware_version'],
                    "device_status": user['device_status'],
                    "activated_at": user['activated_at'].isoformat() if user['activated_at'] else None,
                    "hardware_mac": user['hardware_mac'],
                    "hardware_serial": user['hardware_serial']
                }
            }

    except Exception as e:
        error_msg = f"获取设备凭证失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}
    finally:
        conn.close()

def get_device_credentials_by_hardware(mac_address=None, hardware_serial=None):
    """通过硬件标识符获取设备凭证"""
    if not mac_address and not hardware_serial:
        return {"success": False, "error": "需要提供MAC地址或硬件序列号"}

    log(f"通过硬件标识符获取设备凭证: MAC={mac_address}, Serial={hardware_serial}")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 构建查询条件
            where_conditions = []
            params = []

            if mac_address:
                where_conditions.append("hardware_mac = %s")
                params.append(mac_address)

            if hardware_serial:
                where_conditions.append("hardware_serial = %s")
                params.append(hardware_serial)

            where_clause = " OR ".join(where_conditions)

            cursor.execute(f'''
                SELECT id, username, activation_code, onenet_device_id, onenet_device_name,
                       device_key, product_id, serial_number, device_model, firmware_version,
                       device_status, activated_at, hardware_mac, hardware_serial
                FROM users
                WHERE ({where_clause}) AND device_status != 'not_activated'
                ORDER BY activated_at DESC
                LIMIT 1
            ''', params)

            user = cursor.fetchone()

            if not user:
                return {"success": False, "error": "未找到对应的设备绑定信息"}

            return {
                "success": True,
                "user_id": user['id'],
                "username": user['username'],
                "credentials": {
                    "device_id": user['onenet_device_id'],
                    "device_name": user['onenet_device_name'],
                    "product_id": user['product_id'],
                    "device_key": user['device_key'],
                    "mqtt_server": "183.230.40.39",
                    "mqtt_port": 6002
                },
                "device_info": {
                    "activation_code": user['activation_code'],
                    "serial_number": user['serial_number'],
                    "device_model": user['device_model'],
                    "firmware_version": user['firmware_version'],
                    "device_status": user['device_status'],
                    "activated_at": user['activated_at'].isoformat() if user['activated_at'] else None,
                    "hardware_mac": user['hardware_mac'],
                    "hardware_serial": user['hardware_serial']
                }
            }

    except Exception as e:
        error_msg = f"通过硬件标识符获取设备凭证失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}
    finally:
        conn.close()

def update_hardware_binding(username, hardware_mac=None, hardware_serial=None, hardware_identifier=None):
    """更新用户的硬件绑定信息"""
    if not username:
        return {"success": False, "error": "用户名不能为空"}

    log(f"更新用户 {username} 的硬件绑定信息")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 更新硬件绑定信息和设备状态
            cursor.execute('''
                UPDATE users SET
                    hardware_mac = %s,
                    hardware_serial = %s,
                    hardware_identifier = %s,
                    device_status = CASE
                        WHEN device_status = 'virtual_only' THEN 'hardware_bound'
                        WHEN device_status = 'not_activated' THEN 'hardware_bound'
                        ELSE device_status
                    END,
                    last_hardware_access = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE username = %s
            ''', (hardware_mac, hardware_serial, hardware_identifier, username))

            if cursor.rowcount == 0:
                return {"success": False, "error": f"用户 {username} 不存在"}

        conn.commit()
        log(f"成功更新用户 {username} 的硬件绑定信息")
        return {"success": True, "message": "硬件绑定信息更新成功"}

    except Exception as e:
        conn.rollback()
        error_msg = f"更新硬件绑定信息失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}
    finally:
        conn.close()

def log_hardware_access(user_id, username, hardware_identifier, access_ip, request_type='get_credentials',
                       response_status='success', request_details=None, response_details=None):
    """记录硬件访问日志"""
    log(f"记录硬件访问日志: 用户={username}, 硬件={hardware_identifier}, 类型={request_type}")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('''
                INSERT INTO hardware_access_logs
                (user_id, username, hardware_identifier, access_ip, request_type,
                 response_status, request_details, response_details)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (user_id, username, hardware_identifier, access_ip, request_type,
                  response_status, request_details, response_details))

        conn.commit()
        return {"success": True, "message": "硬件访问日志记录成功"}

    except Exception as e:
        error_msg = f"记录硬件访问日志失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}
    finally:
        conn.close()

def get_user_device_info(username):
    """获取用户的完整设备信息"""
    if not username:
        return {"success": False, "error": "用户名不能为空"}

    log(f"获取用户 {username} 的设备信息")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute('''
                SELECT id, username, activation_code, onenet_device_id, onenet_device_name,
                       device_key, product_id, serial_number, device_model, firmware_version,
                       hardware_mac, hardware_serial, hardware_identifier,
                       device_status, activated_at, last_hardware_access, created_at, updated_at
                FROM users
                WHERE username = %s
            ''', (username,))

            user = cursor.fetchone()

            if not user:
                return {"success": False, "error": f"用户 {username} 不存在"}

            # 获取硬件访问日志（最近10条）
            cursor.execute('''
                SELECT hardware_identifier, access_ip, request_type, response_status,
                       access_time, request_details, response_details
                FROM hardware_access_logs
                WHERE user_id = %s
                ORDER BY access_time DESC
                LIMIT 10
            ''', (user['id'],))

            access_logs = cursor.fetchall()

            # 格式化时间字段
            def format_datetime(dt):
                return dt.isoformat() if dt and hasattr(dt, 'isoformat') else str(dt) if dt else None

            return {
                "success": True,
                "user_info": {
                    "id": user['id'],
                    "username": user['username'],
                    "created_at": format_datetime(user['created_at'])
                },
                "device_info": {
                    "activation_code": user['activation_code'],
                    "onenet_device_id": user['onenet_device_id'],
                    "onenet_device_name": user['onenet_device_name'],
                    "product_id": user['product_id'],
                    "serial_number": user['serial_number'],
                    "device_model": user['device_model'],
                    "firmware_version": user['firmware_version'],
                    "device_status": user['device_status'],
                    "activated_at": format_datetime(user['activated_at']),
                    "updated_at": format_datetime(user['updated_at'])
                },
                "hardware_info": {
                    "hardware_mac": user['hardware_mac'],
                    "hardware_serial": user['hardware_serial'],
                    "hardware_identifier": user['hardware_identifier'],
                    "last_hardware_access": format_datetime(user['last_hardware_access'])
                },
                "access_logs": [
                    {
                        "hardware_identifier": log['hardware_identifier'],
                        "access_ip": log['access_ip'],
                        "request_type": log['request_type'],
                        "response_status": log['response_status'],
                        "access_time": format_datetime(log['access_time']),
                        "request_details": log['request_details'],
                        "response_details": log['response_details']
                    }
                    for log in access_logs
                ]
            }

    except Exception as e:
        error_msg = f"获取用户设备信息失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}
    finally:
        conn.close()

if __name__ == '__main__':
    try:
        parser = argparse.ArgumentParser(description='数据库服务')
        parser.add_argument('--action', choices=[
            'init', 'register', 'login', 'get_user', 'get_all_users', 'delete_user',
            'store_device_binding', 'get_device_credentials', 'update_hardware_binding',
            'get_user_device_info', 'log_hardware_access'
        ], required=True, help='执行的操作')
        parser.add_argument('--username', help='用户名')
        parser.add_argument('--password', help='密码')
        parser.add_argument('--user_id', help='用户ID')

        # 设备绑定相关参数
        parser.add_argument('--activation_code', help='激活码')
        parser.add_argument('--onenet_device_id', help='OneNET设备ID')
        parser.add_argument('--onenet_device_name', help='OneNET设备名称')
        parser.add_argument('--device_key', help='设备密钥')
        parser.add_argument('--product_id', help='产品ID', default='66eIb47012')
        parser.add_argument('--serial_number', help='设备序列号')
        parser.add_argument('--device_model', help='设备型号', default='智能雨刷设备')
        parser.add_argument('--firmware_version', help='固件版本', default='v2.0')
        parser.add_argument('--device_status', help='设备状态', default='virtual_only')
        parser.add_argument('--activated_at', help='激活时间')

        # 硬件绑定相关参数
        parser.add_argument('--hardware_mac', help='硬件MAC地址')
        parser.add_argument('--hardware_serial', help='硬件序列号')
        parser.add_argument('--hardware_identifier', help='硬件标识符')
        parser.add_argument('--access_ip', help='访问IP地址')
        parser.add_argument('--request_type', help='请求类型', default='get_credentials')
        parser.add_argument('--response_status', help='响应状态', default='success')
        parser.add_argument('--request_details', help='请求详情')
        parser.add_argument('--response_details', help='响应详情')

        args = parser.parse_args()

        log(f"执行操作: {args.action}")

        if args.action == 'init':
            result = init_db()
        elif args.action == 'register':
            if not args.username or not args.password:
                result = {"success": False, "error": "注册需要提供用户名和密码"}
            else:
                result = register_user(args.username, args.password)
        elif args.action == 'login':
            if not args.username or not args.password:
                result = {"success": False, "error": "登录需要提供用户名和密码"}
            else:
                log(f"登录参数: 用户名={args.username}, 密码长度={len(args.password) if args.password else 0}")
                result = authenticate_user(args.username, args.password)
        elif args.action == 'get_user':
            if not args.user_id:
                result = {"success": False, "error": "需要提供用户ID"}
            else:
                result = get_user_by_id(args.user_id)
        elif args.action == 'get_all_users':
            result = get_all_users()
        elif args.action == 'delete_user':
            if not args.username:
                result = {"success": False, "error": "删除用户需要提供用户名"}
            else:
                result = delete_user_and_data(args.username)
        elif args.action == 'store_device_binding':
            if not args.username:
                result = {"success": False, "error": "存储设备绑定需要提供用户名"}
            else:
                device_data = {
                    'activation_code': args.activation_code,
                    'onenet_device_id': args.onenet_device_id,
                    'onenet_device_name': args.onenet_device_name,
                    'device_key': args.device_key,
                    'product_id': args.product_id,
                    'serial_number': args.serial_number,
                    'device_model': args.device_model,
                    'firmware_version': args.firmware_version,
                    'device_status': args.device_status,
                    'activated_at': args.activated_at
                }
                result = store_device_binding(args.username, device_data)
        elif args.action == 'get_device_credentials':
            if args.activation_code:
                result = get_device_credentials_by_activation_code(args.activation_code)
            elif args.hardware_mac or args.hardware_serial:
                result = get_device_credentials_by_hardware(args.hardware_mac, args.hardware_serial)
            else:
                result = {"success": False, "error": "需要提供激活码或硬件标识符"}
        elif args.action == 'update_hardware_binding':
            if not args.username:
                result = {"success": False, "error": "更新硬件绑定需要提供用户名"}
            else:
                result = update_hardware_binding(args.username, args.hardware_mac,
                                               args.hardware_serial, args.hardware_identifier)
        elif args.action == 'get_user_device_info':
            if not args.username:
                result = {"success": False, "error": "获取用户设备信息需要提供用户名"}
            else:
                result = get_user_device_info(args.username)
        elif args.action == 'log_hardware_access':
            if not args.user_id or not args.username:
                result = {"success": False, "error": "记录硬件访问日志需要提供用户ID和用户名"}
            else:
                result = log_hardware_access(args.user_id, args.username, args.hardware_identifier,
                                           args.access_ip, args.request_type, args.response_status,
                                           args.request_details, args.response_details)
        else:
            result = {"success": False, "error": "未知操作"}

        # 以标准JSON格式输出结果，确保使用 utf-8 编码
        print(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()  # 确保输出被立即刷新

    except Exception as e:
        log(f"脚本执行错误: {str(e)}")
        log(traceback.format_exc())
        error_result = {"success": False, "error": f"脚本执行错误: {str(e)}"}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()  # 确保输出被立即刷新