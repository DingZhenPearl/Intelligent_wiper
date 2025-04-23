<template>
  <div class="app-container">
    <!-- 主内容区域 -->
    <div class="main-content">
      <router-view />
    </div>

    <!-- 底部导航栏，在登录页面不显示 -->
    <nav class="bottom-nav" v-if="!isLoginPage">
      <router-link to="/home" class="nav-item">
        <span class="icon">🏠</span>
        <span>控制</span>
      </router-link>
      <router-link to="/statistics" class="nav-item">
        <span class="icon">📊</span>
        <span>数据统计</span>
      </router-link>
      <router-link to="/settings" class="nav-item">
        <span class="icon">⚙️</span>
        <span>状态与设置</span>
      </router-link>
      <router-link to="/weather" class="nav-item">
        <span class="icon">🌤️</span>
        <span>天气预报</span>
      </router-link>
    </nav>
  </div>
</template>

<script>
import { useRoute } from 'vue-router'
import { computed } from 'vue'

export default {
  name: 'App',
  setup() {
    const route = useRoute()
    const isLoginPage = computed(() => route.path === '/login')

    return {
      isLoginPage
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f8f9fa;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg) var(--spacing-md);
  padding-bottom: calc(var(--spacing-xxl) * 2.5);
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%; /* 将导航栏左边缘放在视口中心 */
  transform: translateX(-50%); /* 向左移动自身宽度的一半以实现居中 */
  display: flex;
  justify-content: space-around;
  background-color: white;
  padding: var(--spacing-xs) 0 var(--spacing-md);
  box-shadow: 0 -2px var(--spacing-sm) rgba(0, 0, 0, 0.1);
  z-index: 100;
  height: auto;
  width: 100%; /* 确保全宽 */
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: #666;
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) 0;
  transition: color 0.3s;
  width: 25%;
}

.nav-item .icon {
  font-size: calc(var(--font-size-lg) * 1.3);
  margin-bottom: var(--spacing-xs) * 0.5;
}

.router-link-active {
  color: var(--primary-color);
}

/* 媒体查询优化 */
@media screen and (min-width: 768px) {
  .main-content {
    padding: var(--spacing-md);
    padding-bottom: calc(var(--spacing-xl) * 2);
    max-width: 90%;
    margin: 0 auto;
  }

  .bottom-nav {
    width: 90%; /* 改为百分比宽度 */
    /* left 和 transform 已在基础样式中设置 */
    border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
    padding: var(--spacing-xs) 0 var(--spacing-md);
  }

  .nav-item {
    font-size: var(--font-size-md);
  }

  .nav-item .icon {
    font-size: var(--font-size-xl);
  }
}

@media screen and (min-width: 1024px) {
  .main-content {
    max-width: 85%;
  }

  .bottom-nav {
    width: 85%; /* 大屏幕稍微窄一些 */
    max-width: 1600px; /* 设置最大宽度防止在超宽屏幕上过宽 */
  }
}

@media screen and (min-width: 1400px) {
  .main-content {
    max-width: 80%;
  }

  .bottom-nav {
    width: 80%; /* 在更大的屏幕上进一步减小比例 */
  }
}

@media screen and (min-width: 1800px) {
  .main-content, .bottom-nav {
    width: 75%; /* 超宽屏幕继续减小比例 */
  }
}
</style>
