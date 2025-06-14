// server/routes/deviceActivationRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 数据目录
const dataDir = path.join(__dirname, '..', 'data');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 设备激活数据文件
const DEVICE_ACTIVATION_FILE = path.join(dataDir, 'device_activations.json');

// OneNET设备激活服务
const oneNetActivationService = require('../services/oneNetActivationService');

// 设备绑定服务
const deviceBindingService = require('../services/deviceBindingService');

// 初始化设备激活数据文件
function initDeviceActivationFile() {
  if (!fs.existsSync(DEVICE_ACTIVATION_FILE)) {
    const initialData = {
      activations: {},
      activationCodes: {
        // 预设一些测试激活码
        'TEST-1234-ABCD-5678': {
          isUsed: false,
          deviceModel: '智能雨刷控制器 Pro',
          serialNumber: 'IWC-2024-001',
          firmwareVersion: 'v1.2.0'
        },
        'DEMO-5678-EFGH-9012': {
          isUsed: false,
          deviceModel: '智能雨刷控制器 Standard',
          serialNumber: 'IWC-2024-002',
          firmwareVersion: 'v1.1.0'
        },
        'PROD-9012-IJKL-3456': {
          isUsed: false,
          deviceModel: '智能雨刷控制器 Pro Max',
          serialNumber: 'IWC-2024-003',
          firmwareVersion: 'v1.3.0'
        }
      }
    };
    fs.writeFileSync(DEVICE_ACTIVATION_FILE, JSON.stringify(initialData, null, 2));
    console.log('已初始化设备激活数据文件');
  }
}

// 读取设备激活数据
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

// 保存设备激活数据
function saveDeviceActivationData(data) {
  try {
    fs.writeFileSync(DEVICE_ACTIVATION_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('保存设备激活数据失败:', error);
    return false;
  }
}

// 初始化数据文件
initDeviceActivationFile();

// 获取用户设备激活状态（从OneNET平台获取真实数据）
router.get('/status', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: '缺少用户名参数'
      });
    }

    console.log(`[设备激活] 获取用户 ${username} 的设备激活状态（从OneNET平台）`);

    // 首先从OneNET平台获取真实设备状态
    const oneNetStatus = await oneNetActivationService.checkDeviceStatus(username);

    if (oneNetStatus.success && oneNetStatus.is_activated) {
      // 从OneNET平台获取到真实设备信息
      const deviceInfo = oneNetStatus.device_info;

      res.json({
        success: true,
        isActivated: true,
        deviceId: deviceInfo.did,  // 使用OneNET的真实设备ID
        deviceName: deviceInfo.name,  // 使用OneNET的真实设备名称
        serialNumber: `IW-${deviceInfo.did}`,  // 基于设备ID生成序列号
        deviceModel: "智能雨刷设备",  // 统一设备型号
        firmwareVersion: "v2.0",  // 统一固件版本
        activatedAt: deviceInfo.activate_time,  // 使用OneNET的真实激活时间
        lastTime: deviceInfo.last_time,  // 添加最后活动时间
        status: deviceInfo.status,  // 添加设备状态
        createTime: deviceInfo.create_time  // 添加创建时间
      });
    } else {
      // OneNET平台上设备未激活或不存在
      if (oneNetStatus.success) {
        // 设备存在但未激活
        const deviceInfo = oneNetStatus.device_info;
        res.json({
          success: true,
          isActivated: false,
          deviceId: deviceInfo ? deviceInfo.did : null,
          deviceName: deviceInfo ? deviceInfo.name : null,
          serialNumber: deviceInfo ? `IW-${deviceInfo.did}` : null,
          deviceModel: deviceInfo ? "智能雨刷设备" : null,
          firmwareVersion: deviceInfo ? "v2.0" : null,
          activatedAt: null,  // 未激活时不显示激活时间
          lastTime: deviceInfo ? deviceInfo.last_time : null,
          status: deviceInfo ? deviceInfo.status : null,
          createTime: deviceInfo ? deviceInfo.create_time : null
        });
      } else {
        // 设备不存在
        res.json({
          success: true,
          isActivated: false,
          deviceId: null,
          deviceName: null,
          serialNumber: null,
          deviceModel: null,
          firmwareVersion: null,
          activatedAt: null
        });
      }
    }

  } catch (error) {
    console.error('[设备激活] 获取设备状态错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 激活设备
router.post('/activate', async (req, res) => {
  try {
    const { username, activationCode } = req.body;

    if (!username || !activationCode) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    console.log(`[设备激活] 用户 ${username} 尝试激活设备，激活码: ${activationCode}`);

    const data = readDeviceActivationData();

    // 检查用户是否已经激活过设备
    if (data.activations[username]) {
      return res.status(400).json({
        success: false,
        error: '您已经激活过设备，每个账号只能激活一台设备'
      });
    }

    // 检查激活码是否存在
    const codeInfo = data.activationCodes[activationCode];
    if (!codeInfo) {
      return res.status(400).json({
        success: false,
        error: '激活码不存在或无效'
      });
    }

    // 检查激活码是否已被使用
    if (codeInfo.isUsed) {
      return res.status(400).json({
        success: false,
        error: '激活码已被使用，每个激活码只能使用一次'
      });
    }

    console.log(`[设备激活] 开始在OneNET平台创建设备，用户: ${username}`);

    // 调用OneNET设备激活服务
    const activationResult = await oneNetActivationService.activateDevice(username, activationCode, codeInfo);

    if (!activationResult.success) {
      console.error(`[设备激活] OneNET设备创建失败:`, activationResult.error);
      return res.status(500).json({
        success: false,
        error: `设备激活失败: ${activationResult.error}`,
        details: activationResult.details
      });
    }

    console.log(`[设备激活] OneNET设备创建成功:`, activationResult);

    const activatedAt = new Date().toISOString();

    // 标记激活码为已使用
    data.activationCodes[activationCode].isUsed = true;
    data.activationCodes[activationCode].usedBy = username;
    data.activationCodes[activationCode].usedAt = activatedAt;

    // 记录用户激活信息（保持向后兼容）
    data.activations[username] = {
      deviceId: activationResult.deviceId,
      deviceName: activationResult.deviceName,
      activationCode: activationCode,
      serialNumber: codeInfo.serialNumber,
      deviceModel: codeInfo.deviceModel,
      firmwareVersion: codeInfo.firmwareVersion,
      activatedAt: activatedAt,
      oneNetResponse: activationResult.oneNetResponse
    };

    // 保存到JSON文件（保持向后兼容）
    const jsonSaveSuccess = saveDeviceActivationData(data);

    // 新增：将设备绑定信息存储到users表
    try {
      console.log(`[设备激活] 将设备绑定信息存储到users表`);

      const deviceData = {
        activationCode: activationCode,
        deviceId: activationResult.deviceId,
        deviceName: activationResult.deviceName,
        deviceKey: activationResult.deviceKey || null,
        productId: '66eIb47012',
        serialNumber: codeInfo.serialNumber,
        deviceModel: codeInfo.deviceModel,
        firmwareVersion: codeInfo.firmwareVersion,
        deviceStatus: 'virtual_only',
        activatedAt: activatedAt
      };

      const dbStoreResult = await deviceBindingService.storeDeviceBinding(username, deviceData);

      if (dbStoreResult.success) {
        console.log(`[设备激活] 成功将设备绑定信息存储到users表`);
      } else {
        console.error(`[设备激活] 存储设备绑定信息到users表失败:`, dbStoreResult.error);
        // 不影响主流程，只记录错误
      }
    } catch (dbError) {
      console.error(`[设备激活] 存储设备绑定信息到users表异常:`, dbError);
      // 不影响主流程，只记录错误
    }

    if (jsonSaveSuccess) {
      console.log(`[设备激活] 用户 ${username} 设备激活成功，设备ID: ${activationResult.deviceId}`);

      res.json({
        success: true,
        message: '设备激活成功',
        deviceId: activationResult.deviceId,
        deviceName: activationResult.deviceName,
        serialNumber: codeInfo.serialNumber,
        deviceModel: codeInfo.deviceModel,
        firmwareVersion: codeInfo.firmwareVersion,
        activatedAt: activatedAt
      });
    } else {
      res.status(500).json({
        success: false,
        error: '保存激活信息失败'
      });
    }

  } catch (error) {
    console.error('[设备激活] 激活设备错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 获取可用激活码列表（仅用于开发测试）
router.get('/codes', (req, res) => {
  try {
    console.log('[设备激活] 获取可用激活码列表（开发测试用）');

    const data = readDeviceActivationData();
    const availableCodes = [];

    for (const [code, info] of Object.entries(data.activationCodes)) {
      if (!info.isUsed) {
        availableCodes.push({
          code: code,
          deviceModel: info.deviceModel,
          serialNumber: info.serialNumber,
          firmwareVersion: info.firmwareVersion
        });
      }
    }

    res.json({
      success: true,
      availableCodes: availableCodes,
      message: '此接口仅用于开发测试，生产环境中应该移除'
    });

  } catch (error) {
    console.error('[设备激活] 获取激活码列表错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 检查OneNET平台上的真实设备状态
router.get('/onenet-status', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: '缺少用户名参数'
      });
    }

    console.log(`[设备激活] 检查用户 ${username} 在OneNET平台上的真实设备状态`);

    // 调用OneNET设备状态检查服务
    const statusResult = await oneNetActivationService.checkDeviceStatus(username);

    res.json(statusResult);

  } catch (error) {
    console.error('[设备激活] 检查OneNET设备状态错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

module.exports = router;
