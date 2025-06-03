#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
OneNET HTTP同步命令控制脚本
使用HTTP同步命令API控制雨刷设备

🔧 更新说明：
- 从MQTT改为HTTP同步命令
- 使用正确的OneNET HTTP同步命令API格式
- 支持实时设备控制和状态查询
- 基于用户级鉴权实现多用户隔离
"""

import sys
import json
import argparse
import traceback
from onenet_api import (
    send_sync_command,
    get_user_device_config,
    log,
    USER_ID,
    PRODUCT_ID
)

def log_output(message, level="INFO"):
    """输出日志到stderr，以便Node.js区分日志和结果"""
    print(f"LOG: [{level}] {message}", file=sys.stderr)

def control_wiper_http(username, status, timeout=10):
    """
    通过HTTP同步命令控制雨刷
    
    Args:
        username: 用户名
        status: 雨刷状态 (off, interval, low, high, smart)
        timeout: 超时时间（秒）
    
    Returns:
        dict: 控制结果
    """
    try:
        log_output(f"开始通过HTTP同步命令控制雨刷")
        log_output(f"用户名: {username}")
        log_output(f"目标状态: {status}")
        log_output(f"超时时间: {timeout}秒")
        
        # 获取用户的设备配置
        device_config = get_user_device_config(username)
        if not device_config:
            return {
                "success": False,
                "error": f"未找到用户 {username} 的设备配置"
            }

        device_name = device_config['device_name']
        log_output(f"设备名称: {device_name}")
        
        # 构建控制命令 - 使用设备端期望的格式
        command_data = {
            "wiper_control": status,  # 设备端期望的字段名
            "timestamp": int(__import__('time').time()),
            "source": "http_sync_command",
            "command_id": f"wiper_ctrl_{int(__import__('time').time() * 1000)}",
            "user": username
        }
        
        log_output(f"发送HTTP同步命令: {command_data}")
        
        # 发送HTTP同步命令
        result = send_sync_command(
            device_name=device_name,
            command_data=command_data,
            timeout=timeout
        )
        
        if result.get('success'):
            log_output(f"HTTP同步命令发送成功")
            
            # 解析设备响应
            device_response = result.get('decoded_resp', result.get('cmd_resp', ''))
            log_output(f"设备响应: {device_response}")

            # 尝试解析设备响应，检查是否有错误
            try:
                if isinstance(device_response, str) and device_response.strip():
                    import json
                    response_data = json.loads(device_response)

                    # 检查设备响应中的错误
                    if response_data.get('errno', 0) != 0:
                        error_msg = response_data.get('error', response_data.get('message', '设备执行命令失败'))
                        log_output(f"设备执行命令失败: {error_msg}")
                        return {
                            "success": False,
                            "error": f"设备执行命令失败: {error_msg}",
                            "device_response": device_response,
                            "method": "HTTP同步命令"
                        }

                    # 成功执行，获取实际状态
                    actual_status = response_data.get('data', {}).get('wiper_status', status)
                    return {
                        "success": True,
                        "status": actual_status,
                        "message": f"雨刷已切换到{actual_status}模式",
                        "device_response": device_response,
                        "cmd_uuid": result.get('cmd_uuid', ''),
                        "method": "HTTP同步命令"
                    }
                else:
                    # 没有设备响应或响应为空，但命令发送成功
                    return {
                        "success": True,
                        "status": status,
                        "message": f"雨刷控制命令已发送",
                        "device_response": device_response,
                        "cmd_uuid": result.get('cmd_uuid', ''),
                        "method": "HTTP同步命令"
                    }
            except:
                # 无法解析设备响应，但命令发送成功
                return {
                    "success": True,
                    "status": status,
                    "message": f"雨刷控制命令已发送",
                    "device_response": device_response,
                    "cmd_uuid": result.get('cmd_uuid', ''),
                    "method": "HTTP同步命令"
                }
        else:
            error_msg = result.get('error', '未知错误')
            log_output(f"HTTP同步命令发送失败: {error_msg}")
            
            # 检查是否是设备离线错误
            if "device not online" in str(error_msg).lower() or "10421" in str(error_msg):
                return {
                    "success": False,
                    "error": "设备当前离线，无法执行控制命令",
                    "error_code": "DEVICE_OFFLINE",
                    "method": "HTTP同步命令"
                }
            else:
                return {
                    "success": False,
                    "error": f"控制命令发送失败: {error_msg}",
                    "method": "HTTP同步命令"
                }
        
    except Exception as e:
        log_output(f"控制雨刷出错: {str(e)}", "ERROR")
        log_output(traceback.format_exc(), "ERROR")
        return {
            "success": False,
            "error": f"控制雨刷出错: {str(e)}"
        }

def get_wiper_status_http(username, timeout=10):
    """
    通过HTTP同步命令获取雨刷状态
    
    Args:
        username: 用户名
        timeout: 超时时间（秒）
    
    Returns:
        dict: 状态查询结果
    """
    try:
        log_output(f"开始通过HTTP同步命令获取雨刷状态")
        log_output(f"用户名: {username}")
        log_output(f"超时时间: {timeout}秒")
        
        # 获取用户的设备配置
        device_config = get_user_device_config(username)
        if not device_config:
            return {
                "success": False,
                "error": f"未找到用户 {username} 的设备配置"
            }

        device_name = device_config['device_name']
        log_output(f"设备名称: {device_name}")
        
        # 构建状态查询命令 - 使用设备端期望的格式
        command_data = {
            "wiper_status_query": True,  # 设备端期望的状态查询标识
            "timestamp": int(__import__('time').time()),
            "source": "http_sync_command",
            "command_id": f"wiper_status_{int(__import__('time').time() * 1000)}",
            "user": username
        }
        
        log_output(f"发送HTTP同步状态查询命令: {command_data}")
        
        # 发送HTTP同步命令
        result = send_sync_command(
            device_name=device_name,
            command_data=command_data,
            timeout=timeout
        )
        
        if result.get('success'):
            log_output(f"HTTP同步状态查询成功")
            
            # 解析设备响应
            device_response = result.get('decoded_resp', result.get('cmd_resp', ''))
            log_output(f"设备响应: {device_response}")
            
            # 尝试解析设备响应中的状态信息
            try:
                if isinstance(device_response, str):
                    response_data = json.loads(device_response)
                else:
                    response_data = device_response
                
                # 从设备响应的data字段中获取状态
                data_section = response_data.get('data', {})
                wiper_status = data_section.get('wiper_status', 'unknown')
                device_message = data_section.get('message', f"当前雨刷状态: {wiper_status}")

                return {
                    "success": True,
                    "status": wiper_status,
                    "message": device_message,
                    "device_response": device_response,
                    "cmd_uuid": result.get('cmd_uuid', ''),
                    "method": "HTTP同步命令"
                }
            except:
                # 如果无法解析响应，返回原始响应
                return {
                    "success": True,
                    "status": "unknown",
                    "message": "获取状态成功，但无法解析设备响应",
                    "device_response": device_response,
                    "cmd_uuid": result.get('cmd_uuid', ''),
                    "method": "HTTP同步命令"
                }
        else:
            error_msg = result.get('error', '未知错误')
            log_output(f"HTTP同步状态查询失败: {error_msg}")
            
            # 检查是否是设备离线错误
            if "device not online" in str(error_msg).lower() or "10421" in str(error_msg):
                return {
                    "success": False,
                    "error": "设备当前离线，无法查询状态",
                    "error_code": "DEVICE_OFFLINE",
                    "method": "HTTP同步命令"
                }
            else:
                return {
                    "success": False,
                    "error": f"状态查询失败: {error_msg}",
                    "method": "HTTP同步命令"
                }
        
    except Exception as e:
        log_output(f"获取雨刷状态出错: {str(e)}", "ERROR")
        log_output(traceback.format_exc(), "ERROR")
        return {
            "success": False,
            "error": f"获取雨刷状态出错: {str(e)}"
        }

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='OneNET HTTP同步命令雨刷控制')
    parser.add_argument('--action', required=True, choices=['control', 'status', 'get-status'], 
                       help='操作类型')
    parser.add_argument('--username', required=True, help='用户名')
    parser.add_argument('--status', help='雨刷状态 (control操作时必需)')
    parser.add_argument('--timeout', type=int, default=10, help='超时时间（秒）')
    
    args = parser.parse_args()
    
    try:
        log_output(f"OneNET HTTP同步命令控制脚本启动")
        log_output(f"操作: {args.action}")
        log_output(f"用户: {args.username}")
        log_output(f"超时: {args.timeout}秒")
        
        if args.action == 'control':
            if not args.status:
                result = {
                    "success": False,
                    "error": "control操作需要指定--status参数"
                }
            else:
                result = control_wiper_http(args.username, args.status, args.timeout)
        
        elif args.action in ['status', 'get-status']:
            result = get_wiper_status_http(args.username, args.timeout)
        
        else:
            result = {
                "success": False,
                "error": f"不支持的操作: {args.action}"
            }
        
        # 输出结果到stdout供Node.js读取
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        log_output(f"脚本执行出错: {str(e)}", "ERROR")
        log_output(traceback.format_exc(), "ERROR")
        
        error_result = {
            "success": False,
            "error": f"脚本执行出错: {str(e)}"
        }
        print(json.dumps(error_result, ensure_ascii=False))

if __name__ == "__main__":
    main()
