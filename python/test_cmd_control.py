#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
测试新的CMD格式设备控制
"""

import sys
import os
import json
import time

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from mqtt_device_control import send_wiper_command_mqtt
from onenet_api import get_user_device_config

def test_cmd_control():
    """测试CMD格式的设备控制"""
    
    print("🧪 测试新的CMD格式设备控制")
    print("=" * 50)
    
    # 测试用户列表
    test_users = ['admin', 'user1', 'user2']
    test_commands = ['off', 'low', 'medium', 'high']
    
    for username in test_users:
        print(f"\n🔍 测试用户: {username}")
        print("-" * 40)
        
        # 获取用户设备配置
        try:
            device_config = get_user_device_config(username)
            device_name = device_config['device_name']
            device_id = device_config.get('device_id', 'N/A')
            
            print(f"设备名称: {device_name}")
            print(f"设备ID: {device_id}")
            
            # 测试一个控制命令
            test_command = 'low'
            print(f"\n📤 发送CMD控制命令: {test_command}")
            
            # 发送控制命令
            control_result = send_wiper_command_mqtt(test_command, username)
            
            print(f"\n📊 控制结果:")
            print(json.dumps(control_result, ensure_ascii=False, indent=2))
            
            if control_result['success']:
                print("✅ CMD控制命令发送成功")
                if 'cmdid' in control_result:
                    print(f"   命令ID: {control_result['cmdid']}")
                if 'method' in control_result:
                    print(f"   控制方式: {control_result['method']}")
            else:
                print("❌ CMD控制命令发送失败")
                print(f"   错误: {control_result.get('error', 'N/A')}")
                
        except Exception as e:
            print(f"❌ 测试用户 {username} 时出错: {str(e)}")
        
        print("\n" + "=" * 40)
        time.sleep(2)  # 避免请求过于频繁

def test_specific_cmd_control(username, command):
    """测试特定用户的CMD控制"""
    
    print(f"\n🎯 测试用户 {username} 的CMD控制")
    print("-" * 40)
    
    try:
        # 获取用户设备配置
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        device_id = device_config.get('device_id', 'N/A')
        
        print(f"设备名称: {device_name}")
        print(f"设备ID: {device_id}")
        print(f"控制命令: {command}")
        
        # 发送控制命令
        print(f"\n📤 发送CMD控制命令...")
        control_result = send_wiper_command_mqtt(command, username)
        
        # 输出详细结果
        print(f"\n📊 CMD控制结果:")
        print(json.dumps(control_result, ensure_ascii=False, indent=2))
        
        # 分析结果
        if control_result['success']:
            print("\n✅ 分析:")
            print(f"   - 命令发送成功")
            print(f"   - 控制方式: {control_result.get('method', 'N/A')}")
            print(f"   - 命令ID: {control_result.get('cmdid', 'N/A')}")
            if 'response' in control_result:
                print(f"   - 设备回复: {control_result['response']}")
        else:
            print("\n❌ 分析:")
            print(f"   - 命令发送失败")
            print(f"   - 错误原因: {control_result.get('error', 'N/A')}")
        
        return control_result
        
    except Exception as e:
        print(f"❌ 测试失败: {str(e)}")
        return {"success": False, "error": str(e)}

def main():
    """主函数"""
    if len(sys.argv) >= 3:
        # 测试特定用户和命令
        username = sys.argv[1]
        command = sys.argv[2]
        test_specific_cmd_control(username, command)
    else:
        # 运行完整测试
        test_cmd_control()

if __name__ == "__main__":
    main()
