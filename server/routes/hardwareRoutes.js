// server/routes/hardwareRoutes.js
const express = require('express');
const router = express.Router();
const deviceBindingService = require('../services/deviceBindingService');

/**
 * IP白名单验证
 * 允许本地网络和内网访问
 */
const ALLOWED_HARDWARE_IP_RANGES = [
  '127.0.0.1',        // 本地回环
  '192.168.0.0/16',   // 私有网络A类
  '10.0.0.0/8',       // 私有网络B类
  '172.16.0.0/12',    // 私有网络C类
  'localhost'         // 本地主机
];

/**
 * 检查IP是否在允许范围内
 * @param {string} clientIP - 客户端IP地址
 * @returns {boolean} 是否允许访问
 */
function isHardwareIPAllowed(clientIP) {
  // 简化的IP检查，实际项目中可以使用更完善的IP范围检查库
  if (!clientIP) return false;
  
  // 检查本地地址
  if (clientIP === '127.0.0.1' || clientIP === 'localhost' || clientIP === '::1') {
    return true;
  }
  
  // 检查私有网络地址
  if (clientIP.startsWith('192.168.') || 
      clientIP.startsWith('10.') || 
      (clientIP.startsWith('172.') && 
       parseInt(clientIP.split('.')[1]) >= 16 && 
       parseInt(clientIP.split('.')[1]) <= 31)) {
    return true;
  }
  
  return false;
}

/**
 * 硬件设备凭证查询接口
 * 支持通过激活码或硬件标识符查询
 */
router.get('/device/credentials', async (req, res) => {
  try {
    const { activation_code, mac, serial, hardware_id } = req.query;
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    
    console.log(`[硬件API] 设备凭证查询请求，IP: ${clientIP}`);
    console.log(`[硬件API] 查询参数:`, { activation_code, mac, serial, hardware_id });
    
    // IP白名单验证
    if (!isHardwareIPAllowed(clientIP)) {
      console.warn(`[硬件API] IP地址不在允许范围内: ${clientIP}`);
      return res.status(403).json({
        success: false,
        error: 'IP地址不在允许范围内',
        client_ip: clientIP
      });
    }
    
    // 验证请求参数
    if (!activation_code && !mac && !serial && !hardware_id) {
      return res.status(400).json({
        success: false,
        error: '需要提供激活码或硬件标识符（MAC地址、序列号、硬件ID）'
      });
    }
    
    let credentialsResult;
    let queryMethod;
    
    // 优先通过激活码查询
    if (activation_code) {
      console.log(`[硬件API] 通过激活码查询设备凭证: ${activation_code}`);
      credentialsResult = await deviceBindingService.getDeviceCredentialsByActivationCode(activation_code);
      queryMethod = 'activation_code';
    }
    // 其次通过硬件标识符查询
    else if (mac || serial || hardware_id) {
      console.log(`[硬件API] 通过硬件标识符查询设备凭证: MAC=${mac}, Serial=${serial}, HardwareID=${hardware_id}`);
      credentialsResult = await deviceBindingService.getDeviceCredentialsByHardware(
        mac || hardware_id, 
        serial || hardware_id
      );
      queryMethod = 'hardware_identifier';
    }
    
    if (!credentialsResult.success) {
      console.warn(`[硬件API] 未找到设备凭证:`, credentialsResult.error);
      
      // 记录失败的访问尝试
      try {
        await deviceBindingService.logHardwareAccess(
          null, 
          'unknown', 
          mac || serial || hardware_id || activation_code, 
          clientIP,
          'get_credentials',
          'failed',
          JSON.stringify({ activation_code, mac, serial, hardware_id }),
          credentialsResult.error
        );
      } catch (logError) {
        console.error(`[硬件API] 记录访问日志失败:`, logError);
      }
      
      return res.status(404).json({
        success: false,
        error: credentialsResult.error,
        query_method: queryMethod
      });
    }
    
    // 更新硬件绑定信息（如果提供了硬件标识符）
    if ((mac || serial || hardware_id) && credentialsResult.username) {
      try {
        console.log(`[硬件API] 更新用户 ${credentialsResult.username} 的硬件绑定信息`);
        await deviceBindingService.updateHardwareBinding(
          credentialsResult.username,
          mac,
          serial,
          hardware_id || mac || serial
        );
      } catch (updateError) {
        console.error(`[硬件API] 更新硬件绑定信息失败:`, updateError);
        // 不影响主流程
      }
    }
    
    // 记录成功的访问
    try {
      await deviceBindingService.logHardwareAccess(
        credentialsResult.user_id,
        credentialsResult.username,
        mac || serial || hardware_id || activation_code,
        clientIP,
        'get_credentials',
        'success',
        JSON.stringify({ activation_code, mac, serial, hardware_id, query_method }),
        'credentials_provided'
      );
    } catch (logError) {
      console.error(`[硬件API] 记录访问日志失败:`, logError);
    }
    
    console.log(`[硬件API] 成功返回设备凭证，用户: ${credentialsResult.username}`);
    
    // 返回设备凭证
    res.json({
      success: true,
      credentials: credentialsResult.credentials,
      device_info: {
        username: credentialsResult.username,
        activation_code: credentialsResult.device_info.activation_code,
        serial_number: credentialsResult.device_info.serial_number,
        device_model: credentialsResult.device_info.device_model,
        firmware_version: credentialsResult.device_info.firmware_version,
        device_status: credentialsResult.device_info.device_status,
        activated_at: credentialsResult.device_info.activated_at
      },
      query_info: {
        method: queryMethod,
        client_ip: clientIP,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[硬件API] 获取设备凭证异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

/**
 * 硬件设备状态更新接口
 * 用于硬件设备上报状态信息
 */
router.post('/device/status', async (req, res) => {
  try {
    const { device_id, mac, serial, status, timestamp } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    
    console.log(`[硬件API] 设备状态更新请求，IP: ${clientIP}`);
    console.log(`[硬件API] 状态数据:`, { device_id, mac, serial, status, timestamp });
    
    // IP白名单验证
    if (!isHardwareIPAllowed(clientIP)) {
      console.warn(`[硬件API] IP地址不在允许范围内: ${clientIP}`);
      return res.status(403).json({
        success: false,
        error: 'IP地址不在允许范围内'
      });
    }
    
    // 验证必要参数
    if (!device_id && !mac && !serial) {
      return res.status(400).json({
        success: false,
        error: '需要提供设备ID或硬件标识符'
      });
    }
    
    // 通过硬件标识符查找设备
    let credentialsResult;
    if (mac || serial) {
      credentialsResult = await deviceBindingService.getDeviceCredentialsByHardware(mac, serial);
    }
    
    if (credentialsResult && credentialsResult.success) {
      // 记录状态更新日志
      try {
        await deviceBindingService.logHardwareAccess(
          credentialsResult.user_id,
          credentialsResult.username,
          mac || serial || device_id,
          clientIP,
          'status_update',
          'success',
          JSON.stringify({ device_id, mac, serial, status, timestamp }),
          'status_updated'
        );
      } catch (logError) {
        console.error(`[硬件API] 记录状态更新日志失败:`, logError);
      }
      
      console.log(`[硬件API] 设备状态更新成功，用户: ${credentialsResult.username}`);
      
      res.json({
        success: true,
        message: '设备状态更新成功',
        device_info: {
          username: credentialsResult.username,
          device_id: credentialsResult.credentials.device_id,
          device_name: credentialsResult.credentials.device_name
        }
      });
    } else {
      console.warn(`[硬件API] 未找到对应的设备绑定信息`);
      res.status(404).json({
        success: false,
        error: '未找到对应的设备绑定信息'
      });
    }
    
  } catch (error) {
    console.error('[硬件API] 设备状态更新异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

/**
 * 获取硬件访问日志
 * 用于调试和监控
 */
router.get('/access-logs/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    
    console.log(`[硬件API] 获取用户 ${username} 的硬件访问日志，IP: ${clientIP}`);
    
    // IP白名单验证
    if (!isHardwareIPAllowed(clientIP)) {
      console.warn(`[硬件API] IP地址不在允许范围内: ${clientIP}`);
      return res.status(403).json({
        success: false,
        error: 'IP地址不在允许范围内'
      });
    }
    
    const deviceInfo = await deviceBindingService.getUserDeviceInfo(username);
    
    if (deviceInfo.success) {
      res.json({
        success: true,
        user_info: deviceInfo.user_info,
        device_info: deviceInfo.device_info,
        hardware_info: deviceInfo.hardware_info,
        access_logs: deviceInfo.access_logs
      });
    } else {
      res.status(404).json({
        success: false,
        error: deviceInfo.error
      });
    }
    
  } catch (error) {
    console.error('[硬件API] 获取硬件访问日志异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

module.exports = router;
