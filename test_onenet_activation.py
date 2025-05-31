#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OneNET设备激活功能测试脚本
"""

import sys
import os
import json

# 添加python目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'python'))

from onenet_api import activate_device_for_user, check_device_status_for_user

def test_device_activation():
    """测试设备激活功能"""
    print("=" * 60)
    print("OneNET设备激活功能测试")
    print("=" * 60)
    
    # 测试用户列表
    test_users = ["admin", "testuser1", "testuser2"]
    
    for username in test_users:
        print(f"\n测试用户: {username}")
        print("-" * 40)
        
        # 1. 检查设备状态
        print(f"1. 检查用户 {username} 的设备状态...")
        status_result = check_device_status_for_user(username)
        
        if status_result.get("success"):
            is_activated = status_result.get("is_activated", False)
            device_name = status_result.get("device_name", "未知")
            activate_time = status_result.get("activate_time", "未知")
            last_time = status_result.get("last_time", "未知")
            
            print(f"   设备名称: {device_name}")
            print(f"   激活状态: {'已激活' if is_activated else '未激活'}")
            print(f"   激活时间: {activate_time}")
            print(f"   最后活动: {last_time}")
            
            if is_activated:
                print(f"   ✅ 设备 {device_name} 已经激活，无需重新激活")
                continue
        else:
            print(f"   ❌ 检查设备状态失败: {status_result.get('error', '未知错误')}")
        
        # 2. 尝试激活设备
        print(f"2. 尝试激活用户 {username} 的设备...")
        activation_result = activate_device_for_user(username)
        
        if activation_result.get("success"):
            device_name = activation_result.get("device_name", "未知")
            device_id = activation_result.get("device_id", "未知")
            activation_method = activation_result.get("activation_method", "未知")
            message = activation_result.get("message", "")
            
            print(f"   ✅ 激活成功!")
            print(f"   设备名称: {device_name}")
            print(f"   设备ID: {device_id}")
            print(f"   激活方式: {activation_method}")
            print(f"   消息: {message}")
        else:
            error = activation_result.get("error", "未知错误")
            print(f"   ❌ 激活失败: {error}")
            
            # 显示详细错误信息
            if "activation_details" in activation_result:
                details = activation_result["activation_details"]
                print(f"   详细信息: {details}")
        
        # 3. 再次检查设备状态
        print(f"3. 激活后再次检查设备状态...")
        final_status = check_device_status_for_user(username)
        
        if final_status.get("success"):
            is_activated = final_status.get("is_activated", False)
            print(f"   最终状态: {'已激活' if is_activated else '未激活'}")
        else:
            print(f"   ❌ 最终状态检查失败: {final_status.get('error', '未知错误')}")

def test_specific_user():
    """测试特定用户的激活功能"""
    username = input("请输入要测试的用户名 (默认: admin): ").strip() or "admin"
    
    print(f"\n测试用户 {username} 的OneNET设备激活功能")
    print("=" * 50)
    
    # 检查当前状态
    print("1. 检查当前设备状态...")
    status_result = check_device_status_for_user(username)
    print(f"状态检查结果: {json.dumps(status_result, ensure_ascii=False, indent=2)}")
    
    # 尝试激活
    print("\n2. 尝试激活设备...")
    activation_result = activate_device_for_user(username)
    print(f"激活结果: {json.dumps(activation_result, ensure_ascii=False, indent=2)}")
    
    # 再次检查状态
    print("\n3. 激活后检查设备状态...")
    final_status = check_device_status_for_user(username)
    print(f"最终状态: {json.dumps(final_status, ensure_ascii=False, indent=2)}")

def main():
    """主函数"""
    print("OneNET设备激活功能测试工具")
    print("1. 批量测试多个用户")
    print("2. 测试特定用户")
    print("3. 退出")
    
    choice = input("请选择测试模式 (1-3): ").strip()
    
    if choice == "1":
        test_device_activation()
    elif choice == "2":
        test_specific_user()
    elif choice == "3":
        print("退出测试")
        return
    else:
        print("无效选择，退出测试")
        return
    
    print("\n测试完成!")

if __name__ == "__main__":
    main()
