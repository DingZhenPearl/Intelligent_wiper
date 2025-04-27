import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rainwiper.app',
  appName: '智能雨刷控制系统',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['*'],
    hostname: 'localhost', // 允许localhost
    iosScheme: 'http'      // 为iOS也设置http
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    Geolocation: {
      // 地理位置插件配置
      permissions: {
        // Android配置
        android: {
          // 是否在应用启动时请求权限
          requestOnStart: true,
          // 是否需要精确定位
          requireFineLocation: true,
          // 是否需要后台定位
          requireBackgroundLocation: false
        }
      }
    }
  }
};

export default config;
