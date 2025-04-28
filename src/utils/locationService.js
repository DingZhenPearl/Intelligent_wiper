// src/utils/locationService.js
import { isNative, isAndroid, isIOS } from './platform';
import { App } from '@capacitor/app';
import NativeLocation from './nativeLocation';

// 是否启用IP定位作为备选
const ENABLE_IP_FALLBACK = true;

// 权限状态事件监听器
let permissionListenersInitialized = false;
let permissionStatusCallbacks = [];

// 初始化权限状态监听
const initPermissionListeners = () => {
  if (permissionListenersInitialized || !isNative()) return;

  console.log('[位置服务] 初始化权限状态监听器');

  // 监听位置权限授予事件
  window.addEventListener('locationPermissionGranted', () => {
    console.log('[位置服务] 收到位置权限授予事件');

    // 通知所有回调
    permissionStatusCallbacks.forEach(callback => {
      try {
        callback({
          granted: true,
          status: 'granted',
          source: 'native_event'
        });
      } catch (e) {
        console.error('[位置服务] 执行权限状态回调时出错:', e);
      }
    });
  });

  // 监听位置权限拒绝事件
  window.addEventListener('locationPermissionDenied', () => {
    console.log('[位置服务] 收到位置权限拒绝事件');

    // 通知所有回调
    permissionStatusCallbacks.forEach(callback => {
      try {
        callback({
          granted: false,
          status: 'denied',
          source: 'native_event'
        });
      } catch (e) {
        console.error('[位置服务] 执行权限状态回调时出错:', e);
      }
    });
  });

  // 监听应用恢复事件，重新检查权限
  App.addListener('resume', async () => {
    console.log('[位置服务] 应用恢复，重新检查位置权限');
    try {
      const status = await checkLocationPermission();
      console.log('[位置服务] 应用恢复后的权限状态:', status);

      // 通知所有回调
      permissionStatusCallbacks.forEach(callback => {
        try {
          callback({
            ...status,
            source: 'app_resume'
          });
        } catch (e) {
          console.error('[位置服务] 执行权限状态回调时出错:', e);
        }
      });
    } catch (e) {
      console.error('[位置服务] 应用恢复后检查权限出错:', e);
    }
  });

  permissionListenersInitialized = true;
  console.log('[位置服务] 权限状态监听器初始化完成');
};

/**
 * 注册权限状态变化回调
 * @param {Function} callback - 权限状态变化回调函数
 * @returns {Function} - 取消注册的函数
 */
export const onPermissionStatusChange = (callback) => {
  if (!permissionListenersInitialized) {
    initPermissionListeners();
  }

  permissionStatusCallbacks.push(callback);
  console.log('[位置服务] 注册了新的权限状态回调，当前回调数:', permissionStatusCallbacks.length);

  // 返回取消注册的函数
  return () => {
    permissionStatusCallbacks = permissionStatusCallbacks.filter(cb => cb !== callback);
    console.log('[位置服务] 取消注册权限状态回调，剩余回调数:', permissionStatusCallbacks.length);
  };
};

// 检查平台信息并记录日志
const logPlatformInfo = () => {
  if (isNative()) {
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
  }
};

/**
 * 检查定位权限
 * @returns {Promise<Object>} 权限状态对象
 */
export const checkLocationPermission = async () => {
  try {
    if (isNative() && isAndroid()) {
      console.log('[位置服务] 在Android原生环境中检查定位权限...');

      // 记录平台信息
      logPlatformInfo();

      try {
        // 使用原生定位检查权限
        console.log('[位置服务] 使用原生定位检查权限...');
        const permissionStatus = await NativeLocation.checkLocationPermission();
        console.log('[位置服务] 定位权限状态:', JSON.stringify(permissionStatus));

        const result = {
          granted: permissionStatus.hasPermission,
          status: permissionStatus.hasPermission ? 'granted' : 'denied',
          isEnabled: permissionStatus.isEnabled
        };

        console.log('[位置服务] 权限检查结果:', JSON.stringify(result));
        return result;
      } catch (error) {
        console.error('[位置服务] 检查权限时发生错误:', error);
        console.error('[位置服务] 错误详情:', error.message);
        console.error('[位置服务] 错误堆栈:', error.stack);

        return {
          granted: false,
          status: 'error',
          error: `检查权限时发生错误: ${error.message}`
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
    if (isNative() && isAndroid()) {
      console.log('[位置服务] 在Android原生环境中请求定位权限...');

      // 记录平台信息
      logPlatformInfo();

      try {
        // 先检查当前权限状态
        console.log('[位置服务] 先检查当前权限状态...');
        const currentStatus = await NativeLocation.checkLocationPermission();
        console.log('[位置服务] 当前权限状态:', JSON.stringify(currentStatus));

        // 如果已经有权限，直接返回
        if (currentStatus.hasPermission) {
          console.log('[位置服务] 已经有定位权限，无需再次请求');
          return {
            granted: true,
            status: 'granted',
            isEnabled: currentStatus.isEnabled
          };
        }

        // 请求权限
        console.log('[位置服务] 使用原生定位请求权限...');
        await NativeLocation.requestLocationPermission();

        // 再次检查权限状态，确保权限已更新
        console.log('[位置服务] 再次检查权限状态...');
        const newStatus = await NativeLocation.checkLocationPermission();
        console.log('[位置服务] 更新后的权限状态:', JSON.stringify(newStatus));

        return {
          granted: newStatus.hasPermission,
          status: newStatus.hasPermission ? 'granted' : 'denied',
          isEnabled: newStatus.isEnabled
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

      // 记录平台信息
      logPlatformInfo();

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
              error: '用户拒绝了定位权限请求，请在设备设置中允许应用使用位置信息',
              code: 'PERMISSION_DENIED'
            };
          }
        }

        // 检查位置服务是否开启（非Android平台）
        if (!isAndroid()) {
          // 在非Android平台上，我们暂时假设位置服务已开启
          console.log('[位置服务] 非Android平台，跳过检查位置服务状态');
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
        console.log('[位置服务] 使用原生定位获取位置...');
        try {
          // 使用原生定位获取位置
          try {
            const position = await NativeLocation.getCurrentPosition(positionOptions);
            console.log('[位置服务] 原生定位成功:', JSON.stringify(position));

            if (!position || !position.coords) {
              console.error('[位置服务] 位置信息无效:', position);
              throw new Error('获取到的位置信息无效');
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
              timestamp: position.timestamp,
              source: 'gps'
            };
          } catch (gpsError) {
            console.error('[位置服务] GPS定位失败:', gpsError);

            // 如果启用了IP定位备选，尝试使用IP定位
            if (ENABLE_IP_FALLBACK) {
              console.log('[位置服务] 尝试使用IP定位作为备选');
              try {
                const ipPosition = await NativeLocation.getIPLocation();
                console.log('[位置服务] IP定位成功:', JSON.stringify(ipPosition));

                if (!ipPosition || !ipPosition.coords) {
                  console.error('[位置服务] IP位置信息无效:', ipPosition);
                  throw new Error('获取到的IP位置信息无效');
                }

                return {
                  success: true,
                  coords: {
                    latitude: ipPosition.coords.latitude,
                    longitude: ipPosition.coords.longitude,
                    accuracy: ipPosition.coords.accuracy || 10000, // IP定位精度较低
                    altitude: null,
                    heading: null,
                    speed: null
                  },
                  timestamp: ipPosition.timestamp,
                  source: 'ip',
                  ip: ipPosition.ip,
                  city: ipPosition.city,
                  region: ipPosition.region,
                  country: ipPosition.country
                };
              } catch (ipError) {
                console.error('[位置服务] IP定位也失败:', ipError);
                throw gpsError; // 抛出原始GPS错误
              }
            } else {
              throw gpsError;
            }
          }
        } catch (posError) {
          console.error('[位置服务] 获取位置时发生错误:', posError);
          console.error('[位置服务] 错误详情:', posError.message);
          console.error('[位置服务] 错误堆栈:', posError.stack);

          // 检查错误类型，提供更具体的错误信息
          let errorMessage = posError.message || '获取位置时发生错误';
          let errorCode = 'POSITION_ERROR';

          // 尝试解析错误信息
          if (posError.message) {
            if (posError.message.includes('denied') || posError.message.includes('permission')) {
              errorMessage = '位置权限被拒绝，请在设备设置中允许应用使用位置信息';
              errorCode = 'PERMISSION_DENIED';
            } else if (posError.message.includes('timeout')) {
              errorMessage = '获取位置超时，请检查GPS信号或网络连接';
              errorCode = 'TIMEOUT';
            } else if (posError.message.includes('unavailable') || posError.message.includes('disabled')) {
              errorMessage = '位置服务不可用，请检查设备位置服务是否开启';
              errorCode = 'LOCATION_DISABLED';
            }
          }

          console.log(`[位置服务] 错误分类: ${errorCode}, 错误信息: ${errorMessage}`);

          return {
            success: false,
            error: errorMessage,
            code: errorCode
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
              let errorCode = '';

              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = '用户拒绝了地理位置请求';
                  errorCode = 'PERMISSION_DENIED';
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = '位置信息不可用';
                  errorCode = 'POSITION_UNAVAILABLE';
                  break;
                case error.TIMEOUT:
                  errorMessage = '获取用户位置超时';
                  errorCode = 'TIMEOUT';
                  break;
                default:
                  errorMessage = '获取位置时发生未知错误';
                  errorCode = 'UNKNOWN_ERROR';
              }

              reject({
                success: false,
                error: errorMessage,
                code: errorCode
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
      // 在原生环境中，暂时不支持位置监视功能
      // 因为我们需要重新实现安全的watchPosition包装器
      console.error('[位置服务] 原生环境暂不支持位置监视功能');
      if (errorCallback) {
        errorCallback({
          success: false,
          error: '原生环境暂不支持位置监视功能',
          code: 'NOT_IMPLEMENTED'
        });
      }
      return {
        success: false,
        error: '原生环境暂不支持位置监视功能',
        code: 'NOT_IMPLEMENTED'
      };
    } else {
      // 浏览器环境下使用Web Geolocation API
      if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            console.log('[位置服务] 浏览器位置监视更新:', position);
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
            console.error('[位置服务] 浏览器位置监视错误:', error);
            let errorMessage = '';
            let errorCode = '';

            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = '用户拒绝了地理位置请求';
                errorCode = 'PERMISSION_DENIED';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = '位置信息不可用';
                errorCode = 'POSITION_UNAVAILABLE';
                break;
              case error.TIMEOUT:
                errorMessage = '获取用户位置超时';
                errorCode = 'TIMEOUT';
                break;
              default:
                errorMessage = '获取位置时发生未知错误';
                errorCode = 'UNKNOWN_ERROR';
            }

            if (errorCallback) errorCallback({
              success: false,
              error: errorMessage,
              code: errorCode
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
        console.error('[位置服务] 浏览器不支持地理位置功能');
        if (errorCallback) {
          errorCallback({
            success: false,
            error: '浏览器不支持地理位置功能',
            code: 'UNSUPPORTED'
          });
        }
        return {
          success: false,
          error: '浏览器不支持地理位置功能',
          code: 'UNSUPPORTED'
        };
      }
    }
  } catch (error) {
    console.error('[位置服务] 设置位置监视失败:', error);
    if (errorCallback) {
      errorCallback({
        success: false,
        error: error.message || '设置位置监视时发生错误',
        code: 'ERROR'
      });
    }
    return {
      success: false,
      error: error.message || '设置位置监视时发生错误',
      code: 'ERROR'
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
      // 在原生环境中，暂时不支持位置监视功能
      console.error('[位置服务] 原生环境暂不支持位置监视功能');
      return {
        success: false,
        error: '原生环境暂不支持位置监视功能',
        code: 'NOT_IMPLEMENTED'
      };
    } else {
      // 浏览器环境下使用Web Geolocation API
      if (navigator.geolocation) {
        console.log('[位置服务] 清除浏览器位置监视:', watchId);
        navigator.geolocation.clearWatch(watchId);
        return { success: true };
      } else {
        console.error('[位置服务] 浏览器不支持地理位置功能');
        return {
          success: false,
          error: '浏览器不支持地理位置功能',
          code: 'UNSUPPORTED'
        };
      }
    }
  } catch (error) {
    console.error('[位置服务] 清除位置监视失败:', error);
    return {
      success: false,
      error: error.message || '清除位置监视时发生错误',
      code: 'ERROR'
    };
  }
};
