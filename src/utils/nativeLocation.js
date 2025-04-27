// src/utils/nativeLocation.js
import { isNative, isAndroid } from './platform';

/**
 * 检查是否可以使用原生定位
 * @returns {boolean} 是否可以使用原生定位
 */
const canUseNativeLocation = () => {
  return isNative() && isAndroid() && window.NativeLocation !== undefined;
};

/**
 * 检查定位权限
 * @returns {Promise<Object>} 权限状态
 */
export const checkLocationPermission = async () => {
  try {
    console.log('[NativeLocation] 检查定位权限...');
    
    if (!canUseNativeLocation()) {
      console.warn('[NativeLocation] 原生定位不可用');
      return { hasPermission: false, isEnabled: false, error: '原生定位不可用' };
    }
    
    const resultJson = window.NativeLocation.checkLocationPermission();
    const result = JSON.parse(resultJson);
    console.log('[NativeLocation] 权限状态:', result);
    
    return {
      hasPermission: result.hasPermission,
      isEnabled: result.isEnabled
    };
  } catch (error) {
    console.error('[NativeLocation] 检查权限失败:', error);
    return { hasPermission: false, isEnabled: false, error: error.message };
  }
};

/**
 * 请求定位权限
 * @returns {Promise<void>}
 */
export const requestLocationPermission = async () => {
  try {
    console.log('[NativeLocation] 请求定位权限...');
    
    if (!canUseNativeLocation()) {
      console.warn('[NativeLocation] 原生定位不可用');
      throw new Error('原生定位不可用');
    }
    
    window.NativeLocation.requestLocationPermission();
    console.log('[NativeLocation] 权限请求已发送');
    
    // 等待一段时间，让权限请求完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 检查权限状态
    const result = await checkLocationPermission();
    console.log('[NativeLocation] 权限请求后的状态:', result);
    
    return result;
  } catch (error) {
    console.error('[NativeLocation] 请求权限失败:', error);
    throw error;
  }
};

/**
 * 获取当前位置
 * @param {Object} options 位置选项
 * @returns {Promise<Object>} 位置信息
 */
export const getCurrentPosition = async (options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('[NativeLocation] 获取当前位置...');
      
      if (!canUseNativeLocation()) {
        console.warn('[NativeLocation] 原生定位不可用');
        reject(new Error('原生定位不可用'));
        return;
      }
      
      // 默认选项
      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };
      
      // 合并选项
      const positionOptions = { ...defaultOptions, ...options };
      console.log('[NativeLocation] 位置选项:', positionOptions);
      
      // 创建回调函数
      const callbackName = 'nativeLocationCallback_' + Date.now();
      
      // 注册回调函数
      window[callbackName] = (result) => {
        // 清理回调函数
        delete window[callbackName];
        
        if (result.success) {
          console.log('[NativeLocation] 获取位置成功:', result.data);
          resolve(result.data);
        } else {
          console.error('[NativeLocation] 获取位置失败:', result.error);
          reject(new Error(result.error));
        }
      };
      
      // 调用原生方法
      window.NativeLocation.getCurrentPosition(
        positionOptions.enableHighAccuracy,
        positionOptions.timeout,
        callbackName
      );
    } catch (error) {
      console.error('[NativeLocation] 获取位置失败:', error);
      reject(error);
    }
  });
};

export default {
  checkLocationPermission,
  requestLocationPermission,
  getCurrentPosition
};
