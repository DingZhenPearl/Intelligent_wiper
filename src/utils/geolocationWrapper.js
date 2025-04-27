// src/utils/geolocationWrapper.js
import CustomGeolocation from './customGeolocation';

/**
 * 安全地检查位置权限
 * @returns {Promise<Object>} 权限状态
 */
export const safeCheckPermissions = async () => {
  try {
    console.log('[GeolocationWrapper] 检查位置权限...');
    const result = await CustomGeolocation.checkPermissions();
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
    const result = await CustomGeolocation.requestPermissions({
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

    // 默认选项
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // 合并选项
    const positionOptions = { ...defaultOptions, ...options };
    console.log('[GeolocationWrapper] 位置选项:', positionOptions);

    const position = await CustomGeolocation.getCurrentPosition(positionOptions);
    console.log('[GeolocationWrapper] 获取位置成功:', position);
    return position;
  } catch (error) {
    console.error('[GeolocationWrapper] 获取位置失败:', error);
    throw error; // 重新抛出错误，让调用者处理
  }
};

/**
 * 检查位置服务是否开启
 * @returns {Promise<boolean>} 位置服务状态
 */
export const safeIsLocationEnabled = async () => {
  try {
    console.log('[GeolocationWrapper] 检查位置服务状态...');

    // 尝试调用checkPermissions，如果位置服务未开启，会抛出异常
    try {
      await CustomGeolocation.checkPermissions();
      console.log('[GeolocationWrapper] 位置服务已开启');
      return true;
    } catch (error) {
      if (error.message && error.message.includes('位置服务未启用')) {
        console.log('[GeolocationWrapper] 位置服务未开启');
        return false;
      }

      // 其他错误，假设位置服务已开启
      console.warn('[GeolocationWrapper] 检查位置服务状态出错，假设已开启:', error);
      return true;
    }
  } catch (error) {
    console.error('[GeolocationWrapper] 检查位置服务状态失败:', error);
    // 出错时假设位置服务已开启
    return true;
  }
};
