#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OneNET MQTT设备激活器 - 通过MQTT连接真正激活设备
"""

import json
import sys
import argparse
import time
import random
import hashlib
import hmac
import base64
from datetime import datetime
import paho.mqtt.client as mqtt
from urllib.parse import quote

class OneNETMQTTActivator:
    def __init__(self):
        self.product_id = "66eIb47012"
        self.api_key = "=LKJHGFDSAqwertyuiop1234567890MNBVCXZ="
        self.device_sec_key = None  # 将从设备信息中获取
        
        # OneNET MQTT服务器配置
        self.mqtt_host = "mqtts.heclouds.com"
        self.mqtt_port = 1883
        self.mqtt_port_ssl = 8883
        
        self.client = None
        self.connected = False
        self.activation_success = False
        
    def generate_mqtt_password(self, device_name):
        """生成MQTT连接密码"""
        try:
            # 设置token参数
            version = '2018-10-31'
            res = f"products/{self.product_id}/devices/{device_name}"
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
            password = f'version={version}&res={res}&et={et}&method={method}&sign={sign}'

            print(f"LOG: 生成的MQTT密码: {password[:50]}...")
            return password
            
        except Exception as e:
            print(f"ERROR: 生成MQTT密码失败: {e}")
            return None
    
    def on_connect(self, client, userdata, flags, rc):
        """MQTT连接回调"""
        if rc == 0:
            print(f"LOG: MQTT连接成功")
            self.connected = True
            
            # 连接成功后发送设备激活数据
            self.send_activation_data()
        else:
            print(f"ERROR: MQTT连接失败，返回码: {rc}")
            self.connected = False
    
    def on_disconnect(self, client, userdata, rc):
        """MQTT断开连接回调"""
        print(f"LOG: MQTT连接断开，返回码: {rc}")
        self.connected = False
    
    def on_publish(self, client, userdata, mid):
        """MQTT发布消息回调"""
        print(f"LOG: 消息发布成功，消息ID: {mid}")
        self.activation_success = True
    
    def on_message(self, client, userdata, msg):
        """MQTT接收消息回调"""
        print(f"LOG: 收到消息，主题: {msg.topic}, 内容: {msg.payload.decode()}")
    
    def send_activation_data(self):
        """发送设备激活数据"""
        try:
            # 构建设备激活数据
            activation_data = {
                "id": int(time.time() * 1000),  # 消息ID
                "version": "1.0",
                "sys": {
                    "ack": 0
                },
                "params": {
                    "rain_info": {
                        "value": 0.0,
                        "time": int(time.time() * 1000)
                    },
                    "device_status": {
                        "value": "online",
                        "time": int(time.time() * 1000)
                    }
                },
                "method": "thing.property.post"
            }
            
            # 发布到物模型属性上报主题
            topic = f"$sys/{self.product_id}/{self.device_name}/thing/property/post"
            payload = json.dumps(activation_data)
            
            print(f"LOG: 发送激活数据到主题: {topic}")
            print(f"LOG: 激活数据: {payload}")
            
            result = self.client.publish(topic, payload, qos=1)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"LOG: 激活数据发送成功")
            else:
                print(f"ERROR: 激活数据发送失败，错误码: {result.rc}")
                
        except Exception as e:
            print(f"ERROR: 发送激活数据失败: {e}")
    
    def activate_device(self, device_name, device_id, sec_key=None):
        """激活指定设备"""
        try:
            print(f"LOG: 开始激活设备: {device_name} (ID: {device_id})")

            self.device_name = device_name
            self.device_id = device_id

            # 如果提供了sec_key，使用它作为密码
            if sec_key:
                print(f"LOG: 使用设备sec_key作为MQTT密码")
                password = base64.b64decode(sec_key).decode('utf-8')
                print(f"LOG: 解码后的密码: {password[:20]}...")
            else:
                # 生成MQTT连接密码
                password = self.generate_mqtt_password(device_name)
                if not password:
                    return {
                        "success": False,
                        "error": "生成MQTT密码失败"
                    }
            
            # 创建MQTT客户端（使用新版API）
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=device_name)
            
            # 设置回调函数
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_publish = self.on_publish
            self.client.on_message = self.on_message
            
            # 设置用户名和密码
            self.client.username_pw_set(username=device_name, password=password)
            
            print(f"LOG: 连接到MQTT服务器: {self.mqtt_host}:{self.mqtt_port}")
            
            # 连接到MQTT服务器
            self.client.connect(self.mqtt_host, self.mqtt_port, 60)
            
            # 启动网络循环
            self.client.loop_start()
            
            # 等待连接和数据发送
            timeout = 30  # 30秒超时
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                if self.connected and self.activation_success:
                    print(f"LOG: 设备激活成功")
                    break
                time.sleep(1)
            
            # 停止网络循环并断开连接
            self.client.loop_stop()
            self.client.disconnect()
            
            if self.connected and self.activation_success:
                return {
                    "success": True,
                    "device_name": device_name,
                    "device_id": device_id,
                    "message": f"设备 {device_name} 通过MQTT激活成功"
                }
            else:
                return {
                    "success": False,
                    "error": f"设备激活超时或失败，连接状态: {self.connected}, 激活状态: {self.activation_success}"
                }
                
        except Exception as e:
            error_msg = f"MQTT设备激活失败: {str(e)}"
            print(f"ERROR: {error_msg}")
            return {"success": False, "error": error_msg}

def main():
    parser = argparse.ArgumentParser(description='OneNET MQTT设备激活器')
    parser.add_argument('action', choices=['activate'], help='操作类型')
    parser.add_argument('--device_name', required=True, help='设备名称')
    parser.add_argument('--device_id', required=True, help='设备ID')
    parser.add_argument('--sec_key', help='设备安全密钥')

    args = parser.parse_args()

    activator = OneNETMQTTActivator()

    if args.action == 'activate':
        result = activator.activate_device(args.device_name, args.device_id, args.sec_key)
        print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
