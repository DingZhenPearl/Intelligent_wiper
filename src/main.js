// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
// 更改文件扩展名匹配实际情况
import './assets/css/global.scss'

const app = createApp(App)
app.use(router)
app.mount('#app')