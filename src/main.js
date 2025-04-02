// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 导入路由配置
import './assets/css/global.scss' // 导入全局样式
import './assets/css/mobile.scss' // 导入移动端样式

// 创建Vue应用
const app = createApp(App)

// 使用路由
app.use(router)

// 挂载应用
app.mount('#app')