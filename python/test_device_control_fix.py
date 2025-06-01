#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
测试修复后的设备控制功能
验证不同用户的设备控制是否正确发送到对应的设备
"""

import sys
import json
import time
from test_mqtt_control import send_wiper_command, get_wiper_status
from onenet_api import get_user_device_config
from rainfall_db import log

def test_device_control_for_users():
    """测试不同用户的设备控制功能"""
    
    # 测试用户列表
    test_users = ['admin', 'user1', 'user2', 'test_user']
    
    print("🔧 测试修复后的设备控制功能")
    print("=" * 60)
    
    for username in test_users:
        print(f"\n🔍 测试用户: {username}")
        print("-" * 40)
        
        # 获取用户设备配置
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        device_id = device_config.get('device_id', 'N/A')
        
        print(f"设备名称: {device_name}")
        print(f"设备ID: {device_id}")
        
        # 测试发送控制命令
        print(f"\n📤 发送控制命令 (low) 到设备: {device_name}")
        control_result = send_wiper_command('low', username)
        
        if control_result['success']:
            print("✅ 控制命令发送成功")
            print(f"   使用的端点: {control_result.get('endpoint', 'N/A')}")
            print(f"   设备名称: {control_result.get('device_name', 'N/A')}")
            print(f"   设备ID: {control_result.get('device_id', 'N/A')}")
            print(f"   响应: {control_result.get('message', 'N/A')}")
        else:
            print("❌ 控制命令发送失败")
            print(f"   错误: {control_result.get('error', 'N/A')}")
        
        # 测试获取设备状态
        print(f"\n📥 获取设备状态: {device_name}")
        status_result = get_wiper_status(username)
        
        if status_result['success']:
            print("✅ 设备状态获取成功")
            print(f"   状态: {status_result.get('status', 'N/A')}")
            print(f"   使用的端点: {status_result.get('endpoint', 'N/A')}")
        else:
            print("❌ 设备状态获取失败")
            print(f"   错误: {status_result.get('error', 'N/A')}")
        
        print("\n" + "=" * 40)
        time.sleep(2)  # 避免请求过于频繁

def test_specific_user_control(username, command):
    """测试特定用户的设备控制"""
    
    print(f"\n🎯 测试用户 {username} 的设备控制")
    print("-" * 40)
    
    # 获取用户设备配置
    device_config = get_user_device_config(username)
    device_name = device_config['device_name']
    device_id = device_config.get('device_id', 'N/A')
    
    print(f"设备名称: {device_name}")
    print(f"设备ID: {device_id}")
    print(f"控制命令: {command}")
    
    # 发送控制命令
    print(f"\n📤 发送控制命令...")
    control_result = send_wiper_command(command, username)
    
    # 输出详细结果
    print(f"\n📊 控制结果:")
    print(json.dumps(control_result, ensure_ascii=False, indent=2))
    
    return control_result

def main():
    """主函数"""
    if len(sys.argv) > 1:
        if sys.argv[1] == '--all':
            # 测试所有用户
            test_device_control_for_users()
        elif sys.argv[1] == '--user' and len(sys.argv) >= 4:
            # 测试特定用户
            username = sys.argv[2]
            command = sys.argv[3]
            test_specific_user_control(username, command)
        else:
            print("用法:")
            print("  python test_device_control_fix.py --all")
            print("  python test_device_control_fix.py --user <username> <command>")
            print("")
            print("示例:")
            print("  python test_device_control_fix.py --all")
            print("  python test_device_control_fix.py --user user1 low")
    else:
        # 默认测试所有用户
        test_device_control_for_users()

if __name__ == "__main__":
    main()
