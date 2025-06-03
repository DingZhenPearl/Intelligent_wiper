#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
雨刷命令测试脚本
测试HTTP同步命令的完整流程
"""

import sys
import json
import time
import subprocess

def test_wiper_command(username, command):
    """测试雨刷控制命令"""
    print(f"\n🧪 测试雨刷控制命令: {command} (用户: {username})")
    print("=" * 50)
    
    try:
        # 调用HTTP控制脚本
        result = subprocess.run([
            'python', 'python/onenet_http_control.py',
            '--action', 'control',
            '--status', command,
            '--username', username,
            '--timeout', '15'
        ], capture_output=True, text=True, timeout=30)
        
        print(f"📤 命令执行完成")
        print(f"📋 返回码: {result.returncode}")
        
        if result.stdout:
            print(f"📄 标准输出:")
            try:
                output_data = json.loads(result.stdout)
                print(json.dumps(output_data, indent=2, ensure_ascii=False))
            except:
                print(result.stdout)
        
        if result.stderr:
            print(f"📝 日志信息:")
            for line in result.stderr.split('\n'):
                if line.strip():
                    print(f"  {line}")
        
        return result.returncode == 0
        
    except subprocess.TimeoutExpired:
        print("❌ 命令执行超时")
        return False
    except Exception as e:
        print(f"❌ 命令执行错误: {e}")
        return False

def test_wiper_status(username):
    """测试雨刷状态查询"""
    print(f"\n🔍 测试雨刷状态查询 (用户: {username})")
    print("=" * 50)
    
    try:
        # 调用HTTP控制脚本
        result = subprocess.run([
            'python', 'python/onenet_http_control.py',
            '--action', 'get-status',
            '--username', username,
            '--timeout', '10'
        ], capture_output=True, text=True, timeout=20)
        
        print(f"📤 状态查询完成")
        print(f"📋 返回码: {result.returncode}")
        
        if result.stdout:
            print(f"📄 标准输出:")
            try:
                output_data = json.loads(result.stdout)
                print(json.dumps(output_data, indent=2, ensure_ascii=False))
            except:
                print(result.stdout)
        
        if result.stderr:
            print(f"📝 日志信息:")
            for line in result.stderr.split('\n'):
                if line.strip():
                    print(f"  {line}")
        
        return result.returncode == 0
        
    except subprocess.TimeoutExpired:
        print("❌ 状态查询超时")
        return False
    except Exception as e:
        print(f"❌ 状态查询错误: {e}")
        return False

def main():
    """主测试函数"""
    print("🚀 开始雨刷命令测试")
    print("=" * 60)
    
    # 测试用户
    username = "admin"
    
    # 测试命令列表
    commands = ['off', 'interval', 'low', 'high', 'smart']
    
    success_count = 0
    total_tests = 0
    
    # 首先测试状态查询
    print(f"\n📊 第一步：测试状态查询")
    if test_wiper_status(username):
        success_count += 1
        print("✅ 状态查询测试成功")
    else:
        print("❌ 状态查询测试失败")
    total_tests += 1
    
    # 测试每个命令
    for i, command in enumerate(commands, 1):
        print(f"\n🎮 第{i+1}步：测试 {command} 命令")
        if test_wiper_command(username, command):
            success_count += 1
            print(f"✅ {command} 命令测试成功")
        else:
            print(f"❌ {command} 命令测试失败")
        total_tests += 1
        
        # 每次命令后查询状态
        print(f"\n📊 验证 {command} 命令后的状态")
        if test_wiper_status(username):
            print(f"✅ {command} 命令后状态查询成功")
        else:
            print(f"❌ {command} 命令后状态查询失败")
        
        # 命令间隔
        if i < len(commands):
            print(f"\n⏳ 等待2秒后执行下一个命令...")
            time.sleep(2)
    
    # 测试结果汇总
    print("\n" + "=" * 60)
    print("📈 测试结果汇总")
    print("=" * 60)
    print(f"✅ 成功: {success_count}/{total_tests}")
    print(f"❌ 失败: {total_tests - success_count}/{total_tests}")
    print(f"📊 成功率: {success_count/total_tests*100:.1f}%")
    
    if success_count == total_tests:
        print("\n🎉 所有测试通过！雨刷命令系统工作正常。")
        return True
    else:
        print(f"\n⚠️ 有 {total_tests - success_count} 个测试失败，请检查系统配置。")
        return False

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⏹️ 测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 测试过程中发生错误: {e}")
        sys.exit(1)
