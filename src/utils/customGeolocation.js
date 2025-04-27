// src/utils/customGeolocation.js
import { registerPlugin } from '@capacitor/core';

// 注册我们的自定义Geolocation插件
const CustomGeolocation = registerPlugin('CustomGeolocation');

/**
 * 检查位置权限
 * @returns {Promise<Object>} 权限状态
 */
export const checkPermissions = async () => {
  try {
    console.log('[CustomGeolocation] 检查位置权限...');
    const result = await CustomGeolocation.checkPermissions();
    console.log('[CustomGeolocation] 权限状态:', result);
    return result;
  } catch (error) {
    console.error('[CustomGeolocation] 检查权限失败:', error);
    return { location: 'unknown' };
  }
};

/**
 * 请求位置权限
 * @returns {Promise<Object>} 权限状态
 */
export const requestPermissions = async () => {
  try {
    console.log('[CustomGeolocation] 请求位置权限...');
    const result = await CustomGeolocation.requestPermissions({
      permissions: ['location']
    });
    console.log('[CustomGeolocation] 权限请求结果:', result);
    return result;
  } catch (error) {
    console.error('[CustomGeolocation] 请求权限失败:', error);
    return { location: 'unknown' };
  }
};

/**
 * 获取当前位置
 * @param {Object} options 位置选项
 * @returns {Promise<Object>} 位置信息
 */
export const getCurrentPosition = async (options = {}) => {
  try {
    console.log('[CustomGeolocation] 获取当前位置...');

    // 默认选项
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // 合并选项
    const positionOptions = { ...defaultOptions, ...options };
    console.log('[CustomGeolocation] 位置选项:', positionOptions);

    const position = await CustomGeolocation.getCurrentPosition(positionOptions);
    console.log('[CustomGeolocation] 获取位置成功:', position);
    return position;
  } catch (error) {
    console.error('[CustomGeolocation] 获取位置失败:', error);
    throw error; // 重新抛出错误，让调用者处理
  }
};

/**
 * 监听位置变化
 * @param {Object} options 位置选项
 * @param {Function} callback 位置更新回调
 * @returns {Promise<Object>} 监听ID
 */
export const watchPosition = async (options = {}, callback) => {
  try {
    console.log('[CustomGeolocation] 开始监听位置变化...');

    // 默认选项
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // 合并选项
    const positionOptions = { ...defaultOptions, ...options };
    console.log('[CustomGeolocation] 监听位置选项:', positionOptions);

    return await CustomGeolocation.watchPosition(positionOptions, callback);
  } catch (error) {
    console.error('[CustomGeolocation] 监听位置失败:', error);
    throw error;
  }
};

/**
 * 停止监听位置变化
 * @param {String} watchId 监听ID
 * @returns {Promise<void>}
 */
export const clearWatch = async (watchId) => {
  try {
    console.log('[CustomGeolocation] 停止监听位置变化:', watchId);
    return await CustomGeolocation.clearWatch({ id: watchId });
  } catch (error) {
    console.error('[CustomGeolocation] 停止监听位置失败:', error);
    throw error;
  }
};

export default {
  checkPermissions,
  requestPermissions,
  getCurrentPosition,
  watchPosition,
  clearWatch
};
