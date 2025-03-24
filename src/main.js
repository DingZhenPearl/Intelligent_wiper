// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/css/global.scss'
import './assets/css/mobile.scss'  // 添加移动设备样式

document.addEventListener('deviceready', () => {
  console.log('设备准备就绪');
}, false);

const app = createApp(App)
app.use(router)
app.mount('#app')