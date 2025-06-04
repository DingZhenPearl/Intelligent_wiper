#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
硬件命令测试脚本
用于测试真实硬件设备的命令处理能力
"""

import json
import time
import subprocess
import sys

def test_hardware_command(device_name, command_data, timeout=10):
    """测试硬件设备命令处理"""
    print(f"\n🧪 测试硬件设备: {device_name}")
    print(f"📤 发送命令: {json.dumps(command_data, ensure_ascii=False)}")
    print("=" * 60)
    
    try:
        # 使用HTTP同步命令发送到硬件设备
        result = subprocess.run([
            'python', 'python/onenet_http_control.py',
            '--action', 'control' if 'wiper_control' in command_data else 'get-status',
            '--status', command_data.get('wiper_control', 'off'),
            '--username', 'hardware_test',
            '--device-name', device_name,
            '--timeout', str(timeout)
        ], capture_output=True, text=True, timeout=timeout + 5)
        
        print(f"📋 返回码: {result.returncode}")
        
        if result.stdout:
            print(f"📄 硬件响应:")
            try:
                response_data = json.loads(result.stdout)
                print(json.dumps(response_data, indent=2, ensure_ascii=False))
                return response_data
            except:
                print(result.stdout)
                return None
        
        if result.stderr:
            print(f"📝 执行日志:")
            for line in result.stderr.split('\n'):
                if line.strip():
                    print(f"  {line}")
        
        return None
        
    except subprocess.TimeoutExpired:
        print("❌ 硬件命令测试超时")
        return None
    except Exception as e:
        print(f"❌ 硬件命令测试错误: {e}")
        return None

def validate_hardware_response(response, expected_fields):
    """验证硬件响应格式"""
    print(f"\n🔍 验证硬件响应格式")
    print("-" * 40)
    
    if not response:
        print("❌ 无响应数据")
        return False
    
    validation_passed = True
    
    # 检查基本结构
    if 'errno' not in response:
        print("❌ 缺少 errno 字段")
        validation_passed = False
    else:
        errno = response['errno']
        print(f"✅ errno: {errno}")
        
        if errno == 0:
            # 成功响应检查
            if 'data' not in response:
                print("❌ 成功响应缺少 data 字段")
                validation_passed = False
            else:
                data = response['data']
                for field in expected_fields:
                    if field in data:
                        print(f"✅ {field}: {data[field]}")
                    else:
                        print(f"❌ 缺少字段: {field}")
                        validation_passed = False
        else:
            # 错误响应检查
            if 'error' in response:
                print(f"✅ error: {response['error']}")
            if 'message' in response:
                print(f"✅ message: {response['message']}")
    
    return validation_passed

def run_hardware_test_suite(device_name):
    """运行完整的硬件测试套件"""
    print(f"🚀 开始硬件设备测试套件")
    print(f"📱 目标设备: {device_name}")
    print("=" * 80)
    
    test_cases = [
        {
            "name": "雨刷关闭命令",
            "command": {"wiper_control": "off", "command_id": "hw_test_001", "user": "hardware_test"},
            "expected_fields": ["wiper_status", "message", "timestamp", "command_id"]
        },
        {
            "name": "雨刷低速命令", 
            "command": {"wiper_control": "low", "command_id": "hw_test_002", "user": "hardware_test"},
            "expected_fields": ["wiper_status", "previous_status", "message", "timestamp", "command_id"]
        },
        {
            "name": "雨刷高速命令",
            "command": {"wiper_control": "high", "command_id": "hw_test_003", "user": "hardware_test"},
            "expected_fields": ["wiper_status", "previous_status", "message", "timestamp", "command_id"]
        },
        {
            "name": "雨刷智能命令",
            "command": {"wiper_control": "smart", "command_id": "hw_test_004", "user": "hardware_test"},
            "expected_fields": ["wiper_status", "previous_status", "message", "timestamp", "command_id"]
        },
        {
            "name": "雨刷间歇命令",
            "command": {"wiper_control": "interval", "command_id": "hw_test_005", "user": "hardware_test"},
            "expected_fields": ["wiper_status", "previous_status", "message", "timestamp", "command_id"]
        },
        {
            "name": "状态查询命令",
            "command": {"wiper_status_query": True, "command_id": "hw_test_006", "user": "hardware_test"},
            "expected_fields": ["wiper_status", "message", "timestamp", "command_id"]
        },
        {
            "name": "无效命令测试",
            "command": {"wiper_control": "invalid", "command_id": "hw_test_007", "user": "hardware_test"},
            "expected_fields": [],  # 错误响应不检查data字段
            "expect_error": True
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 测试 {i}/{len(test_cases)}: {test_case['name']}")
        print("=" * 60)
        
        # 发送命令
        response = test_hardware_command(device_name, test_case['command'])
        
        # 验证响应
        if response:
            if test_case.get('expect_error', False):
                # 期望错误响应
                if response.get('errno', 0) != 0:
                    print("✅ 错误处理正确")
                    validation_passed = True
                else:
                    print("❌ 应该返回错误但返回了成功")
                    validation_passed = False
            else:
                # 期望成功响应
                validation_passed = validate_hardware_response(response, test_case['expected_fields'])
        else:
            validation_passed = False
        
        results.append({
            'test_name': test_case['name'],
            'passed': validation_passed,
            'response': response
        })
        
        # 测试间隔
        if i < len(test_cases):
            print(f"\n⏳ 等待2秒后执行下一个测试...")
            time.sleep(2)
    
    # 测试结果汇总
    print("\n" + "=" * 80)
    print("📈 硬件测试结果汇总")
    print("=" * 80)
    
    passed_tests = sum(1 for result in results if result['passed'])
    total_tests = len(results)
    
    print(f"📊 测试总数: {total_tests}")
    print(f"✅ 通过测试: {passed_tests}")
    print(f"❌ 失败测试: {total_tests - passed_tests}")
    print(f"📊 成功率: {passed_tests/total_tests*100:.1f}%")
    
    print(f"\n📋 详细结果:")
    for result in results:
        status = "✅ 通过" if result['passed'] else "❌ 失败"
        print(f"  {status} - {result['test_name']}")
    
    # 硬件兼容性评估
    print(f"\n🔧 硬件兼容性评估:")
    if passed_tests == total_tests:
        print("✅ 硬件完全兼容，所有功能正常")
        print("✅ 可以进行生产环境部署")
    elif passed_tests >= total_tests * 0.8:
        print("⚠️ 硬件基本兼容，部分功能需要调整")
        print("⚠️ 建议修复失败的测试后再部署")
    else:
        print("❌ 硬件兼容性较差，需要重大修改")
        print("❌ 不建议部署到生产环境")
    
    return passed_tests == total_tests

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("使用方法: python test_hardware_commands.py <device_name>")
        print("示例: python test_hardware_commands.py intelligent_wiper_hw001")
        sys.exit(1)
    
    device_name = sys.argv[1]
    
    print("🔧 硬件命令测试工具")
    print("=" * 80)
    print(f"📱 测试设备: {device_name}")
    print(f"🕒 开始时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        success = run_hardware_test_suite(device_name)
        
        print(f"\n🏁 测试完成")
        print(f"🕒 结束时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if success:
            print("🎉 硬件测试全部通过！")
            sys.exit(0)
        else:
            print("⚠️ 部分硬件测试失败，请检查硬件实现")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⏹️ 测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 测试过程中发生错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
