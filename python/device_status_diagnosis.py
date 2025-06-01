#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
设备状态诊断工具
用于诊断设备激活状态显示不一致的问题
"""

import json
import sys
import os
from datetime import datetime

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from onenet_api import check_device_status_for_user, log

def diagnose_device_status(username):
    """诊断用户设备状态"""
    print(f"=== 设备状态诊断报告 - 用户: {username} ===")
    print(f"诊断时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # 1. 检查OneNET平台状态
    print("1. 检查OneNET平台设备状态...")
    try:
        onenet_status = check_device_status_for_user(username)
        print(f"OneNET平台查询结果:")
        print(json.dumps(onenet_status, ensure_ascii=False, indent=2))
        print()
        
        if onenet_status.get("success"):
            device_info = onenet_status.get("device_info", {})
            activate_time = onenet_status.get("activate_time")
            last_time = onenet_status.get("last_time")
            is_activated = onenet_status.get("is_activated", False)
            
            print(f"设备名称: {onenet_status.get('device_name')}")
            print(f"激活状态: {'已激活' if is_activated else '未激活'}")
            print(f"激活时间: {activate_time}")
            print(f"最后活动时间: {last_time}")
            print()
            
            # 分析激活时间
            print("2. 激活时间分析...")
            if activate_time:
                print(f"原始激活时间: '{activate_time}'")
                print(f"时间类型: {type(activate_time)}")
                
                # 检查是否为默认时间
                default_patterns = [
                    "0001-01-01T08:05:43+08:05",
                    "0001-01-01T00:00:00Z",
                    "1970-01-01T00:00:00Z"
                ]
                
                is_default = activate_time in default_patterns
                print(f"是否为默认时间: {is_default}")
                
                if not is_default:
                    try:
                        parsed_time = datetime.fromisoformat(activate_time.replace('Z', '+00:00'))
                        print(f"解析后的时间: {parsed_time}")
                        print(f"年份: {parsed_time.year}")
                        print(f"是否为有效激活时间 (>= 2020): {parsed_time.year >= 2020}")
                    except Exception as e:
                        print(f"时间解析失败: {e}")
                
            else:
                print("激活时间为空")
            print()
            
        else:
            print(f"OneNET平台查询失败: {onenet_status.get('error')}")
            
    except Exception as e:
        print(f"OneNET平台查询异常: {e}")
        import traceback
        traceback.print_exc()
    
    # 2. 检查本地数据
    print("3. 检查本地激活数据...")
    try:
        local_data_path = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'device_activations.json')
        if os.path.exists(local_data_path):
            with open(local_data_path, 'r', encoding='utf-8') as f:
                local_data = json.load(f)
            
            user_activation = local_data.get('activations', {}).get(username)
            if user_activation:
                print(f"本地激活记录:")
                print(json.dumps(user_activation, ensure_ascii=False, indent=2))
                print()
                
                print(f"本地设备ID: {user_activation.get('deviceId')}")
                print(f"本地激活时间: {user_activation.get('activatedAt')}")
                print(f"本地激活码: {user_activation.get('activationCode')}")
                print()
            else:
                print(f"本地没有找到用户 {username} 的激活记录")
        else:
            print(f"本地激活数据文件不存在: {local_data_path}")
            
    except Exception as e:
        print(f"检查本地数据失败: {e}")
    
    # 3. 问题分析和建议
    print("4. 问题分析和建议...")
    print("根据您的描述，设备状态显示'未激活'但有激活时间，可能的原因:")
    print("- OneNET平台的激活时间格式或值不符合系统的激活判断逻辑")
    print("- 本地数据与OneNET平台数据不同步")
    print("- 激活状态判断逻辑过于严格")
    print()
    
    print("建议的解决方案:")
    print("1. 检查OneNET平台返回的实际激活时间值")
    print("2. 更新激活状态判断逻辑，使其更宽松")
    print("3. 手动同步本地数据与OneNET平台数据")
    print("4. 重新激活设备以确保状态一致")
    print()

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python device_status_diagnosis.py <username>")
        print("示例: python device_status_diagnosis.py user5")
        sys.exit(1)
    
    username = sys.argv[1]
    diagnose_device_status(username)

if __name__ == "__main__":
    main()
