/**
 * 测试前端API调用
 * 模拟前端发送雨刷控制命令到后端
 */

const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  username: 'admin',
  password: 'admin123'
};

// 测试用例
const TEST_COMMANDS = ['off', 'low', 'medium', 'high', 'interval', 'smart'];

async function login() {
  try {
    console.log('🔐 正在登录...');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, TEST_USER, {
      withCredentials: true
    });
    
    if (response.data.success) {
      console.log('✅ 登录成功');
      return response.headers['set-cookie'];
    } else {
      console.error('❌ 登录失败:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('❌ 登录错误:', error.message);
    return null;
  }
}

async function testWiperControl(cookies, command) {
  try {
    console.log(`\n🎯 测试雨刷控制命令: ${command}`);
    
    const response = await axios.post(`${BASE_URL}/api/wiper/control`, 
      { status: command },
      {
        headers: {
          'Cookie': cookies ? cookies.join('; ') : '',
          'Content-Type': 'application/json'
        },
        withCredentials: true
      }
    );
    
    console.log(`📊 响应状态: ${response.status}`);
    console.log(`📊 响应数据:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`✅ 控制命令 ${command} 执行成功`);
      return true;
    } else {
      console.log(`❌ 控制命令 ${command} 执行失败: ${response.data.error}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 控制命令 ${command} 请求错误:`, error.response?.data || error.message);
    return false;
  }
}

async function testWiperStatus(cookies) {
  try {
    console.log(`\n📊 获取雨刷状态`);
    
    const response = await axios.get(`${BASE_URL}/api/wiper/status`, {
      headers: {
        'Cookie': cookies ? cookies.join('; ') : ''
      },
      withCredentials: true
    });
    
    console.log(`📊 状态响应:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`✅ 当前雨刷状态: ${response.data.status}`);
      return response.data.status;
    } else {
      console.log(`❌ 获取状态失败: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 获取状态错误:`, error.response?.data || error.message);
    return null;
  }
}

async function testApiControl(cookies, command) {
  try {
    console.log(`\n🎯 测试API控制命令: ${command}`);
    
    const response = await axios.post(`${BASE_URL}/api/wiper/api-control`, 
      { command: command },
      {
        headers: {
          'Cookie': cookies ? cookies.join('; ') : '',
          'Content-Type': 'application/json'
        },
        withCredentials: true
      }
    );
    
    console.log(`📊 API控制响应:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`✅ API控制命令 ${command} 执行成功`);
      return true;
    } else {
      console.log(`❌ API控制命令 ${command} 执行失败: ${response.data.error}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ API控制命令 ${command} 请求错误:`, error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 开始前端API测试');
  console.log('=' * 50);
  
  // 1. 登录
  const cookies = await login();
  if (!cookies) {
    console.error('❌ 无法登录，测试终止');
    return;
  }
  
  // 2. 测试获取状态
  await testWiperStatus(cookies);
  
  // 3. 测试普通控制命令
  console.log('\n📋 测试普通控制命令 (/api/wiper/control)');
  console.log('-' * 40);
  
  for (const command of TEST_COMMANDS) {
    const success = await testWiperControl(cookies, command);
    if (success) {
      // 获取更新后的状态
      await testWiperStatus(cookies);
    }
    
    // 等待一秒避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 4. 测试API控制命令
  console.log('\n📋 测试API控制命令 (/api/wiper/api-control)');
  console.log('-' * 40);
  
  for (const command of ['off', 'low', 'high']) {
    const success = await testApiControl(cookies, command);
    if (success) {
      // 获取更新后的状态
      await testWiperStatus(cookies);
    }
    
    // 等待一秒避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 测试完成');
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testWiperControl, testWiperStatus, testApiControl };
