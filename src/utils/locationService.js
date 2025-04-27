// src/utils/locationService.js
import { isNative, isAndroid, isIOS } from './platform';

// 异步导入Geolocation插件
const getGeolocationPlugin = async () => {
  if (isNative()) {
    try {
      console.log('[位置服务] 正在加载Capacitor Geolocation插件...');

      // 检查Capacitor是否正确初始化
      try {
        const platform = isNative() ? 'native' : 'web';
        console.log(`[位置服务] 当前平台: ${platform}`);

        if (isNative()) {
          const specificPlatform = isAndroid() ? 'Android' : (isIOS() ? 'iOS' : 'unknown');
          console.log(`[位置服务] 具体平台: ${specificPlatform}`);
        }
      } catch (platformError) {
        console.error('[位置服务] 检查平台时出错:', platformError);
      }

      // 导入Geolocation插件
      console.log('[位置服务] 开始导入@capacitor/geolocation...');
      const { Geolocation } = await import('@capacitor/geolocation');

      // 验证插件是否正确加载
      if (!Geolocation) {
        console.error('[位置服务] Geolocation插件导入成功，但对象为空');
        throw new Error('Geolocation插件对象为空');
      }

      // 检查插件方法是否存在
      const methods = ['checkPermissions', 'requestPermissions', 'getCurrentPosition'];
      const missingMethods = methods.filter(method => !Geolocation[method]);

      if (missingMethods.length > 0) {
        console.error(`[位置服务] Geolocation插件缺少方法: ${missingMethods.join(', ')}`);
        throw new Error(`Geolocation插件缺少必要方法: ${missingMethods.join(', ')}`);
      }

      console.log('[位置服务] Capacitor Geolocation插件加载成功');
      console.log('[位置服务] 可用方法:', Object.keys(Geolocation).join(', '));

      return Geolocation;
    } catch (error) {
      console.error('[位置服务] 加载Geolocation插件失败:', error);
      console.error('[位置服务] 错误详情:', error.message);
      console.error('[位置服务] 错误堆栈:', error.stack);

      throw new Error('无法加载地理位置插件: ' + error.message);
    }
  } else {
    console.log('[位置服务] 非原生环境，不加载Capacitor Geolocation插件');
  }
  return null;
};

/**
 * 检查定位权限
 * @returns {Promise<Object>} 权限状态对象
 */
export const checkLocationPermission = async () => {
  try {
    if (isNative()) {
      console.log('[位置服务] 在原生环境中检查定位权限...');

      try {
        const Geolocation = await getGeolocationPlugin();

        if (!Geolocation) {
          console.error('[位置服务] Geolocation插件为空，无法检查权限');
          return { granted: false, status: 'error', error: 'Geolocation插件为空' };
        }

        // 检查权限状态
        console.log('[位置服务] 调用Geolocation.checkPermissions()...');

        try {
          const permissionStatus = await Geolocation.checkPermissions();
          console.log('[位置服务] 定位权限状态:', JSON.stringify(permissionStatus));

          // 检查返回的权限状态是否有效
          if (!permissionStatus || typeof permissionStatus.location === 'undefined') {
            console.warn('[位置服务] 权限状态返回无效:', permissionStatus);
            return { granted: false, status: 'unknown', error: '权限状态返回无效' };
          }

          const result = {
            granted: permissionStatus.location === 'granted',
            status: permissionStatus.location
          };

          console.log('[位置服务] 权限检查结果:', JSON.stringify(result));
          return result;
        } catch (checkError) {
          console.error('[位置服务] 检查权限时发生错误:', checkError);
          console.error('[位置服务] 错误详情:', checkError.message);
          console.error('[位置服务] 错误堆栈:', checkError.stack);

          return {
            granted: false,
            status: 'error',
            error: `检查权限时发生错误: ${checkError.message}`
          };
        }
      } catch (pluginError) {
        console.error('[位置服务] 获取Geolocation插件时发生错误:', pluginError);
        console.error('[位置服务] 错误详情:', pluginError.message);
        console.error('[位置服务] 错误堆栈:', pluginError.stack);

        return {
          granted: false,
          status: 'error',
          error: `获取Geolocation插件时发生错误: ${pluginError.message}`
        };
      }
    } else {
      console.log('[位置服务] 在浏览器环境中，无法直接检查权限，返回未知状态');
      // 浏览器环境下，无法直接检查权限，返回未知状态
      return { granted: null, status: 'unknown' };
    }
  } catch (error) {
    console.error('[位置服务] 检查定位权限失败:', error);
    console.error('[位置服务] 错误详情:', error.message);
    console.error('[位置服务] 错误堆栈:', error.stack);

    return { granted: false, status: 'error', error: error.message };
  }
};

/**
 * 请求定位权限
 * @returns {Promise<Object>} 权限请求结果
 */
export const requestLocationPermission = async () => {
  try {
    if (isNative()) {
      console.log('[位置服务] 在原生环境中请求定位权限...');

      try {
        const Geolocation = await getGeolocationPlugin();

        if (!Geolocation) {
          console.error('[位置服务] Geolocation插件为空，无法请求权限');
          return { granted: false, status: 'error', error: 'Geolocation插件为空' };
        }

        // 先检查当前权限状态
        console.log('[位置服务] 先检查当前权限状态...');
        const currentStatus = await Geolocation.checkPermissions();
        console.log('[位置服务] 当前权限状态:', JSON.stringify(currentStatus));

        // 如果已经有权限，直接返回
        if (currentStatus.location === 'granted') {
          console.log('[位置服务] 已经有定位权限，无需再次请求');
          return {
            granted: true,
            status: 'granted'
          };
        }

        // 请求权限
        console.log('[位置服务] 调用Geolocation.requestPermissions()...');
        const permissionStatus = await Geolocation.requestPermissions({
          permissions: ['location']
        });
        console.log('[位置服务] 定位权限请求结果:', JSON.stringify(permissionStatus));

        // 再次检查权限状态，确保权限已更新
        console.log('[位置服务] 再次检查权限状态...');
        const newStatus = await Geolocation.checkPermissions();
        console.log('[位置服务] 更新后的权限状态:', JSON.stringify(newStatus));

        return {
          granted: newStatus.location === 'granted',
          status: newStatus.location
        };
      } catch (permError) {
        console.error('[位置服务] 请求权限时发生错误:', permError);
        console.error('[位置服务] 错误详情:', permError.message);
        console.error('[位置服务] 错误堆栈:', permError.stack);

        return {
          granted: false,
          status: 'error',
          error: permError.message
        };
      }
    } else {
      console.log('[位置服务] 在浏览器环境中请求定位权限...');
      // 浏览器环境下，通过尝试获取位置来触发权限请求
      return new Promise((resolve) => {
        if (navigator.geolocation) {
          console.log('[位置服务] 调用navigator.geolocation.getCurrentPosition()...');
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('[位置服务] 浏览器定位权限请求成功:', position);
              resolve({ granted: true, status: 'granted' });
            },
            (error) => {
              console.error('[位置服务] 浏览器定位权限请求失败:', error);
              console.error('[位置服务] 错误代码:', error.code);
              console.error('[位置服务] 错误信息:', error.message);

              resolve({
                granted: false,
                status: error.code === 1 ? 'denied' : 'error',
                error: error.message
              });
            },
            {
              timeout: 10000,
              enableHighAccuracy: true,
              maximumAge: 0 // 不使用缓存
            }
          );
        } else {
          console.error('[位置服务] 浏览器不支持地理位置功能');
          resolve({ granted: false, status: 'unsupported' });
        }
      });
    }
  } catch (error) {
    console.error('[位置服务] 请求定位权限失败:', error);
    console.error('[位置服务] 错误详情:', error.message);
    console.error('[位置服务] 错误堆栈:', error.stack);

    return { granted: false, status: 'error', error: error.message };
  }
};

/**
 * 获取当前位置
 * @param {Object} options - 定位选项
 * @returns {Promise<Object>} 位置信息
 */
export const getCurrentPosition = async (options = {}) => {
  try {
    if (isNative()) {
      console.log('[位置服务] 在原生环境中获取当前位置...');

      try {
        // 先检查权限
        console.log('[位置服务] 先检查定位权限...');
        const permissionStatus = await checkLocationPermission();
        console.log('[位置服务] 当前定位权限状态:', JSON.stringify(permissionStatus));

        // 如果没有权限，先请求权限
        if (permissionStatus.status !== 'granted') {
          console.log('[位置服务] 没有定位权限，先请求权限...');
          const requestResult = await requestLocationPermission();
          console.log('[位置服务] 权限请求结果:', JSON.stringify(requestResult));

          if (!requestResult.granted) {
            console.error('[位置服务] 用户拒绝了定位权限请求');
            return {
              success: false,
              error: '用户拒绝了定位权限请求，请在设备设置中允许应用使用位置信息'
            };
          }
        }

        const Geolocation = await getGeolocationPlugin();

        if (!Geolocation) {
          console.error('[位置服务] Geolocation插件为空，无法获取位置');
          return {
            success: false,
            error: 'Geolocation插件为空'
          };
        }

        // 默认选项
        const defaultOptions = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        };

        // 合并选项
        const positionOptions = { ...defaultOptions, ...options };
        console.log('[位置服务] 定位选项:', JSON.stringify(positionOptions));

        // 获取位置
        console.log('[位置服务] 调用Geolocation.getCurrentPosition()...');
        try {
          const position = await Geolocation.getCurrentPosition(positionOptions);
          console.log('[位置服务] 原生定位成功:', JSON.stringify(position));

          if (!position || !position.coords) {
            console.error('[位置服务] 位置信息无效:', position);
            return {
              success: false,
              error: '获取到的位置信息无效'
            };
          }

          return {
            success: true,
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed
            },
            timestamp: position.timestamp
          };
        } catch (posError) {
          console.error('[位置服务] 获取位置时发生错误:', posError);
          console.error('[位置服务] 错误详情:', posError.message);
          console.error('[位置服务] 错误堆栈:', posError.stack);

          return {
            success: false,
            error: posError.message || '获取位置时发生错误'
          };
        }
      } catch (nativeError) {
        console.error('[位置服务] 原生定位过程中发生错误:', nativeError);
        console.error('[位置服务] 错误详情:', nativeError.message);
        console.error('[位置服务] 错误堆栈:', nativeError.stack);

        return {
          success: false,
          error: nativeError.message || '原生定位过程中发生错误'
        };
      }
    } else {
      console.log('[位置服务] 在浏览器环境中获取当前位置...');
      // 浏览器环境下使用Web Geolocation API
      return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
          console.log('[位置服务] 调用navigator.geolocation.getCurrentPosition()...');
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('[位置服务] 浏览器定位成功:', position);
              resolve({
                success: true,
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  altitude: position.coords.altitude,
                  heading: position.coords.heading,
                  speed: position.coords.speed
                },
                timestamp: position.timestamp
              });
            },
            (error) => {
              console.error('[位置服务] 浏览器定位失败:', error);
              console.error('[位置服务] 错误代码:', error.code);
              console.error('[位置服务] 错误信息:', error.message);

              let errorMessage = '';

              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = '用户拒绝了地理位置请求';
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = '位置信息不可用';
                  break;
                case error.TIMEOUT:
                  errorMessage = '获取用户位置超时';
                  break;
                default:
                  errorMessage = '获取位置时发生未知错误';
              }

              reject({
                success: false,
                error: errorMessage,
                code: error.code
              });
            },
            // 选项
            {
              enableHighAccuracy: options.enableHighAccuracy !== undefined ? options.enableHighAccuracy : true,
              timeout: options.timeout || 10000,
              maximumAge: options.maximumAge || 0
            }
          );
        } else {
          console.error('[位置服务] 浏览器不支持地理位置功能');
          reject({
            success: false,
            error: '浏览器不支持地理位置功能',
            code: 'UNSUPPORTED'
          });
        }
      });
    }
  } catch (error) {
    console.error('[位置服务] 获取位置失败:', error);
    console.error('[位置服务] 错误详情:', error.message);
    console.error('[位置服务] 错误堆栈:', error.stack);

    return {
      success: false,
      error: error.message || '获取位置时发生错误'
    };
  }
};

/**
 * 监视位置变化
 * @param {Function} successCallback - 成功回调
 * @param {Function} errorCallback - 错误回调
 * @param {Object} options - 定位选项
 * @returns {Promise<Object>} 监视ID或错误信息
 */
export const watchPosition = async (successCallback, errorCallback, options = {}) => {
  try {
    if (isNative()) {
      const Geolocation = await getGeolocationPlugin();

      // 默认选项
      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      // 合并选项
      const watchOptions = { ...defaultOptions, ...options };

      // 监视位置变化
      const watchId = await Geolocation.watchPosition(watchOptions, (position, err) => {
        if (err) {
          console.error('原生位置监视错误:', err);
          if (errorCallback) errorCallback({
            success: false,
            error: err.message || '监视位置时发生错误'
          });
          return;
        }

        console.log('原生位置监视更新:', position);
        if (successCallback) successCallback({
          success: true,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed
          },
          timestamp: position.timestamp
        });
      });

      return { success: true, watchId };
    } else {
      // 浏览器环境下使用Web Geolocation API
      if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            console.log('浏览器位置监视更新:', position);
            if (successCallback) successCallback({
              success: true,
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                heading: position.coords.heading,
                speed: position.coords.speed
              },
              timestamp: position.timestamp
            });
          },
          (error) => {
            console.error('浏览器位置监视错误:', error);
            let errorMessage = '';

            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = '用户拒绝了地理位置请求';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = '位置信息不可用';
                break;
              case error.TIMEOUT:
                errorMessage = '获取用户位置超时';
                break;
              default:
                errorMessage = '获取位置时发生未知错误';
            }

            if (errorCallback) errorCallback({
              success: false,
              error: errorMessage,
              code: error.code
            });
          },
          // 选项
          {
            enableHighAccuracy: options.enableHighAccuracy !== undefined ? options.enableHighAccuracy : true,
            timeout: options.timeout || 10000,
            maximumAge: options.maximumAge || 0
          }
        );

        return { success: true, watchId };
      } else {
        return {
          success: false,
          error: '浏览器不支持地理位置功能',
          code: 'UNSUPPORTED'
        };
      }
    }
  } catch (error) {
    console.error('设置位置监视失败:', error);
    return {
      success: false,
      error: error.message || '设置位置监视时发生错误'
    };
  }
};

/**
 * 清除位置监视
 * @param {Number} watchId - 监视ID
 * @returns {Promise<Object>} 操作结果
 */
export const clearWatch = async (watchId) => {
  try {
    if (isNative()) {
      const Geolocation = await getGeolocationPlugin();
      await Geolocation.clearWatch({ id: watchId });
      return { success: true };
    } else {
      // 浏览器环境下使用Web Geolocation API
      if (navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
        return { success: true };
      } else {
        return {
          success: false,
          error: '浏览器不支持地理位置功能'
        };
      }
    }
  } catch (error) {
    console.error('清除位置监视失败:', error);
    return {
      success: false,
      error: error.message || '清除位置监视时发生错误'
    };
  }
};
