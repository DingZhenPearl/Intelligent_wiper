#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试激活码激活流程
"""

import sys
import os
import json
import time

# 添加python目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'python'))

from onenet_api import create_device_for_user, activate_device_for_user, check_device_status_for_user

def test_activation_code_flow():
    """测试完整的激活码激活流程"""
    print("🧪 测试激活码激活流程")
    print("=" * 60)
    
    # 创建一个新的测试用户
    test_username = f"codetest_{int(time.time())}"
    print(f"\n📝 测试用户: {test_username}")
    
    try:
        # 步骤1: 创建设备（模拟激活码激活的第一步）
        print(f"\n1️⃣ 步骤1: 为用户 {test_username} 创建设备...")
        create_result = create_device_for_user(test_username)
        
        if not create_result.get("success"):
            print(f"❌ 设备创建失败: {create_result.get('error')}")
            return False
        
        device_name = create_result.get("device_name")
        device_id = create_result.get("device_id")
        print(f"✅ 设备创建成功!")
        print(f"   设备名称: {device_name}")
        print(f"   设备ID: {device_id}")
        
        # 步骤2: 检查设备初始状态（应该是未激活）
        print(f"\n2️⃣ 步骤2: 检查设备初始状态...")
        initial_status = check_device_status_for_user(test_username)
        
        if initial_status.get("success"):
            is_activated = initial_status.get("is_activated", False)
            print(f"   初始激活状态: {'已激活' if is_activated else '未激活'} ✅")
            print(f"   激活时间: {initial_status.get('activate_time', '未知')}")
            print(f"   最后活动: {initial_status.get('last_time', '未知')}")
            
            if is_activated:
                print("⚠️  警告: 设备创建后就已经激活了，这可能不是预期行为")
        else:
            print(f"❌ 检查初始状态失败: {initial_status.get('error')}")
        
        # 步骤3: 激活设备（模拟激活码激活的第二步）
        print(f"\n3️⃣ 步骤3: 激活设备（使用真正的MQTT连接）...")
        activation_result = activate_device_for_user(test_username)
        
        if not activation_result.get("success"):
            print(f"❌ 设备激活失败: {activation_result.get('error')}")
            return False
        
        print(f"✅ 设备激活成功!")
        print(f"   激活方法: {activation_result.get('activation_method', '未知')}")
        print(f"   消息: {activation_result.get('message', '')}")
        
        # 步骤4: 验证设备最终状态（应该是已激活）
        print(f"\n4️⃣ 步骤4: 验证设备最终激活状态...")
        final_status = check_device_status_for_user(test_username)
        
        if final_status.get("success"):
            is_activated = final_status.get("is_activated", False)
            activate_time = final_status.get("activate_time", "未知")
            last_time = final_status.get("last_time", "未知")
            device_status = final_status.get("device_info", {}).get("status", "未知")
            
            print(f"   最终激活状态: {'已激活' if is_activated else '未激活'}")
            print(f"   激活时间: {activate_time}")
            print(f"   最后活动: {last_time}")
            print(f"   设备状态码: {device_status} ({'在线' if device_status == 0 else '离线'})")
            
            if is_activated and device_status == 0:
                print("🎉 激活码激活流程测试成功!")
                
                # 显示激活前后对比
                print(f"\n📊 激活前后对比:")
                print(f"   激活前状态: {'已激活' if initial_status.get('is_activated') else '未激活'}")
                print(f"   激活后状态: {'已激活' if is_activated else '未激活'}")
                print(f"   激活时间变化: {initial_status.get('activate_time')} → {activate_time}")
                print(f"   最后活动变化: {initial_status.get('last_time')} → {last_time}")
                
                return True
            else:
                print("❌ 设备激活验证失败")
                return False
        else:
            print(f"❌ 检查最终状态失败: {final_status.get('error')}")
            return False
            
    except Exception as e:
        print(f"❌ 测试过程中发生异常: {str(e)}")
        return False

def test_existing_user_activation():
    """测试已有用户的激活流程"""
    print("\n🔄 测试已有用户的激活流程")
    print("=" * 60)
    
    # 使用之前创建的测试用户
    test_username = "testactivation"
    print(f"\n📝 测试用户: {test_username}")
    
    try:
        # 检查当前状态
        print(f"\n1️⃣ 检查用户 {test_username} 的当前设备状态...")
        current_status = check_device_status_for_user(test_username)
        
        if current_status.get("success"):
            is_activated = current_status.get("is_activated", False)
            print(f"   当前激活状态: {'已激活' if is_activated else '未激活'}")
            print(f"   激活时间: {current_status.get('activate_time', '未知')}")
            print(f"   最后活动: {current_status.get('last_time', '未知')}")
            
            if is_activated:
                print("✅ 设备已经激活，激活码激活流程正常工作")
                return True
            else:
                print("⚠️  设备未激活，尝试重新激活...")
                
                # 尝试重新激活
                activation_result = activate_device_for_user(test_username)
                
                if activation_result.get("success"):
                    print("✅ 重新激活成功")
                    
                    # 再次检查状态
                    final_status = check_device_status_for_user(test_username)
                    if final_status.get("success") and final_status.get("is_activated"):
                        print("🎉 重新激活验证成功!")
                        return True
                    else:
                        print("❌ 重新激活验证失败")
                        return False
                else:
                    print(f"❌ 重新激活失败: {activation_result.get('error')}")
                    return False
        else:
            print(f"❌ 检查当前状态失败: {current_status.get('error')}")
            return False
            
    except Exception as e:
        print(f"❌ 测试过程中发生异常: {str(e)}")
        return False

def main():
    """主函数"""
    print("OneNET激活码激活流程测试工具")
    print("================================")
    
    print("选择测试模式:")
    print("1. 测试新用户的完整激活码激活流程")
    print("2. 测试已有用户的激活状态")
    print("3. 运行所有测试")
    print("4. 退出")
    
    choice = input("\n请选择测试模式 (1-4): ").strip()
    
    if choice == "1":
        success = test_activation_code_flow()
        print(f"\n🏁 新用户激活码激活流程测试: {'成功' if success else '失败'}")
    elif choice == "2":
        success = test_existing_user_activation()
        print(f"\n🏁 已有用户激活状态测试: {'成功' if success else '失败'}")
    elif choice == "3":
        print("\n🚀 运行所有测试...")
        success1 = test_activation_code_flow()
        success2 = test_existing_user_activation()
        
        print(f"\n🏁 测试结果总结:")
        print(f"   新用户激活码激活流程: {'成功' if success1 else '失败'}")
        print(f"   已有用户激活状态: {'成功' if success2 else '失败'}")
        print(f"   总体结果: {'全部成功' if success1 and success2 else '部分失败'}")
    elif choice == "4":
        print("退出测试")
        return
    else:
        print("无效选择，退出测试")
        return

if __name__ == "__main__":
    main()
