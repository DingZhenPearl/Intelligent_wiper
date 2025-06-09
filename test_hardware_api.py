#!/usr/bin/env python3
"""
硬件API测试脚本
演示硬件设备如何通过本地数据库获取设备凭证并连接OneNET平台
"""

import requests
import json
import time
import random

# 配置
LOCAL_SERVER_URL = "http://localhost:3000"
HARDWARE_MAC = "AA:BB:CC:DD:EE:FF"
HARDWARE_SERIAL = "HW123456789"
ACTIVATION_CODE = "WIPE-2550-92F7-98A9"

def log(message):
    """打印日志"""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def get_device_credentials_by_activation_code(activation_code):
    """通过激活码获取设备凭证"""
    try:
        log(f"通过激活码获取设备凭证: {activation_code}")
        
        url = f"{LOCAL_SERVER_URL}/api/hardware/device/credentials"
        params = {"activation_code": activation_code}
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                log("✅ 通过激活码获取设备凭证成功")
                return data
            else:
                log(f"❌ 获取设备凭证失败: {data.get('error')}")
                return None
        else:
            log(f"❌ HTTP请求失败，状态码: {response.status_code}")
            return None
            
    except Exception as e:
        log(f"❌ 获取设备凭证异常: {str(e)}")
        return None

def get_device_credentials_by_hardware(mac_address, hardware_serial):
    """通过硬件标识符获取设备凭证"""
    try:
        log(f"通过硬件标识符获取设备凭证: MAC={mac_address}, Serial={hardware_serial}")
        
        url = f"{LOCAL_SERVER_URL}/api/hardware/device/credentials"
        params = {"mac": mac_address, "serial": hardware_serial}
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                log("✅ 通过硬件标识符获取设备凭证成功")
                return data
            else:
                log(f"❌ 获取设备凭证失败: {data.get('error')}")
                return None
        else:
            log(f"❌ HTTP请求失败，状态码: {response.status_code}")
            return None
            
    except Exception as e:
        log(f"❌ 获取设备凭证异常: {str(e)}")
        return None

def update_device_status(mac_address, hardware_serial, status="online"):
    """更新设备状态"""
    try:
        log(f"更新设备状态: {status}")
        
        url = f"{LOCAL_SERVER_URL}/api/hardware/device/status"
        data = {
            "mac": mac_address,
            "serial": hardware_serial,
            "status": status,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        }
        
        response = requests.post(url, json=data, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                log("✅ 设备状态更新成功")
                return True
            else:
                log(f"❌ 设备状态更新失败: {result.get('error')}")
                return False
        else:
            log(f"❌ HTTP请求失败，状态码: {response.status_code}")
            return False
            
    except Exception as e:
        log(f"❌ 设备状态更新异常: {str(e)}")
        return False

def simulate_mqtt_connection(credentials):
    """模拟MQTT连接到OneNET平台"""
    log("🔗 模拟连接到OneNET平台...")
    
    device_id = credentials["credentials"]["device_id"]
    device_name = credentials["credentials"]["device_name"]
    mqtt_server = credentials["credentials"]["mqtt_server"]
    mqtt_port = credentials["credentials"]["mqtt_port"]
    
    log(f"设备ID: {device_id}")
    log(f"设备名称: {device_name}")
    log(f"MQTT服务器: {mqtt_server}:{mqtt_port}")
    
    # 模拟MQTT连接过程
    log("📡 正在建立MQTT连接...")
    time.sleep(1)
    log("✅ MQTT连接建立成功")
    
    # 模拟发送数据
    for i in range(3):
        rain_value = round(random.uniform(0, 100), 1)
        log(f"📊 发送雨量数据: {rain_value}mm")
        time.sleep(2)
    
    log("🎉 OneNET平台连接和数据传输完成")

def hardware_startup_simulation():
    """模拟硬件设备启动流程"""
    log("🚀 智能雨刷硬件设备启动")
    log("=" * 50)
    
    # 1. 读取硬件标识符
    log(f"📱 硬件MAC地址: {HARDWARE_MAC}")
    log(f"🔢 硬件序列号: {HARDWARE_SERIAL}")
    log(f"🎫 激活码: {ACTIVATION_CODE}")
    
    # 2. 尝试通过激活码获取设备凭证
    log("\n🔍 步骤1: 尝试通过激活码获取设备凭证")
    credentials = get_device_credentials_by_activation_code(ACTIVATION_CODE)
    
    if credentials:
        log("✅ 通过激活码获取凭证成功")
        simulate_mqtt_connection(credentials)
        return
    
    # 3. 尝试通过硬件标识符获取设备凭证
    log("\n🔍 步骤2: 尝试通过硬件标识符获取设备凭证")
    credentials = get_device_credentials_by_hardware(HARDWARE_MAC, HARDWARE_SERIAL)
    
    if credentials:
        log("✅ 通过硬件标识符获取凭证成功")
        simulate_mqtt_connection(credentials)
        
        # 更新设备状态
        log("\n📊 步骤3: 更新设备状态")
        update_device_status(HARDWARE_MAC, HARDWARE_SERIAL, "online")
        return
    
    # 4. 获取凭证失败，进入配网模式
    log("\n❌ 无法获取设备凭证")
    log("🔧 进入配网模式...")
    log("⏳ 等待用户配置激活码或网络参数")

def test_api_endpoints():
    """测试所有API端点"""
    log("🧪 开始API端点测试")
    log("=" * 50)
    
    # 测试1: 通过激活码查询
    log("\n🧪 测试1: 通过激活码查询设备凭证")
    result = get_device_credentials_by_activation_code(ACTIVATION_CODE)
    if result:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 测试2: 通过硬件标识符查询
    log("\n🧪 测试2: 通过硬件标识符查询设备凭证")
    result = get_device_credentials_by_hardware(HARDWARE_MAC, HARDWARE_SERIAL)
    if result:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 测试3: 更新设备状态
    log("\n🧪 测试3: 更新设备状态")
    update_device_status(HARDWARE_MAC, HARDWARE_SERIAL, "online")
    
    # 测试4: 获取访问日志
    log("\n🧪 测试4: 获取硬件访问日志")
    try:
        url = f"{LOCAL_SERVER_URL}/api/hardware/access-logs/user6"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            log("✅ 获取访问日志成功")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        else:
            log(f"❌ 获取访问日志失败，状态码: {response.status_code}")
    except Exception as e:
        log(f"❌ 获取访问日志异常: {str(e)}")

def main():
    """主函数"""
    print("🎯 智能雨刷硬件API测试程序")
    print("=" * 60)
    
    while True:
        print("\n请选择测试模式:")
        print("1. 硬件启动流程模拟")
        print("2. API端点功能测试")
        print("3. 退出程序")
        
        choice = input("\n请输入选择 (1-3): ").strip()
        
        if choice == "1":
            print("\n" + "=" * 60)
            hardware_startup_simulation()
        elif choice == "2":
            print("\n" + "=" * 60)
            test_api_endpoints()
        elif choice == "3":
            log("👋 程序退出")
            break
        else:
            log("❌ 无效选择，请重新输入")
        
        input("\n按回车键继续...")

if __name__ == "__main__":
    main()
