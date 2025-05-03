// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 导入路由配置
import './assets/css/global.scss' // 导入全局样式
import './assets/css/mobile.scss' // 导入移动端样式
import voiceService from './services/voiceService' // 导入语音服务
import nativeVoiceService from './services/nativeVoiceService' // 导入原生语音服务

// 创建Vue应用
const app = createApp(App)

// 使用路由
app.use(router)

// 挂载应用
app.mount('#app')

// 初始化语音服务（在应用挂载后）
setTimeout(async () => {
  try {
    console.log('[主应用] 初始化语音服务');

    // 尝试初始化原生语音服务
    const nativeInitSuccess = nativeVoiceService.setup();

    if (nativeInitSuccess) {
      console.log('[主应用] 原生语音服务初始化成功');
    } else {
      console.log('[主应用] 原生语音服务初始化失败，尝试使用Web语音服务');
      await voiceService.setup();
    }

    console.log('[主应用] 语音服务初始化完成');
  } catch (err) {
    console.error('[主应用] 初始化语音服务失败:', err);
  }
}, 500); // 延迟500毫秒，确保应用已挂载