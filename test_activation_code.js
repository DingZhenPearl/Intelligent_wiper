#!/usr/bin/env node
/**
 * 测试激活码激活功能
 */

const axios = require('axios');
const path = require('path');

// 服务器配置
const SERVER_URL = 'http://localhost:3000';

async function testActivationCodeFlow() {
    console.log('🧪 开始测试激活码激活流程');
    console.log('=' * 60);

    try {
        // 1. 获取可用激活码
        console.log('\n1. 获取可用激活码...');
        const codesResponse = await axios.get(`${SERVER_URL}/api/device/activation/codes`);
        
        if (!codesResponse.data.success) {
            console.error('❌ 获取激活码失败:', codesResponse.data.error);
            return;
        }

        const availableCodes = codesResponse.data.availableCodes;
        console.log(`✅ 找到 ${availableCodes.length} 个可用激活码:`);
        
        availableCodes.forEach((code, index) => {
            console.log(`   ${index + 1}. ${code.code} - ${code.deviceModel}`);
        });

        if (availableCodes.length === 0) {
            console.error('❌ 没有可用的激活码');
            return;
        }

        // 使用第一个激活码
        const testCode = availableCodes[0].code;
        const testUsername = 'testactivation';

        console.log(`\n2. 使用激活码 ${testCode} 激活用户 ${testUsername} 的设备...`);

        // 2. 检查用户当前激活状态
        console.log('\n2.1 检查用户当前激活状态...');
        const statusResponse = await axios.get(`${SERVER_URL}/api/device/activation/status`, {
            params: { username: testUsername }
        });

        console.log('当前激活状态:', statusResponse.data);

        if (statusResponse.data.isActivated) {
            console.log('⚠️  用户已经激活过设备，跳过激活测试');
            return;
        }

        // 3. 执行激活
        console.log('\n2.2 执行设备激活...');
        const activationResponse = await axios.post(`${SERVER_URL}/api/device/activation/activate`, {
            username: testUsername,
            activationCode: testCode
        });

        console.log('激活响应:', JSON.stringify(activationResponse.data, null, 2));

        if (activationResponse.data.success) {
            console.log('✅ 设备激活成功!');
            console.log(`   设备ID: ${activationResponse.data.deviceId}`);
            console.log(`   设备名称: ${activationResponse.data.deviceName}`);
            console.log(`   设备型号: ${activationResponse.data.deviceModel}`);
            console.log(`   激活时间: ${activationResponse.data.activatedAt}`);

            // 4. 验证激活状态
            console.log('\n3. 验证激活状态...');
            const verifyResponse = await axios.get(`${SERVER_URL}/api/device/activation/status`, {
                params: { username: testUsername }
            });

            console.log('验证结果:', verifyResponse.data);

            if (verifyResponse.data.isActivated) {
                console.log('✅ 激活状态验证成功!');
                
                // 5. 检查OneNET平台上的真实状态
                console.log('\n4. 检查OneNET平台上的真实激活状态...');
                const oneNetStatusResponse = await axios.get(`${SERVER_URL}/api/device/activation/onenet-status`, {
                    params: { username: testUsername }
                });

                console.log('OneNET平台状态:', oneNetStatusResponse.data);

                if (oneNetStatusResponse.data.success && oneNetStatusResponse.data.is_activated) {
                    console.log('🎉 OneNET平台激活状态验证成功!');
                    console.log(`   激活时间: ${oneNetStatusResponse.data.activate_time}`);
                    console.log(`   最后活动: ${oneNetStatusResponse.data.last_time}`);
                } else {
                    console.log('⚠️  OneNET平台激活状态验证失败');
                }
            } else {
                console.log('❌ 激活状态验证失败');
            }
        } else {
            console.error('❌ 设备激活失败:', activationResponse.data.error);
        }

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    }
}

async function testServerConnection() {
    try {
        console.log('🔗 测试服务器连接...');
        const response = await axios.get(`${SERVER_URL}/api/device/activation/codes`);
        console.log('✅ 服务器连接成功');
        return true;
    } catch (error) {
        console.error('❌ 服务器连接失败:', error.message);
        console.error('请确保服务器正在运行: npm run dev');
        return false;
    }
}

async function main() {
    console.log('OneNET设备激活码测试工具');
    console.log('================================');

    // 测试服务器连接
    const connected = await testServerConnection();
    if (!connected) {
        return;
    }

    // 执行激活码测试
    await testActivationCodeFlow();

    console.log('\n🏁 测试完成!');
}

// 运行测试
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testActivationCodeFlow, testServerConnection };
