const axios = require('axios');

async function testActivationAPI() {
    try {
        console.log('🧪 测试激活API（修改后的逻辑）...');

        const response = await axios.post('http://localhost:3000/api/device/activation/activate', {
            username: 'user4',  // 使用有设备但未激活的用户
            activationCode: 'TEST-2025-MQTT-0002'  // 使用新的激活码
        });

        console.log('✅ API响应成功:');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ API测试失败:');
        if (error.response) {
            console.error('状态码:', error.response.status);
            console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('错误信息:', error.message);
        }
    }
}

testActivationAPI();
