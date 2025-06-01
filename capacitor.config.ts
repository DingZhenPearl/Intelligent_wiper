import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rainwiper.app',
  appName: '智能雨刷控制系统',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['*'],
    // 在开发模式下，让安卓应用连接到开发服务器
    url: 'http://10.129.154.206:3000', // 使用服务器显示的IP地址
    iosScheme: 'http'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
