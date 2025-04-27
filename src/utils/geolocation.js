// src/utils/geolocation.js
import { registerPlugin } from '@capacitor/core';

// 注册Geolocation插件
const Geolocation = registerPlugin('Geolocation');

/**
 * 检查位置权限
 * @returns {Promise<Object>} 权限状态
 */
export const checkPermissions = async () => {
  try {
    console.log('[Geolocation] 检查位置权限...');
    const result = await Geolocation.checkPermissions();
    console.log('[Geolocation] 权限状态:', result);
    return result;
  } catch (error) {
    console.error('[Geolocation] 检查权限失败:', error);
    return { location: 'unknown' };
  }
};

/**
 * 请求位置权限
 * @returns {Promise<Object>} 权限状态
 */
export const requestPermissions = async () => {
  try {
    console.log('[Geolocation] 请求位置权限...');
    const result = await Geolocation.requestPermissions({
      permissions: ['location']
    });
    console.log('[Geolocation] 权限请求结果:', result);
    return result;
  } catch (error) {
    console.error('[Geolocation] 请求权限失败:', error);
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
    console.log('[Geolocation] 获取当前位置...');

    // 默认选项
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // 合并选项
    const positionOptions = { ...defaultOptions, ...options };
    console.log('[Geolocation] 位置选项:', positionOptions);

    const position = await Geolocation.getCurrentPosition(positionOptions);
    console.log('[Geolocation] 获取位置成功:', position);
    return position;
  } catch (error) {
    console.error('[Geolocation] 获取位置失败:', error);
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
    console.log('[Geolocation] 开始监听位置变化...');

    // 默认选项
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // 合并选项
    const positionOptions = { ...defaultOptions, ...options };
    console.log('[Geolocation] 监听位置选项:', positionOptions);

    return await Geolocation.watchPosition(positionOptions, callback);
  } catch (error) {
    console.error('[Geolocation] 监听位置失败:', error);
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
    console.log('[Geolocation] 停止监听位置变化:', watchId);
    return await Geolocation.clearWatch({ id: watchId });
  } catch (error) {
    console.error('[Geolocation] 停止监听位置失败:', error);
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
