#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
使用MQTT方式进行设备控制
绕过物模型配置问题，直接通过MQTT主题发送控制命令
"""

import sys
import json
import time
import base64
import hmac
import hashlib
from urllib.parse import quote
import paho.mqtt.client as mqtt
import ssl
from onenet_api import (
    PRODUCT_ID,
    ACCESS_KEY,
    get_user_device_config
)
from rainfall_db import log

class MQTTDeviceController:
    def __init__(self, username='admin'):
        self.username = username
        self.device_config = get_user_device_config(username)
        self.device_name = self.device_config['device_name']
        self.device_id = self.device_config.get('device_id')
        
        # MQTT配置 - 尝试不同的服务器地址
        self.mqtt_servers = [
            ("183.230.40.96", 1883),  # OneNET MQTT服务器1
            ("mqtts.heclouds.com", 1883),  # OneNET MQTT服务器2
            ("183.230.40.39", 6002),  # OneNET MQTT服务器3
        ]
        self.mqtt_host = self.mqtt_servers[0][0]
        self.mqtt_port = self.mqtt_servers[0][1]
        self.client_id = self.device_name  # 使用设备名称作为客户端ID
        self.username_mqtt = PRODUCT_ID  # 使用产品ID作为用户名
        self.password_mqtt = self.generate_mqtt_password()  # 生成MQTT密码
        
        # MQTT客户端
        self.client = None
        self.connected = False
        self.command_result = None
        
        log(f"初始化MQTT设备控制器，用户: {username}, 设备: {self.device_name}")

    def generate_mqtt_password(self):
        """生成MQTT连接密码"""
        try:
            # 设置token参数
            version = '2018-10-31'
            res = f"products/{PRODUCT_ID}/devices/{self.device_name}"
            # 设置token过期时间，这里设置为10小时后过期
            et = str(int(time.time()) + 36000)
            # 签名方法，支持md5、sha1、sha256
            method = 'sha1'

            # 对access_key进行decode
            key = base64.b64decode(ACCESS_KEY)

            # 计算sign
            org = et + '\n' + method + '\n' + res + '\n' + version
            sign_b = hmac.new(key=key, msg=org.encode(), digestmod=method)
            sign = base64.b64encode(sign_b.digest()).decode()

            # value部分进行url编码
            sign = quote(sign, safe='')
            res = quote(res, safe='')

            # token参数拼接
            password = f'version={version}&res={res}&et={et}&method={method}&sign={sign}'

            log(f"生成的MQTT密码: {password[:50]}...")
            return password
        except Exception as e:
            log(f"生成MQTT密码失败: {str(e)}")
            return None

    def get_mqtt_topics(self):
        """获取MQTT主题"""
        return {
            'command': f"$sys/{PRODUCT_ID}/{self.device_name}/thing/property/set",
            'command_reply': f"$sys/{PRODUCT_ID}/{self.device_name}/thing/property/set_reply",
            'property_post': f"$sys/{PRODUCT_ID}/{self.device_name}/thing/property/post",
            'property_post_reply': f"$sys/{PRODUCT_ID}/{self.device_name}/thing/property/post/reply"
        }

    def on_connect(self, client, userdata, flags, rc):
        """MQTT连接回调"""
        if rc == 0:
            self.connected = True
            log(f"MQTT连接成功，设备: {self.device_name}")
            
            # 订阅回复主题
            topics = self.get_mqtt_topics()
            client.subscribe(topics['command_reply'])
            client.subscribe(topics['property_post_reply'])
            log(f"订阅主题: {topics['command_reply']}")
            log(f"订阅主题: {topics['property_post_reply']}")
        else:
            log(f"MQTT连接失败，错误码: {rc}")

    def on_message(self, client, userdata, msg):
        """MQTT消息回调"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            log(f"收到MQTT消息，主题: {topic}, 内容: {payload}")
            
            # 解析消息
            message_data = json.loads(payload)
            
            # 检查是否是命令回复
            if 'id' in message_data and 'code' in message_data:
                self.command_result = message_data
                log(f"收到命令回复: {message_data}")
                
        except Exception as e:
            log(f"处理MQTT消息失败: {str(e)}")

    def connect_mqtt(self):
        """连接MQTT - 尝试多个服务器"""
        # 检查密码是否生成成功
        if not self.password_mqtt:
            log("MQTT密码生成失败，无法连接")
            return False

        # 尝试每个MQTT服务器
        for i, (host, port) in enumerate(self.mqtt_servers):
            try:
                log(f"尝试MQTT服务器 {i+1}/{len(self.mqtt_servers)}: {host}:{port}")

                self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=self.client_id)
                self.client.username_pw_set(self.username_mqtt, self.password_mqtt)
                self.client.on_connect = self.on_connect
                self.client.on_message = self.on_message

                log(f"客户端ID: {self.client_id}")
                log(f"用户名: {self.username_mqtt}")
                log(f"密码: {self.password_mqtt[:50]}...")

                self.connected = False
                self.client.connect(host, port, 60)
                self.client.loop_start()

                # 等待连接
                timeout = 10
                start_time = time.time()
                while not self.connected and (time.time() - start_time) < timeout:
                    time.sleep(0.1)

                if self.connected:
                    log(f"✅ MQTT连接成功！服务器: {host}:{port}")
                    self.mqtt_host = host
                    self.mqtt_port = port
                    return True
                else:
                    log(f"❌ MQTT连接超时，服务器: {host}:{port}")
                    self.client.loop_stop()
                    self.client.disconnect()

            except Exception as e:
                log(f"❌ MQTT连接异常，服务器: {host}:{port}, 错误: {str(e)}")
                if self.client:
                    try:
                        self.client.loop_stop()
                        self.client.disconnect()
                    except:
                        pass
                continue

        log("❌ 所有MQTT服务器连接失败")
        return False

    def send_control_command(self, command):
        """发送控制命令"""
        try:
            if not self.connected:
                if not self.connect_mqtt():
                    return {"success": False, "error": "MQTT连接失败"}
            
            # 构建控制命令
            command_data = {
                "id": int(time.time() * 1000),
                "version": "1.0",
                "params": {
                    "wiper_control": {
                        "value": command,
                        "time": int(time.time() * 1000)
                    }
                },
                "method": "thing.property.set"
            }
            
            # 发送命令
            topics = self.get_mqtt_topics()
            command_topic = topics['command']
            payload = json.dumps(command_data)
            
            log(f"发送控制命令到主题: {command_topic}")
            log(f"命令内容: {payload}")
            
            result = self.client.publish(command_topic, payload, qos=1)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                log("控制命令发送成功")
                
                # 等待回复
                self.command_result = None
                timeout = 5
                start_time = time.time()
                while self.command_result is None and (time.time() - start_time) < timeout:
                    time.sleep(0.1)
                
                if self.command_result:
                    if self.command_result.get('code') == 200:
                        return {
                            "success": True,
                            "message": "设备控制命令发送成功",
                            "command": command,
                            "device_name": self.device_name,
                            "device_id": self.device_id,
                            "method": "MQTT",
                            "response": self.command_result
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"设备返回错误: {self.command_result.get('msg', '未知错误')}",
                            "response": self.command_result
                        }
                else:
                    return {
                        "success": True,
                        "message": "控制命令已发送，但未收到设备回复（可能设备离线）",
                        "command": command,
                        "device_name": self.device_name,
                        "device_id": self.device_id,
                        "method": "MQTT"
                    }
            else:
                return {"success": False, "error": f"MQTT发送失败，错误码: {result.rc}"}
                
        except Exception as e:
            return {"success": False, "error": f"发送控制命令失败: {str(e)}"}

    def disconnect(self):
        """断开MQTT连接"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            self.connected = False
            log("MQTT连接已断开")

def send_wiper_command_mqtt(command, username='admin'):
    """通过MQTT发送雨刷控制命令"""
    controller = MQTTDeviceController(username)
    try:
        result = controller.send_control_command(command)
        return result
    finally:
        controller.disconnect()

def main():
    """主函数"""
    if len(sys.argv) >= 3:
        username = sys.argv[1]
        command = sys.argv[2]
        
        print(f"🎯 通过MQTT控制用户 {username} 的设备")
        print("-" * 40)
        
        result = send_wiper_command_mqtt(command, username)
        
        print("📊 控制结果:")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("用法: python mqtt_device_control.py <username> <command>")
        print("示例: python mqtt_device_control.py user1 low")

if __name__ == "__main__":
    main()
