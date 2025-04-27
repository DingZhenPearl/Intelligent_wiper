// src/utils/geolocationWrapper.js
import { Geolocation } from '@capacitor/geolocation';
import { isAndroid, isNative } from './platform';

/**
 * 安全地检查位置权限
 * @returns {Promise<Object>} 权限状态
 */
export const safeCheckPermissions = async () => {
  try {
    console.log('[GeolocationWrapper] 检查位置权限...');
    const result = await Geolocation.checkPermissions();
    console.log('[GeolocationWrapper] 权限状态:', result);
    return result;
  } catch (error) {
    console.error('[GeolocationWrapper] 检查权限失败:', error);
    return { location: 'unknown' };
  }
};

/**
 * 安全地请求位置权限
 * @returns {Promise<Object>} 权限状态
 */
export const safeRequestPermissions = async () => {
  try {
    console.log('[GeolocationWrapper] 请求位置权限...');
    const result = await Geolocation.requestPermissions({
      permissions: ['location']
    });
    console.log('[GeolocationWrapper] 权限请求结果:', result);
    return result;
  } catch (error) {
    console.error('[GeolocationWrapper] 请求权限失败:', error);
    return { location: 'unknown' };
  }
};

/**
 * 安全地获取当前位置
 * @param {Object} options 位置选项
 * @returns {Promise<Object>} 位置信息
 */
export const safeGetCurrentPosition = async (options = {}) => {
  try {
    console.log('[GeolocationWrapper] 获取当前位置...');
    
    // 在Android上，不要尝试检查位置服务是否开启
    if (isNative() && isAndroid()) {
      console.log('[GeolocationWrapper] Android环境，跳过检查位置服务状态');
    }
    
    // 默认选项
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };
    
    // 合并选项
    const positionOptions = { ...defaultOptions, ...options };
    console.log('[GeolocationWrapper] 位置选项:', positionOptions);
    
    const position = await Geolocation.getCurrentPosition(positionOptions);
    console.log('[GeolocationWrapper] 获取位置成功:', position);
    return position;
  } catch (error) {
    console.error('[GeolocationWrapper] 获取位置失败:', error);
    throw error; // 重新抛出错误，让调用者处理
  }
};

/**
 * 检查位置服务是否开启（仅在非Android平台上使用）
 * @returns {Promise<boolean>} 位置服务状态
 */
export const safeIsLocationEnabled = async () => {
  // 在Android上，直接返回true，避免调用不支持的方法
  if (isNative() && isAndroid()) {
    console.log('[GeolocationWrapper] Android环境，跳过检查位置服务状态，假设已开启');
    return true;
  }
  
  try {
    console.log('[GeolocationWrapper] 检查位置服务状态...');
    // 在非Android平台上尝试调用isLocationEnabled
    if (typeof Geolocation.isLocationEnabled === 'function') {
      const enabled = await Geolocation.isLocationEnabled();
      console.log('[GeolocationWrapper] 位置服务状态:', enabled);
      return enabled;
    } else {
      console.log('[GeolocationWrapper] isLocationEnabled方法不可用，假设已开启');
      return true;
    }
  } catch (error) {
    console.error('[GeolocationWrapper] 检查位置服务状态失败:', error);
    // 出错时假设位置服务已开启
    return true;
  }
};
