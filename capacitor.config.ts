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
    }
  }
};

export default config;
