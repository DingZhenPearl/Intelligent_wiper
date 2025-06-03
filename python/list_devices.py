#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
查看OneNET平台上的设备列表
"""

import requests
from onenet_api import generate_token, ONENET_API_BASE, PRODUCT_ID
from rainfall_db import log

def list_all_devices():
    """列出所有设备"""
    try:
        # 生成token
        token = generate_token()
        if not token:
            print("无法生成token")
            return

        # API端点
        url = f"{ONENET_API_BASE}/devices"
        
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }
        params = {
            "product_id": PRODUCT_ID,
            "limit": 100
        }

        print(f"查询设备列表...")
        print(f"API端点: {url}")
        print(f"产品ID: {PRODUCT_ID}")
        
        response = requests.get(url, headers=headers, params=params)
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 0 or data.get('errno') == 0:
                devices = data.get('data', {}).get('devices', [])
                print(f"\n找到 {len(devices)} 个设备:")
                print("=" * 50)
                
                for i, device in enumerate(devices, 1):
                    device_name = device.get('title', device.get('name', '未知'))
                    device_id = device.get('id', '未知')
                    status = device.get('status', '未知')
                    print(f"{i}. 设备名称: {device_name}")
                    print(f"   设备ID: {device_id}")
                    print(f"   状态: {status}")
                    print(f"   完整信息: {device}")
                    print("-" * 30)
                
                return devices
            else:
                print(f"API错误: {data}")
        else:
            print(f"HTTP错误: {response.status_code}")
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"查询设备列表失败: {e}")

if __name__ == "__main__":
    list_all_devices()
