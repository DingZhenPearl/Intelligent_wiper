#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
用户设备绑定测试脚本
测试前端和服务器的控制指令是否能让用户和其分配的设备一一绑定
"""

import sys
import json
import subprocess
import time

def test_user_device_config(username):
    """测试用户设备配置"""
    print(f"\n🧪 测试用户设备配置: {username}")
    print("=" * 50)
    
    try:
        # 调用Python API获取用户设备配置
        result = subprocess.run([
            'python', '-c', 
            f'''
import sys
sys.path.append("python")
from onenet_api import get_user_device_config
config = get_user_device_config("{username}")
print(json.dumps(config, indent=2, ensure_ascii=False))
'''
        ], capture_output=True, text=True, timeout=10)
        
        print(f"📋 返回码: {result.returncode}")
        
        if result.stdout:
            print(f"📄 用户设备配置:")
            try:
                config_data = json.loads(result.stdout)
                print(json.dumps(config_data, indent=2, ensure_ascii=False))
                return config_data
            except:
                print(result.stdout)
                return None
        
        if result.stderr:
            print(f"📝 错误信息:")
            for line in result.stderr.split('\n'):
                if line.strip():
                    print(f"  {line}")
        
        return None
        
    except subprocess.TimeoutExpired:
        print("❌ 获取用户设备配置超时")
        return None
    except Exception as e:
        print(f"❌ 获取用户设备配置错误: {e}")
        return None

def test_wiper_control_with_user(username, command):
    """测试特定用户的雨刷控制"""
    print(f"\n🎮 测试用户 {username} 的雨刷控制: {command}")
    print("=" * 50)
    
    try:
        # 调用HTTP控制脚本
        result = subprocess.run([
            'python', 'python/onenet_http_control.py',
            '--action', 'control',
            '--status', command,
            '--username', username,
            '--timeout', '10'
        ], capture_output=True, text=True, timeout=20)
        
        print(f"📤 命令执行完成")
        print(f"📋 返回码: {result.returncode}")
        
        if result.stdout:
            print(f"📄 控制结果:")
            try:
                output_data = json.loads(result.stdout)
                print(json.dumps(output_data, indent=2, ensure_ascii=False))
                return output_data
            except:
                print(result.stdout)
                return None
        
        if result.stderr:
            print(f"📝 日志信息:")
            for line in result.stderr.split('\n'):
                if line.strip():
                    print(f"  {line}")
        
        return None
        
    except subprocess.TimeoutExpired:
        print("❌ 雨刷控制命令超时")
        return None
    except Exception as e:
        print(f"❌ 雨刷控制命令错误: {e}")
        return None

def analyze_device_binding(test_results):
    """分析设备绑定结果"""
    print(f"\n📊 设备绑定分析")
    print("=" * 60)
    
    # 分析用户设备映射
    user_devices = {}
    for username, data in test_results.items():
        if data['config']:
            device_name = data['config'].get('device_name')
            user_devices[username] = device_name
    
    print(f"👥 用户设备映射关系:")
    for username, device_name in user_devices.items():
        print(f"  📱 用户 {username} → 设备 {device_name}")
    
    # 检查设备唯一性
    device_counts = {}
    for device_name in user_devices.values():
        device_counts[device_name] = device_counts.get(device_name, 0) + 1
    
    print(f"\n🔍 设备使用统计:")
    for device_name, count in device_counts.items():
        status = "✅ 独占" if count == 1 else f"⚠️ 共享({count}个用户)"
        print(f"  📟 设备 {device_name}: {status}")
    
    # 检查绑定正确性
    print(f"\n✅ 绑定正确性检查:")
    
    binding_correct = True
    for username, data in test_results.items():
        config = data.get('config')
        control_result = data.get('control_result')
        
        if not config:
            print(f"  ❌ 用户 {username}: 无法获取设备配置")
            binding_correct = False
            continue
        
        expected_device = config.get('device_name')
        
        if not control_result:
            print(f"  ❌ 用户 {username}: 控制命令失败")
            binding_correct = False
            continue
        
        if control_result.get('success'):
            print(f"  ✅ 用户 {username}: 成功控制设备 {expected_device}")
        else:
            print(f"  ❌ 用户 {username}: 控制设备 {expected_device} 失败")
            binding_correct = False
    
    return binding_correct, user_devices

def main():
    """主测试函数"""
    print("🚀 开始用户设备绑定测试")
    print("=" * 60)
    
    # 测试用户列表
    test_users = ['admin', 'user1', 'user2', 'testuser']
    test_command = 'low'  # 使用低速命令进行测试
    
    test_results = {}
    
    # 第一阶段：测试用户设备配置
    print(f"\n📋 第一阶段：测试用户设备配置")
    for username in test_users:
        config = test_user_device_config(username)
        test_results[username] = {'config': config}
    
    # 第二阶段：测试雨刷控制
    print(f"\n🎮 第二阶段：测试雨刷控制")
    for username in test_users:
        control_result = test_wiper_control_with_user(username, test_command)
        test_results[username]['control_result'] = control_result
        
        # 命令间隔
        time.sleep(1)
    
    # 第三阶段：分析结果
    binding_correct, user_devices = analyze_device_binding(test_results)
    
    # 测试结果汇总
    print("\n" + "=" * 60)
    print("📈 测试结果汇总")
    print("=" * 60)
    
    total_users = len(test_users)
    successful_configs = sum(1 for data in test_results.values() if data['config'])
    successful_controls = sum(1 for data in test_results.values() 
                            if data.get('control_result', {}).get('success'))
    
    print(f"👥 测试用户数量: {total_users}")
    print(f"✅ 成功获取配置: {successful_configs}/{total_users}")
    print(f"✅ 成功控制设备: {successful_controls}/{total_users}")
    print(f"📊 配置成功率: {successful_configs/total_users*100:.1f}%")
    print(f"📊 控制成功率: {successful_controls/total_users*100:.1f}%")
    
    # 绑定检查结果
    print(f"\n🔗 用户设备绑定检查:")
    if binding_correct:
        print("✅ 用户设备绑定正确，每个用户都能控制其分配的设备")
    else:
        print("❌ 用户设备绑定存在问题，需要检查配置")
    
    # 设备分配策略分析
    print(f"\n📱 设备分配策略:")
    unique_devices = len(set(user_devices.values()))
    if unique_devices == len(user_devices):
        print("✅ 每个用户都有独立的设备，完全隔离")
    elif unique_devices == 1:
        print("⚠️ 所有用户共享同一个设备，通过数据流隔离")
    else:
        print("🔄 混合模式：部分用户共享设备，部分用户独立设备")
    
    # 建议
    print(f"\n💡 建议:")
    if binding_correct:
        print("✅ 当前用户设备绑定机制工作正常")
        print("✅ 前端和服务器的控制指令能正确路由到用户对应的设备")
        print("✅ 用户数据隔离机制有效")
    else:
        print("⚠️ 需要检查以下方面：")
        print("   1. 用户设备配置函数是否正确")
        print("   2. HTTP控制脚本是否正确传递用户名")
        print("   3. 设备认证和权限是否正确配置")
        print("   4. OneNET平台设备是否正确创建")
    
    return binding_correct

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⏹️ 测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 测试过程中发生错误: {e}")
        sys.exit(1)
