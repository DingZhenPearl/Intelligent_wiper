// server/services/oneNetActivationService.js
const { spawn } = require('child_process');
const path = require('path');

/**
 * OneNET设备激活服务
 * 负责调用Python脚本在OneNET平台创建设备
 */
class OneNetActivationService {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, '../../python/onenet_api.py');
  }

  /**
   * 激活设备 - 激活已存在的OneNET设备（设备应该在注册时已创建）
   * @param {string} username - 用户名
   * @param {string} activationCode - 激活码
   * @param {object} codeInfo - 激活码信息
   * @returns {Promise<object>} 激活结果
   */
  async activateDevice(username, activationCode, codeInfo) {
    try {
      console.log(`[OneNET激活服务] 开始为用户 ${username} 激活设备（设备应该在注册时已创建）`);

      // 步骤1: 检查设备是否存在
      console.log(`[OneNET激活服务] 步骤1: 检查用户设备是否存在`);
      const statusResult = await this.checkDeviceStatus(username);

      if (!statusResult.success) {
        console.error(`[OneNET激活服务] 用户 ${username} 的设备不存在，需要先创建设备`);
        return {
          success: false,
          error: '设备不存在，请联系管理员',
          details: statusResult,
          suggestion: '设备应该在注册时自动创建，如果没有创建请联系技术支持'
        };
      }

      const deviceName = statusResult.device_name;
      const deviceId = statusResult.device_info?.did;

      console.log(`[OneNET激活服务] 找到用户设备: ${deviceName} (ID: ${deviceId})`);

      // 步骤2: 检查设备是否已经激活
      if (statusResult.is_activated) {
        console.log(`[OneNET激活服务] 设备已经激活，激活时间: ${statusResult.activate_time}`);
        return {
          success: true,
          deviceId: deviceId,
          deviceName: deviceName,
          message: `设备 ${deviceName} 已经激活`,
          activatedAt: statusResult.activate_time,
          lastTime: statusResult.last_time,
          alreadyActivated: true,
          statusVerification: statusResult
        };
      }

      // 步骤3: 激活设备（使用真正的MQTT连接激活）
      console.log(`[OneNET激活服务] 步骤3: 激活设备 ${deviceName}（使用MQTT连接）`);
      const activationResult = await this.activateOneNetDevice(username);

      if (!activationResult.success) {
        console.error(`[OneNET激活服务] 设备激活失败:`, activationResult.error);
        return {
          success: false,
          error: `设备激活失败: ${activationResult.error}`,
          details: activationResult,
          deviceId: deviceId,
          deviceName: deviceName
        };
      }

      console.log(`[OneNET激活服务] 设备激活成功:`, activationResult);

      // 步骤4: 验证设备真实激活状态
      console.log(`[OneNET激活服务] 步骤4: 验证设备真实激活状态`);
      const verifyResult = await this.checkDeviceStatus(username);

      let verificationMessage = '';
      let isReallyActivated = false;

      if (verifyResult.success && verifyResult.is_activated) {
        isReallyActivated = true;
        verificationMessage = `设备在OneNET平台真正激活成功，激活时间: ${verifyResult.activate_time}`;
        console.log(`[OneNET激活服务] ✅ 设备真实激活验证成功`);
      } else {
        verificationMessage = `设备激活API调用成功，但平台状态验证失败`;
        console.warn(`[OneNET激活服务] ⚠️ 设备真实激活验证失败`);
      }

      return {
        success: true,
        deviceId: deviceId,
        deviceName: deviceName,
        activationResult: activationResult,
        statusVerification: verifyResult,
        isReallyActivated: isReallyActivated,
        realActivateTime: verifyResult.activate_time,
        realLastTime: verifyResult.last_time,
        message: `设备 ${deviceName} 激活成功`,
        verificationMessage: verificationMessage
      };

    } catch (error) {
      console.error('[OneNET激活服务] 激活设备失败:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * 调用Python脚本在OneNET平台创建设备
   * @param {string} username - 用户名
   * @returns {Promise<object>} 创建结果
   */
  async createOneNetDevice(username) {
    return new Promise((resolve, reject) => {
      console.log(`[OneNET激活服务] 调用Python脚本创建设备，用户: ${username}`);

      // 调用Python脚本的create_device函数
      const pythonProcess = spawn('python', [
        this.pythonScriptPath,
        'create_device',
        '--username',
        username
      ], {
        cwd: path.dirname(this.pythonScriptPath)
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
        console.log(`[OneNET激活服务] Python脚本执行完成，退出码: ${code}`);
        console.log(`[OneNET激活服务] 标准输出:`, stdout);
        
        if (stderr) {
          console.log(`[OneNET激活服务] 标准错误:`, stderr);
        }

        if (code !== 0) {
          reject(new Error(`Python脚本执行失败，退出码: ${code}, 错误: ${stderr}`));
          return;
        }

        try {
          // 解析Python脚本的输出
          const lines = stdout.trim().split('\n');
          let result = null;

          // 查找JSON格式的结果
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed && typeof parsed === 'object') {
                result = parsed;
                break;
              }
            } catch (e) {
              // 忽略非JSON行
              continue;
            }
          }

          if (!result) {
            // 如果没有找到JSON结果，尝试解析最后一行
            const lastLine = lines[lines.length - 1];
            try {
              result = JSON.parse(lastLine);
            } catch (e) {
              reject(new Error(`无法解析Python脚本输出: ${stdout}`));
              return;
            }
          }

          console.log(`[OneNET激活服务] 解析的结果:`, result);
          resolve(result);

        } catch (error) {
          console.error('[OneNET激活服务] 解析Python脚本输出失败:', error);
          reject(new Error(`解析Python脚本输出失败: ${error.message}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('[OneNET激活服务] Python脚本执行错误:', error);
        reject(new Error(`Python脚本执行错误: ${error.message}`));
      });
    });
  }

  /**
   * 调用Python脚本激活OneNET设备
   * @param {string} username - 用户名
   * @returns {Promise<object>} 激活结果
   */
  async activateOneNetDevice(username) {
    return new Promise((resolve, reject) => {
      console.log(`[OneNET激活服务] 调用Python脚本激活设备，用户: ${username}`);

      // 调用Python脚本的activate_device函数
      const pythonProcess = spawn('python', [
        this.pythonScriptPath,
        'activate_device',
        '--username',
        username
      ], {
        cwd: path.dirname(this.pythonScriptPath)
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
        console.log(`[OneNET激活服务] 设备激活Python脚本执行完成，退出码: ${code}`);
        console.log(`[OneNET激活服务] 设备激活标准输出:`, stdout);

        if (stderr) {
          console.log(`[OneNET激活服务] 设备激活标准错误:`, stderr);
        }

        if (code !== 0) {
          reject(new Error(`设备激活Python脚本执行失败，退出码: ${code}, 错误: ${stderr}`));
          return;
        }

        try {
          // 解析Python脚本的输出
          const lines = stdout.trim().split('\n');
          let result = null;

          // 查找JSON格式的结果
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed && typeof parsed === 'object') {
                result = parsed;
                break;
              }
            } catch (e) {
              // 忽略非JSON行
              continue;
            }
          }

          if (!result) {
            // 如果没有找到JSON结果，尝试解析最后一行
            const lastLine = lines[lines.length - 1];
            try {
              result = JSON.parse(lastLine);
            } catch (e) {
              reject(new Error(`无法解析设备激活Python脚本输出: ${stdout}`));
              return;
            }
          }

          console.log(`[OneNET激活服务] 解析的设备激活结果:`, result);
          resolve(result);

        } catch (error) {
          console.error('[OneNET激活服务] 解析设备激活Python脚本输出失败:', error);
          reject(new Error(`解析设备激活Python脚本输出失败: ${error.message}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('[OneNET激活服务] 设备激活Python脚本执行错误:', error);
        reject(new Error(`设备激活Python脚本执行错误: ${error.message}`));
      });
    });
  }

  /**
   * 检查设备状态
   * @param {string} username - 用户名
   * @returns {Promise<object>} 设备状态
   */
  async checkDeviceStatus(username) {
    try {
      console.log(`[OneNET激活服务] 检查用户 ${username} 的设备状态`);

      // 调用Python脚本检查设备状态
      const statusResult = await this.checkOneNetDeviceStatus(username);

      return statusResult;

    } catch (error) {
      console.error('[OneNET激活服务] 检查设备状态失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 调用Python脚本检查OneNET设备状态
   * @param {string} username - 用户名
   * @returns {Promise<object>} 设备状态
   */
  async checkOneNetDeviceStatus(username) {
    return new Promise((resolve, reject) => {
      console.log(`[OneNET激活服务] 调用Python脚本检查设备状态，用户: ${username}`);

      // 调用Python脚本的check_device_status函数
      const pythonProcess = spawn('python', [
        this.pythonScriptPath,
        'check_device_status',
        '--username',
        username
      ], {
        cwd: path.dirname(this.pythonScriptPath)
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
        console.log(`[OneNET激活服务] 设备状态检查Python脚本退出，退出码: ${code}`);
        console.log(`[OneNET激活服务] 设备状态检查标准输出: ${stdout}`);

        if (stderr) {
          console.error(`[OneNET激活服务] 设备状态检查标准错误: ${stderr}`);
        }

        if (code === 0) {
          try {
            // 解析JSON输出
            if (stdout && stdout.trim()) {
              // 查找JSON输出（可能在多行输出中）
              const lines = stdout.trim().split('\n');
              let jsonLine = null;
              for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                  jsonLine = trimmedLine;
                  break;
                }
              }

              if (jsonLine) {
                const result = JSON.parse(jsonLine);
                console.log(`[OneNET激活服务] 设备状态检查结果:`, result);
                resolve(result);
              } else {
                console.warn(`[OneNET激活服务] 未找到JSON输出，原始输出: ${stdout}`);
                resolve({
                  success: false,
                  error: '未找到有效的JSON输出',
                  raw_output: stdout
                });
              }
            } else {
              console.warn('[OneNET激活服务] 设备状态检查脚本没有输出');
              resolve({
                success: false,
                error: '设备状态检查脚本没有输出',
                raw_output: stdout
              });
            }
          } catch (parseError) {
            console.error('[OneNET激活服务] 解析设备状态检查结果失败:', parseError);
            resolve({
              success: false,
              error: `解析设备状态检查结果失败: ${parseError.message}`,
              raw_output: stdout
            });
          }
        } else {
          resolve({
            success: false,
            error: `设备状态检查Python脚本执行失败，退出码: ${code}`,
            stderr: stderr,
            stdout: stdout
          });
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('[OneNET激活服务] 设备状态检查Python脚本执行错误:', error);
        reject(new Error(`设备状态检查Python脚本执行错误: ${error.message}`));
      });
    });
  }

  /**
   * 获取设备信息
   * @param {string} deviceId - 设备ID
   * @returns {Promise<object>} 设备信息
   */
  async getDeviceInfo(deviceId) {
    try {
      console.log(`[OneNET激活服务] 获取设备信息，设备ID: ${deviceId}`);
      
      // 这里可以调用OneNET API查询设备详细信息
      // 暂时返回基本信息
      return {
        success: true,
        deviceId: deviceId,
        message: '设备信息获取功能待实现'
      };

    } catch (error) {
      console.error('[OneNET激活服务] 获取设备信息失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除设备（用于测试或重置）
   * @param {string} deviceId - 设备ID
   * @returns {Promise<object>} 删除结果
   */
  async deleteDevice(deviceId) {
    try {
      console.log(`[OneNET激活服务] 删除设备，设备ID: ${deviceId}`);
      
      // 这里可以调用OneNET API删除设备
      // 暂时返回基本信息
      return {
        success: true,
        deviceId: deviceId,
        message: '设备删除功能待实现'
      };

    } catch (error) {
      console.error('[OneNET激活服务] 删除设备失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 创建单例实例
const oneNetActivationService = new OneNetActivationService();

module.exports = oneNetActivationService;
