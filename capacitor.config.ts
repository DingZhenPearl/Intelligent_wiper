import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rainwiper.app',
  appName: '智能雨刷控制系统',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
