#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
显示可用的激活码
"""

import json
import os

def show_available_codes():
    """显示可用的激活码"""
    activation_file = "server/data/device_activations.json"
    
    if not os.path.exists(activation_file):
        print("❌ 激活码数据文件不存在")
        return
    
    try:
        with open(activation_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        codes = data.get("activationCodes", {})
        available_codes = {code: info for code, info in codes.items() if not info.get("isUsed", False)}
        
        print("🔓 可用的激活码列表")
        print("=" * 80)
        print(f"{'激活码':<20} {'设备型号':<30} {'序列号':<15} {'固件版本'}")
        print("-" * 80)
        
        if not available_codes:
            print("❌ 没有可用的激活码")
            return
        
        for code, info in available_codes.items():
            device_model = info.get('deviceModel', '未知')[:29]
            serial_number = info.get('serialNumber', '未知')
            firmware_version = info.get('firmwareVersion', '未知')
            
            print(f"{code:<20} {device_model:<30} {serial_number:<15} {firmware_version}")
        
        print("-" * 80)
        print(f"📊 总计 {len(available_codes)} 个可用激活码")
        
        print("\n💡 使用说明:")
        print("1. 复制上面的任意一个激活码")
        print("2. 启动前端应用")
        print("3. 前往设置页面")
        print("4. 在设备激活区域输入激活码")
        print("5. 点击'激活设备'按钮")
        print("6. 激活成功后，该激活码将不再可用")
        
        print("\n🎯 推荐测试激活码:")
        wiper_codes = [code for code in available_codes.keys() if 'WIPER' in code]
        if wiper_codes:
            for code in wiper_codes[:3]:  # 显示前3个激活码
                print(f"   • {code}")

    except Exception as e:
        print(f"❌ 读取激活码文件失败: {e}")

if __name__ == "__main__":
    show_available_codes()
