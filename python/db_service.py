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
            # 创建用户表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        conn.commit()
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

if __name__ == '__main__':
    try:
        parser = argparse.ArgumentParser(description='数据库服务')
        parser.add_argument('--action', choices=['init', 'register', 'login', 'get_user'],
                            required=True, help='执行的操作')
        parser.add_argument('--username', help='用户名')
        parser.add_argument('--password', help='密码')
        parser.add_argument('--user_id', help='用户ID')

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