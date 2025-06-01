#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
查询OneNET产品的物模型信息
了解当前产品中定义了哪些属性标识符
"""

import sys
import json
import requests
from onenet_api import (
    ONENET_API_BASE,
    PRODUCT_ID,
    generate_token
)
from rainfall_db import log

def query_product_thingmodel():
    """查询产品的物模型信息"""
    try:
        log("查询产品物模型信息")
        
        # 生成token
        token = generate_token()
        if not token:
            return {"success": False, "error": "生成token失败"}
        
        # 尝试多种可能的物模型查询API端点
        api_endpoints = [
            f"{ONENET_API_BASE}/thingmodel/product/{PRODUCT_ID}",
            f"{ONENET_API_BASE}/thingmodel/product/{PRODUCT_ID}/model",
            f"{ONENET_API_BASE}/thingmodel/product/{PRODUCT_ID}/properties",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/thingmodel",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/model",
            f"{ONENET_API_BASE}/product/{PRODUCT_ID}/properties",
            f"{ONENET_API_BASE}/thingmodel/query",
            f"{ONENET_API_BASE}/thingmodel/model",
            f"{ONENET_API_BASE}/thingmodel/properties"
        ]
        
        headers = {
            "authorization": token,
            "Content-Type": "application/json"
        }
        
        # 尝试每个API端点
        for i, url in enumerate(api_endpoints, 1):
            log(f"尝试物模型查询API端点 {i}/{len(api_endpoints)}: {url}")
            
            try:
                # 尝试GET请求
                response = requests.get(url, headers=headers, timeout=10)
                
                log(f"GET响应状态码: {response.status_code}")
                log(f"GET响应内容: {response.text}")
                
                if response.status_code == 200:
                    try:
                        response_data = response.json()
                        if response_data.get("code") == 0 or response_data.get("errno") == 0:
                            log(f"✅ 成功获取物模型信息！使用端点: {url}")
                            return {
                                "success": True,
                                "endpoint": url,
                                "method": "GET",
                                "data": response_data
                            }
                    except:
                        pass
                
                # 如果GET失败，尝试POST请求
                post_body = {"product_id": PRODUCT_ID}
                response = requests.post(url, json=post_body, headers=headers, timeout=10)
                
                log(f"POST响应状态码: {response.status_code}")
                log(f"POST响应内容: {response.text}")
                
                if response.status_code == 200:
                    try:
                        response_data = response.json()
                        if response_data.get("code") == 0 or response_data.get("errno") == 0:
                            log(f"✅ 成功获取物模型信息！使用端点: {url}")
                            return {
                                "success": True,
                                "endpoint": url,
                                "method": "POST",
                                "data": response_data
                            }
                    except:
                        pass
                        
            except requests.exceptions.RequestException as e:
                log(f"❌ 请求异常: {str(e)}")
                continue
        
        # 如果所有尝试都失败了
        error_msg = f"所有物模型查询API端点都失败，无法获取产品 {PRODUCT_ID} 的物模型信息"
        log(error_msg)
        return {"success": False, "error": error_msg}
        
    except Exception as e:
        error_msg = f"查询物模型信息失败: {str(e)}"
        log(error_msg)
        return {"success": False, "error": error_msg}

def analyze_thingmodel_properties(thingmodel_data):
    """分析物模型属性"""
    try:
        print("\n🔍 分析物模型属性:")
        print("=" * 50)
        
        # 尝试从不同的数据结构中提取属性信息
        properties = []
        
        # 检查常见的数据结构
        data = thingmodel_data.get("data", {})
        
        # 方式1: data.properties
        if "properties" in data:
            properties = data["properties"]
        # 方式2: data.model.properties
        elif "model" in data and "properties" in data["model"]:
            properties = data["model"]["properties"]
        # 方式3: data.thingmodel.properties
        elif "thingmodel" in data and "properties" in data["thingmodel"]:
            properties = data["thingmodel"]["properties"]
        # 方式4: 直接在根级别
        elif "properties" in thingmodel_data:
            properties = thingmodel_data["properties"]
        
        if properties:
            print(f"找到 {len(properties)} 个属性:")
            print("-" * 30)
            
            for i, prop in enumerate(properties, 1):
                identifier = prop.get("identifier", "N/A")
                name = prop.get("name", "N/A")
                data_type = prop.get("data_type", "N/A")
                access_mode = prop.get("access_mode", "N/A")
                description = prop.get("description", "N/A")
                
                print(f"{i}. 标识符: {identifier}")
                print(f"   名称: {name}")
                print(f"   数据类型: {data_type}")
                print(f"   访问模式: {access_mode}")
                print(f"   描述: {description}")
                print()
        else:
            print("❌ 未找到属性定义")
            print("完整数据结构:")
            print(json.dumps(thingmodel_data, ensure_ascii=False, indent=2))
            
        return properties
        
    except Exception as e:
        print(f"❌ 分析物模型属性失败: {str(e)}")
        return []

def main():
    """主函数"""
    print("🔧 查询OneNET产品物模型信息")
    print("=" * 60)
    print(f"产品ID: {PRODUCT_ID}")
    print()
    
    # 查询物模型信息
    result = query_product_thingmodel()
    
    if result["success"]:
        print("✅ 成功获取物模型信息")
        print(f"使用的API端点: {result['endpoint']}")
        print(f"请求方法: {result['method']}")
        print()
        
        # 分析属性
        properties = analyze_thingmodel_properties(result["data"])
        
        # 输出完整的响应数据
        print("\n📊 完整响应数据:")
        print("=" * 50)
        print(json.dumps(result["data"], ensure_ascii=False, indent=2))
        
    else:
        print("❌ 获取物模型信息失败")
        print(f"错误: {result['error']}")

if __name__ == "__main__":
    main()
