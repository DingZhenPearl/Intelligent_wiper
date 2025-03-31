import { Capacitor } from '@capacitor/core';

// 检测当前运行环境是否为原生APP
export const isNative = () => {
  return Capacitor.isNativePlatform();
};

// 检测当前运行环境是否为Android
export const isAndroid = () => {
  return isNative() && Capacitor.getPlatform() === 'android';
};

// 检测当前运行环境是否为iOS
export const isIOS = () => {
  return isNative() && Capacitor.getPlatform() === 'ios';
};

// 检测当前运行环境是否为web浏览器
export const isWeb = () => {
  return !isNative();
};

// 获取设备信息
export const getDeviceInfo = async () => {
  if (isNative()) {
    try {
      const { Device } = await import('@capacitor/device');
      return await Device.getInfo();
    } catch (e) {
      console.error('获取设备信息失败', e);
      return { platform: Capacitor.getPlatform() };
    }
  }
  return { platform: 'web' };
};

// 获取网络状态
export const getNetworkStatus = async () => {
  if (isNative()) {
    try {
      const { Network } = await import('@capacitor/network');
      return await Network.getStatus();
    } catch (e) {
      console.error('获取网络状态失败', e);
      return { connected: true }; // 假设连接正常
    }
  }
  return { connected: navigator.onLine };
};
