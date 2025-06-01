#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
设备控制测试脚本
用于验证不同用户的设备控制是否正确路由到对应的设备
"""

import sys
import json
import time
from test_mqtt_control import send_wiper_command, get_wiper_status
from onenet_api import get_user_device_config
from rainfall_db import log

def test_user_device_control():
    """测试不同用户的设备控制"""
    
    # 测试用户列表
    test_users = ['admin', 'testuser1', 'testuser2', 'user123']
    
    print("=" * 60)
    print("设备控制用户隔离测试")
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
            print(f"   响应: {control_result.get('message', 'N/A')}")
        else:
            print("❌ 控制命令发送失败")
            print(f"   错误: {control_result.get('error', 'N/A')}")
        
        # 等待一下再查询状态
        time.sleep(1)
        
        # 测试查询状态
        print(f"\n📥 查询设备状态: {device_name}")
        status_result = get_wiper_status(username)
        
        if status_result['success']:
            print("✅ 状态查询成功")
            print(f"   状态: {status_result.get('status', 'N/A')}")
        else:
            print("❌ 状态查询失败")
            print(f"   错误: {status_result.get('error', 'N/A')}")
        
        print("-" * 40)
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

def test_device_mapping():
    """测试设备映射配置"""
    
    print("=" * 60)
    print("设备映射配置测试")
    print("=" * 60)
    
    test_users = ['admin', 'testuser1', 'testuser2', 'user123', 'demo']
    
    for username in test_users:
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        device_id = device_config.get('device_id', 'N/A')
        datastream_id = device_config['datastream_id']
        
        print(f"用户: {username:12} -> 设备: {device_name:25} (ID: {device_id}) 数据流: {datastream_id}")
    
    print("=" * 60)

def main():
    """主函数"""
    if len(sys.argv) > 1:
        test_type = sys.argv[1]
        if test_type == 'mapping':
            test_device_mapping()
        elif test_type == 'control':
            test_user_device_control()
        else:
            print("用法: python test_device_control.py [mapping|control]")
            print("  mapping - 测试设备映射配置")
            print("  control - 测试设备控制")
    else:
        # 默认运行所有测试
        test_device_mapping()
        print("\n")
        test_user_device_control()

if __name__ == "__main__":
    main()
