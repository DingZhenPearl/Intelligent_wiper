const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');

/**
 * 设备绑定服务
 * 通过扩展users数据表实现设备绑定功能
 */
class DeviceBindingService {
  constructor() {
    this.dbScriptPath = path.join(__dirname, '..', config.paths.DB_SERVICE_SCRIPT);
  }

  /**
   * 执行Python数据库脚本
   * @param {string} action - 操作类型
   * @param {object} params - 参数对象
   * @returns {Promise<object>} 执行结果
   */
  async executePythonScript(action, params = {}) {
    return new Promise((resolve, reject) => {
      const args = ['--action', action];
      
      // 添加参数到命令行
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          args.push(`--${key}`, String(value));
        }
      });

      console.log(`[设备绑定服务] 执行Python脚本: ${action}`, params);

      const pythonProcess = spawn('python', [this.dbScriptPath, ...args], {
        cwd: path.dirname(this.dbScriptPath)
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
            console.log(`[设备绑定服务] Python脚本执行成功:`, result);
            resolve(result);
          } catch (parseError) {
            console.error(`[设备绑定服务] 解析Python脚本输出失败:`, parseError);
            console.error('原始输出:', stdout);
            reject(new Error(`解析输出失败: ${parseError.message}`));
          }
        } else {
          console.error(`[设备绑定服务] Python脚本执行失败, 退出码: ${code}`);
          console.error('错误输出:', stderr);
          console.error('标准输出:', stdout);
          reject(new Error(`Python脚本执行失败: ${stderr || stdout}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error(`[设备绑定服务] 启动Python脚本失败:`, error);
        reject(error);
      });
    });
  }

  /**
   * 存储用户的设备绑定信息
   * @param {string} username - 用户名
   * @param {object} deviceData - 设备数据
   * @returns {Promise<object>} 存储结果
   */
  async storeDeviceBinding(username, deviceData) {
    try {
      console.log(`[设备绑定服务] 存储用户 ${username} 的设备绑定信息`);
      
      const params = {
        username: username,
        activation_code: deviceData.activationCode,
        onenet_device_id: deviceData.deviceId,
        onenet_device_name: deviceData.deviceName,
        device_key: deviceData.deviceKey,
        product_id: deviceData.productId || '66eIb47012',
        serial_number: deviceData.serialNumber,
        device_model: deviceData.deviceModel || '智能雨刷设备',
        firmware_version: deviceData.firmwareVersion || 'v2.0',
        device_status: deviceData.deviceStatus || 'virtual_only',
        activated_at: deviceData.activatedAt || new Date().toISOString()
      };

      const result = await this.executePythonScript('store_device_binding', params);
      
      if (result.success) {
        console.log(`[设备绑定服务] 成功存储用户 ${username} 的设备绑定信息`);
      } else {
        console.error(`[设备绑定服务] 存储设备绑定信息失败:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`[设备绑定服务] 存储设备绑定信息异常:`, error);
      return {
        success: false,
        error: `存储设备绑定信息失败: ${error.message}`
      };
    }
  }

  /**
   * 通过激活码获取设备凭证
   * @param {string} activationCode - 激活码
   * @returns {Promise<object>} 设备凭证
   */
  async getDeviceCredentialsByActivationCode(activationCode) {
    try {
      console.log(`[设备绑定服务] 通过激活码获取设备凭证: ${activationCode}`);
      
      const result = await this.executePythonScript('get_device_credentials', {
        activation_code: activationCode
      });
      
      if (result.success) {
        console.log(`[设备绑定服务] 成功获取设备凭证`);
      } else {
        console.error(`[设备绑定服务] 获取设备凭证失败:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`[设备绑定服务] 获取设备凭证异常:`, error);
      return {
        success: false,
        error: `获取设备凭证失败: ${error.message}`
      };
    }
  }

  /**
   * 通过硬件标识符获取设备凭证
   * @param {string} macAddress - MAC地址
   * @param {string} hardwareSerial - 硬件序列号
   * @returns {Promise<object>} 设备凭证
   */
  async getDeviceCredentialsByHardware(macAddress, hardwareSerial) {
    try {
      console.log(`[设备绑定服务] 通过硬件标识符获取设备凭证: MAC=${macAddress}, Serial=${hardwareSerial}`);
      
      const params = {};
      if (macAddress) params.hardware_mac = macAddress;
      if (hardwareSerial) params.hardware_serial = hardwareSerial;
      
      const result = await this.executePythonScript('get_device_credentials', params);
      
      if (result.success) {
        console.log(`[设备绑定服务] 成功获取设备凭证`);
      } else {
        console.error(`[设备绑定服务] 获取设备凭证失败:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`[设备绑定服务] 获取设备凭证异常:`, error);
      return {
        success: false,
        error: `获取设备凭证失败: ${error.message}`
      };
    }
  }

  /**
   * 更新用户的硬件绑定信息
   * @param {string} username - 用户名
   * @param {string} hardwareMac - 硬件MAC地址
   * @param {string} hardwareSerial - 硬件序列号
   * @param {string} hardwareIdentifier - 硬件标识符
   * @returns {Promise<object>} 更新结果
   */
  async updateHardwareBinding(username, hardwareMac, hardwareSerial, hardwareIdentifier) {
    try {
      console.log(`[设备绑定服务] 更新用户 ${username} 的硬件绑定信息`);
      
      const params = {
        username: username
      };
      if (hardwareMac) params.hardware_mac = hardwareMac;
      if (hardwareSerial) params.hardware_serial = hardwareSerial;
      if (hardwareIdentifier) params.hardware_identifier = hardwareIdentifier;
      
      const result = await this.executePythonScript('update_hardware_binding', params);
      
      if (result.success) {
        console.log(`[设备绑定服务] 成功更新用户 ${username} 的硬件绑定信息`);
      } else {
        console.error(`[设备绑定服务] 更新硬件绑定信息失败:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`[设备绑定服务] 更新硬件绑定信息异常:`, error);
      return {
        success: false,
        error: `更新硬件绑定信息失败: ${error.message}`
      };
    }
  }

  /**
   * 获取用户的完整设备信息
   * @param {string} username - 用户名
   * @returns {Promise<object>} 用户设备信息
   */
  async getUserDeviceInfo(username) {
    try {
      console.log(`[设备绑定服务] 获取用户 ${username} 的设备信息`);
      
      const result = await this.executePythonScript('get_user_device_info', {
        username: username
      });
      
      if (result.success) {
        console.log(`[设备绑定服务] 成功获取用户 ${username} 的设备信息`);
      } else {
        console.error(`[设备绑定服务] 获取用户设备信息失败:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`[设备绑定服务] 获取用户设备信息异常:`, error);
      return {
        success: false,
        error: `获取用户设备信息失败: ${error.message}`
      };
    }
  }

  /**
   * 记录硬件访问日志
   * @param {number} userId - 用户ID
   * @param {string} username - 用户名
   * @param {string} hardwareIdentifier - 硬件标识符
   * @param {string} accessIp - 访问IP
   * @param {string} requestType - 请求类型
   * @param {string} responseStatus - 响应状态
   * @param {string} requestDetails - 请求详情
   * @param {string} responseDetails - 响应详情
   * @returns {Promise<object>} 记录结果
   */
  async logHardwareAccess(userId, username, hardwareIdentifier, accessIp, 
                         requestType = 'get_credentials', responseStatus = 'success',
                         requestDetails = null, responseDetails = null) {
    try {
      const params = {
        user_id: userId,
        username: username,
        hardware_identifier: hardwareIdentifier,
        access_ip: accessIp,
        request_type: requestType,
        response_status: responseStatus
      };
      
      if (requestDetails) params.request_details = requestDetails;
      if (responseDetails) params.response_details = responseDetails;
      
      const result = await this.executePythonScript('log_hardware_access', params);
      
      return result;
    } catch (error) {
      console.error(`[设备绑定服务] 记录硬件访问日志异常:`, error);
      return {
        success: false,
        error: `记录硬件访问日志失败: ${error.message}`
      };
    }
  }
}

module.exports = new DeviceBindingService();
