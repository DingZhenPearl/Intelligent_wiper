import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rainwiper.app',
  appName: '智能雨刷控制系统',
  webDir: 'dist',
  server: {
    androidScheme: 'https', // 使用https以确保安全上下文
    cleartext: true,
    allowNavigation: ['*'],
    hostname: 'localhost', // 允许localhost
    iosScheme: 'https' // 使用https
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
