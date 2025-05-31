#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
设备连接模拟器 - 模拟智能雨刷设备连接到OneNET平台
"""

import json
import sys
import argparse
import time
import random
from datetime import datetime
import requests
import hashlib
import hmac
import base64
from urllib.parse import quote

class OneNETDeviceSimulator:
    def __init__(self):
        self.product_id = "66eIb47012"
        self.api_key = "=LKJHGFDSAqwertyuiop1234567890MNBVCXZ="
        self.base_url = "https://iot-api.heclouds.com"
        
    def generate_token(self, method="GET", url="", body=""):
        """生成OneNET API访问token"""
        try:
            # 设置token参数
            version = '2018-10-31'
            res = f"products/{self.product_id}"
            # 设置token过期时间，这里设置为10小时后过期
            et = str(int(time.time()) + 36000)
            # 签名方法，支持md5、sha1、sha256
            method = 'sha1'

            # 对access_key进行decode
            key = base64.b64decode(self.api_key)

            # 计算sign
            org = et + '\n' + method + '\n' + res + '\n' + version
            sign_b = hmac.new(key=key, msg=org.encode(), digestmod=method)
            sign = base64.b64encode(sign_b.digest()).decode()

            # value部分进行url编码
            sign = quote(sign, safe='')
            res = quote(res, safe='')

            # token参数拼接
            token = f'version={version}&res={res}&et={et}&method={method}&sign={sign}'

            print(f"LOG: 生成的OneNET token: {token[:50]}...")
            return token

        except Exception as e:
            print(f"ERROR: 生成token失败: {e}")
            return None
    
    def simulate_device_connection(self, device_name, device_id):
        """模拟设备连接到OneNET平台"""
        try:
            print(f"LOG: 开始模拟设备连接: {device_name} (ID: {device_id})")
            
            # 1. 模拟设备上线 - 发送设备状态数据
            self.send_device_status(device_name, device_id, online=True)
            
            # 2. 模拟发送初始雨量数据
            self.send_rainfall_data(device_name, device_id, 0.0)
            
            # 3. 模拟发送几条测试数据
            for i in range(3):
                time.sleep(2)  # 等待2秒
                rainfall = round(random.uniform(0, 10), 1)  # 随机雨量值
                self.send_rainfall_data(device_name, device_id, rainfall)
            
            print(f"LOG: 设备连接模拟完成: {device_name}")
            return True
            
        except Exception as e:
            print(f"ERROR: 设备连接模拟失败: {e}")
            return False
    
    def send_device_status(self, device_name, device_id, online=True):
        """发送设备状态数据"""
        try:
            # 构建状态数据
            status_data = {
                "device_status": "online" if online else "offline",
                "timestamp": datetime.now().isoformat(),
                "signal_strength": random.randint(80, 100),
                "battery_level": random.randint(85, 100)
            }

            # 使用正确的OneNET数据上传API端点
            url = f"/datapoint/datapoints"
            token = self.generate_token("POST", url)

            headers = {
                "authorization": token,
                "Content-Type": "application/json"
            }

            payload = {
                "product_id": self.product_id,
                "device_name": device_name,
                "datastreams": [
                    {
                        "identifier": "device_status",
                        "datapoints": [
                            {
                                "value": json.dumps(status_data),
                                "at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
                            }
                        ]
                    }
                ]
            }

            response = requests.post(
                f"{self.base_url}{url}",
                headers=headers,
                json=payload,
                timeout=30
            )

            print(f"LOG: 设备状态发送结果: {response.status_code}")
            if response.status_code == 200:
                print(f"LOG: 设备 {device_name} 状态更新成功")
            else:
                print(f"LOG: 设备状态发送失败: {response.text}")

        except Exception as e:
            print(f"ERROR: 发送设备状态失败: {e}")
    
    def send_rainfall_data(self, device_name, device_id, rainfall_value):
        """发送雨量数据"""
        try:
            # 使用正确的OneNET数据上传API端点
            url = f"/datapoint/datapoints"
            token = self.generate_token("POST", url)

            headers = {
                "authorization": token,
                "Content-Type": "application/json"
            }

            payload = {
                "product_id": self.product_id,
                "device_name": device_name,
                "datastreams": [
                    {
                        "identifier": "rain_info",
                        "datapoints": [
                            {
                                "value": rainfall_value,
                                "at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
                            }
                        ]
                    }
                ]
            }

            response = requests.post(
                f"{self.base_url}{url}",
                headers=headers,
                json=payload,
                timeout=30
            )

            print(f"LOG: 雨量数据发送结果: {response.status_code}, 雨量值: {rainfall_value}")
            if response.status_code == 200:
                print(f"LOG: 设备 {device_name} 雨量数据发送成功")
            else:
                print(f"LOG: 雨量数据发送失败: {response.text}")

        except Exception as e:
            print(f"ERROR: 发送雨量数据失败: {e}")

def main():
    parser = argparse.ArgumentParser(description='OneNET设备连接模拟器')
    parser.add_argument('action', choices=['simulate_connection'], help='操作类型')
    parser.add_argument('--device_name', required=True, help='设备名称')
    parser.add_argument('--device_id', required=True, help='设备ID')
    
    args = parser.parse_args()
    
    simulator = OneNETDeviceSimulator()
    
    if args.action == 'simulate_connection':
        success = simulator.simulate_device_connection(args.device_name, args.device_id)
        result = {
            "success": success,
            "message": "设备连接模拟完成" if success else "设备连接模拟失败",
            "device_name": args.device_name,
            "device_id": args.device_id
        }
        print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
