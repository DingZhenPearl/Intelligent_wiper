#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
设备重新激活工具
用于重新激活OneNET平台上的设备
"""

import json
import sys
import os
from datetime import datetime

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from onenet_api import activate_device_for_user, log

def reactivate_device(username):
    """重新激活用户设备"""
    print(f"=== 设备重新激活 - 用户: {username} ===")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    try:
        print("正在重新激活设备...")
        result = activate_device_for_user(username)
        
        print("激活结果:")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
        if result.get("success"):
            print(f"\n✅ 设备重新激活成功！")
            print(f"设备名称: {result.get('device_name')}")
            print(f"设备ID: {result.get('device_id')}")
            print(f"激活时间: {result.get('activate_time')}")
        else:
            print(f"\n❌ 设备重新激活失败: {result.get('error')}")
            
    except Exception as e:
        print(f"重新激活过程中发生异常: {e}")
        import traceback
        traceback.print_exc()

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python reactivate_device.py <username>")
        print("示例: python reactivate_device.py user5")
        sys.exit(1)
    
    username = sys.argv[1]
    
    # 确认操作
    confirm = input(f"确定要重新激活用户 {username} 的设备吗？(y/N): ")
    if confirm.lower() != 'y':
        print("操作已取消")
        sys.exit(0)
    
    reactivate_device(username)

if __name__ == "__main__":
    main()
