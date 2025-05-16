/**
 * 雨刷控制服务
 * 提供与雨刷控制相关的API调用
 */

import { ref } from 'vue';
import { get, post } from './api'; // 使用自定义API服务，支持Web和安卓环境

// 雨刷状态
const wiperStatus = ref('off'); // 可能的值: off, low, medium, high

// 雨刷控制服务
const wiperService = {
  // 雨刷状态引用，可在组件间共享
  wiperStatus,

  /**
   * 获取雨刷当前状态
   * @returns {Promise<Object>} 包含雨刷状态的对象
   */
  async getStatus() {
    try {
      console.log('[wiperService] 获取雨刷状态');
      const response = await get('/api/wiper/status');

      // 处理响应数据
      const data = await response.json();

      if (data.success) {
        // 更新本地状态
        wiperStatus.value = data.status;
        console.log(`[wiperService] 雨刷状态: ${wiperStatus.value}`);
      } else {
        console.error('[wiperService] 获取雨刷状态失败:', data.error);
      }

      return data;
    } catch (error) {
      console.error('[wiperService] 获取雨刷状态错误:', error);
      return {
        success: false,
        error: error.message || '获取雨刷状态失败'
      };
    }
  },

  /**
   * 控制雨刷
   * @param {string} status - 雨刷状态，可选值: off, low, medium, high
   * @returns {Promise<Object>} 包含操作结果的对象
   */
  async control(status) {
    try {
      console.log(`[wiperService] 控制雨刷: ${status}`);
      const response = await post('/api/wiper/control', { status });

      // 处理响应数据
      const data = await response.json();

      if (data.success) {
        // 更新本地状态
        wiperStatus.value = data.status;
        console.log(`[wiperService] 雨刷状态已更新: ${wiperStatus.value}`);
      } else {
        console.error('[wiperService] 控制雨刷失败:', data.error);
      }

      return data;
    } catch (error) {
      console.error('[wiperService] 控制雨刷错误:', error);
      return {
        success: false,
        error: error.message || '控制雨刷失败'
      };
    }
  },

  /**
   * 通过API方式控制雨刷
   * @param {string} command - 雨刷命令，可选值: off, low, medium, high
   * @returns {Promise<Object>} 包含操作结果的对象
   */
  async apiControl(command) {
    try {
      console.log(`[wiperService] 通过API控制雨刷: ${command}`);
      const response = await post('/api/wiper/api-control', { command });

      // 处理响应数据
      const data = await response.json();

      if (data.success) {
        // 更新本地状态
        wiperStatus.value = command;
        console.log(`[wiperService] 雨刷状态已更新: ${wiperStatus.value}`);
      } else {
        console.error('[wiperService] 通过API控制雨刷失败:', data.error);
      }

      return data;
    } catch (error) {
      console.error('[wiperService] 通过API控制雨刷错误:', error);
      return {
        success: false,
        error: error.message || '通过API控制雨刷失败'
      };
    }
  },

  /**
   * 启动MQTT控制服务
   * @returns {Promise<Object>} 包含操作结果的对象
   */
  async startMqttService() {
    try {
      console.log('[wiperService] 启动MQTT控制服务');
      const response = await post('/api/wiper/start-service');

      // 处理响应数据
      const data = await response.json();

      if (data.success) {
        console.log('[wiperService] MQTT控制服务已启动');
      } else {
        console.error('[wiperService] 启动MQTT控制服务失败:', data.error);
      }

      return data;
    } catch (error) {
      console.error('[wiperService] 启动MQTT控制服务错误:', error);
      return {
        success: false,
        error: error.message || '启动MQTT控制服务失败'
      };
    }
  },

  /**
   * 停止MQTT控制服务
   * @returns {Promise<Object>} 包含操作结果的对象
   */
  async stopMqttService() {
    try {
      console.log('[wiperService] 停止MQTT控制服务');
      const response = await post('/api/wiper/stop-service');

      // 处理响应数据
      const data = await response.json();

      if (data.success) {
        console.log('[wiperService] MQTT控制服务已停止');
      } else {
        console.error('[wiperService] 停止MQTT控制服务失败:', data.error);
      }

      return data;
    } catch (error) {
      console.error('[wiperService] 停止MQTT控制服务错误:', error);
      return {
        success: false,
        error: error.message || '停止MQTT控制服务失败'
      };
    }
  }
};

export default wiperService;
