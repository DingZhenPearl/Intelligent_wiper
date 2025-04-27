import { Capacitor } from '@capacitor/core';

// 检测当前运行环境是否为原生APP
export const isNative = () => {
  const nativeResult = Capacitor.isNativePlatform();
  console.log(`[平台] 检测是否为原生平台: ${nativeResult}`);
  return nativeResult;
};

// 检测当前运行环境是否为Android
export const isAndroid = () => {
  const isNativeEnv = isNative();
  const platform = Capacitor.getPlatform();
  const androidResult = isNativeEnv && platform === 'android';
  console.log(`[平台] 检测是否为Android: ${androidResult} (isNative=${isNativeEnv}, platform=${platform})`);
  return androidResult;
};

// 检测当前运行环境是否为iOS
export const isIOS = () => {
  const isNativeEnv = isNative();
  const platform = Capacitor.getPlatform();
  const iosResult = isNativeEnv && platform === 'ios';
  console.log(`[平台] 检测是否为iOS: ${iosResult} (isNative=${isNativeEnv}, platform=${platform})`);
  return iosResult;
};

// 检测当前运行环境是否为web浏览器
export const isWeb = () => {
  const webResult = !isNative();
  console.log(`[平台] 检测是否为Web浏览器: ${webResult}`);
  return webResult;
};

// 获取设备信息
export const getDeviceInfo = async () => {
  console.log('[平台] 开始获取设备信息');

  if (isNative()) {
    console.log('[平台] 在原生环境中获取设备信息');
    try {
      console.log('[平台] 导入Device插件');
      const { Device } = await import('@capacitor/device');

      console.log('[平台] 调用Device.getInfo()');
      const deviceInfo = await Device.getInfo();
      console.log('[平台] 设备信息:', JSON.stringify(deviceInfo));

      return deviceInfo;
    } catch (e) {
      console.error('[平台] 获取设备信息失败', e);
      console.error('[平台] 错误详情:', e.message);
      console.error('[平台] 错误堆栈:', e.stack);

      const fallbackInfo = { platform: Capacitor.getPlatform() };
      console.log('[平台] 使用备用设备信息:', JSON.stringify(fallbackInfo));

      return fallbackInfo;
    }
  }

  const webInfo = { platform: 'web' };
  console.log('[平台] Web环境设备信息:', JSON.stringify(webInfo));
  return webInfo;
};

// 获取网络状态
export const getNetworkStatus = async () => {
  console.log('[平台] 开始获取网络状态');

  if (isNative()) {
    console.log('[平台] 在原生环境中获取网络状态');
    try {
      console.log('[平台] 导入Network插件');
      const { Network } = await import('@capacitor/network');

      console.log('[平台] 调用Network.getStatus()');
      const networkStatus = await Network.getStatus();
      console.log('[平台] 网络状态:', JSON.stringify(networkStatus));

      return networkStatus;
    } catch (e) {
      console.error('[平台] 获取网络状态失败', e);
      console.error('[平台] 错误详情:', e.message);
      console.error('[平台] 错误堆栈:', e.stack);

      const fallbackStatus = { connected: true };
      console.log('[平台] 使用备用网络状态(假设连接正常):', JSON.stringify(fallbackStatus));

      return fallbackStatus;
    }
  }

  const webStatus = { connected: navigator.onLine };
  console.log('[平台] Web环境网络状态:', JSON.stringify(webStatus));
  return webStatus;
};
