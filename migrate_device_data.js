#!/usr/bin/env node

/**
 * 数据迁移脚本
 * 将现有的device_activations.json数据迁移到users表的设备绑定字段
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 配置
const DEVICE_ACTIVATION_FILE = path.join(__dirname, 'server/data/device_activations.json');
const DB_SERVICE_SCRIPT = path.join(__dirname, 'python/db_service.py');

/**
 * 执行Python数据库脚本
 */
async function executePythonScript(action, params = {}) {
  return new Promise((resolve, reject) => {
    const args = ['--action', action];
    
    // 添加参数到命令行
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        args.push(`--${key}`, String(value));
      }
    });

    console.log(`执行Python脚本: ${action}`, params);

    const pythonProcess = spawn('python', [DB_SERVICE_SCRIPT, ...args], {
      cwd: path.dirname(DB_SERVICE_SCRIPT)
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError) {
          console.error(`解析Python脚本输出失败:`, parseError);
          console.error('原始输出:', stdout);
          reject(new Error(`解析输出失败: ${parseError.message}`));
        }
      } else {
        console.error(`Python脚本执行失败, 退出码: ${code}`);
        console.error('错误输出:', stderr);
        console.error('标准输出:', stdout);
        reject(new Error(`Python脚本执行失败: ${stderr || stdout}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`启动Python脚本失败:`, error);
      reject(error);
    });
  });
}

/**
 * 读取现有的设备激活数据
 */
function readDeviceActivationData() {
  try {
    if (fs.existsSync(DEVICE_ACTIVATION_FILE)) {
      const data = fs.readFileSync(DEVICE_ACTIVATION_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取设备激活数据失败:', error);
  }
  return { activations: {}, activationCodes: {} };
}

/**
 * 迁移单个用户的设备数据
 */
async function migrateUserDeviceData(username, activationData) {
  try {
    console.log(`\n迁移用户 ${username} 的设备数据...`);
    
    const deviceData = {
      activation_code: activationData.activationCode,
      onenet_device_id: activationData.deviceId,
      onenet_device_name: activationData.deviceName,
      device_key: null, // JSON数据中没有device_key
      product_id: '66eIb47012',
      serial_number: activationData.serialNumber,
      device_model: activationData.deviceModel || '智能雨刷设备',
      firmware_version: activationData.firmwareVersion || 'v2.0',
      device_status: 'virtual_only',
      activated_at: activationData.activatedAt
    };

    const result = await executePythonScript('store_device_binding', {
      username: username,
      ...deviceData
    });

    if (result.success) {
      console.log(`✅ 用户 ${username} 的设备数据迁移成功`);
      return { success: true, username };
    } else {
      console.error(`❌ 用户 ${username} 的设备数据迁移失败:`, result.error);
      return { success: false, username, error: result.error };
    }
  } catch (error) {
    console.error(`❌ 用户 ${username} 的设备数据迁移异常:`, error);
    return { success: false, username, error: error.message };
  }
}

/**
 * 主迁移函数
 */
async function migrateDeviceData() {
  console.log('🚀 开始设备数据迁移...\n');

  // 1. 检查文件是否存在
  if (!fs.existsSync(DEVICE_ACTIVATION_FILE)) {
    console.error(`❌ 设备激活数据文件不存在: ${DEVICE_ACTIVATION_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(DB_SERVICE_SCRIPT)) {
    console.error(`❌ 数据库服务脚本不存在: ${DB_SERVICE_SCRIPT}`);
    process.exit(1);
  }

  // 2. 初始化数据库
  console.log('📊 初始化数据库...');
  try {
    const initResult = await executePythonScript('init');
    if (initResult.success) {
      console.log('✅ 数据库初始化成功');
    } else {
      console.error('❌ 数据库初始化失败:', initResult.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 数据库初始化异常:', error);
    process.exit(1);
  }

  // 3. 读取现有数据
  console.log('\n📖 读取现有设备激活数据...');
  const deviceData = readDeviceActivationData();
  const activations = deviceData.activations || {};
  
  const userCount = Object.keys(activations).length;
  console.log(`📊 找到 ${userCount} 个用户的设备激活数据`);

  if (userCount === 0) {
    console.log('ℹ️ 没有需要迁移的数据');
    return;
  }

  // 4. 迁移数据
  console.log('\n🔄 开始迁移数据...');
  const results = [];
  
  for (const [username, activationData] of Object.entries(activations)) {
    const result = await migrateUserDeviceData(username, activationData);
    results.push(result);
    
    // 添加延迟，避免数据库压力
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 5. 统计结果
  console.log('\n📊 迁移结果统计:');
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  console.log(`✅ 成功迁移: ${successCount} 个用户`);
  console.log(`❌ 迁移失败: ${failureCount} 个用户`);
  
  if (failureCount > 0) {
    console.log('\n❌ 迁移失败的用户:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.username}: ${r.error}`);
    });
  }

  // 6. 备份原始数据
  if (successCount > 0) {
    const backupFile = DEVICE_ACTIVATION_FILE + '.migrated_backup.' + Date.now();
    try {
      fs.copyFileSync(DEVICE_ACTIVATION_FILE, backupFile);
      console.log(`\n💾 原始数据已备份到: ${backupFile}`);
    } catch (error) {
      console.error('❌ 备份原始数据失败:', error);
    }
  }

  console.log('\n🎉 设备数据迁移完成!');
}

/**
 * 验证迁移结果
 */
async function verifyMigration() {
  console.log('\n🔍 验证迁移结果...');
  
  const deviceData = readDeviceActivationData();
  const activations = deviceData.activations || {};
  
  for (const username of Object.keys(activations)) {
    try {
      const result = await executePythonScript('get_user_device_info', { username });
      if (result.success) {
        console.log(`✅ 用户 ${username} 的设备信息验证成功`);
      } else {
        console.log(`❌ 用户 ${username} 的设备信息验证失败: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ 用户 ${username} 的设备信息验证异常: ${error.message}`);
    }
  }
}

// 主程序
async function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--verify')) {
      await verifyMigration();
    } else if (args.includes('--help')) {
      console.log(`
设备数据迁移脚本

用法:
  node migrate_device_data.js          # 执行数据迁移
  node migrate_device_data.js --verify # 验证迁移结果
  node migrate_device_data.js --help   # 显示帮助信息

说明:
  此脚本将现有的 device_activations.json 数据迁移到 users 表的设备绑定字段中。
  迁移前会自动备份原始数据文件。
      `);
    } else {
      await migrateDeviceData();
      
      // 可选：验证迁移结果
      if (args.includes('--with-verify')) {
        await verifyMigration();
      }
    }
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main();
}

module.exports = {
  migrateDeviceData,
  verifyMigration
};
