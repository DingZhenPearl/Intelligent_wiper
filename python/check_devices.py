#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
检查OneNET平台上的设备
"""

from onenet_api import generate_token, ONENET_API_BASE, PRODUCT_ID, get_user_device_config
import requests
import json

def check_onenet_devices():
    """检查OneNET平台上的设备"""
    
    print("OneNET平台设备检查")
    print("=" * 50)
    
    token = generate_token()
    if not token:
        print("❌ 无法生成OneNET token")
        return
    
    # 查询产品下的所有设备
    url = f"{ONENET_API_BASE}/device"
    headers = {
        "authorization": token,
        "Content-Type": "application/json"
    }
    params = {
        "product_id": PRODUCT_ID,
        "limit": 100
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 0:
                devices = data.get('data', {}).get('devices', [])
                print(f"✅ 找到 {len(devices)} 个设备:")
                for device in devices:
                    device_name = device.get('name', 'N/A')
                    device_id = device.get('id', 'N/A')
                    online = device.get('online', False)
                    status = "在线" if online else "离线"
                    print(f"   - {device_name} (ID: {device_id}) - {status}")
            else:
                print(f"❌ OneNET API错误: {data.get('msg', 'Unknown error')}")
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            print(f"   响应: {response.text}")
    except Exception as e:
        print(f"❌ 请求异常: {str(e)}")

def check_user_devices():
    """检查用户设备配置"""
    
    print("\n用户设备配置检查")
    print("=" * 50)
    
    test_users = ['admin', 'user1', 'user2', 'user3']
    
    for username in test_users:
        device_config = get_user_device_config(username)
        device_name = device_config['device_name']
        device_id = device_config.get('device_id', 'None')
        
        print(f"用户: {username:8} -> 设备: {device_name:25} (ID: {device_id})")

def main():
    """主函数"""
    check_onenet_devices()
    check_user_devices()
    
    print("\n" + "=" * 50)
    print("结论:")
    print("如果用户设备的ID为None，说明该设备在OneNET平台上不存在")
    print("这就是为什么控制命令总是发送到test设备的原因")

if __name__ == "__main__":
    main()
