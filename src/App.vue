<template>
  <div class="app-container">
    <!-- 主内容区域 -->
    <div class="main-content">
      <router-view />
    </div>
    
    <!-- 底部导航栏 -->
    <nav class="bottom-nav">
      <router-link to="/control" class="nav-item">
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
    </nav>
  </div>
</template>

<script>
export default {
  name: 'App'
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
  padding: 32px 24px; /* 从16px 12px增大到32px 24px */
  padding-bottom: 144px; /* 从72px增大到144px */
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  background-color: white;
  padding: 20px 0; /* 从10px增大到20px */
  box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.1); /* 增强阴影 */
  z-index: 10; /* 确保导航栏始终显示在顶部 */
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: #666;
  font-size: 26px; /* 从13px增大到26px */
  padding: 12px 0; /* 从6px增大到12px */
  transition: color 0.3s;
  width: 33%;
}

.nav-item .icon {
  font-size: 44px; /* 从22px增大到44px */
  margin-bottom: 4px; /* 从2px增大到4px */
}

.router-link-active {
  color: #4285f4;
}

/* 添加额外的响应式样式 */
@media screen and (max-width: 320px) {
  .nav-item {
    font-size: 24px; /* 从12px增大到24px */
  }
  
  .nav-item .icon {
    font-size: 40px; /* 从20px增大到40px */
  }
  
  .main-content {
    padding: 24px 20px; /* 从12px 10px增大到24px 20px */
    padding-bottom: 136px; /* 从68px增大到136px */
  }
}

@media screen and (min-width: 768px) {
  .main-content {
    padding: 24px 20px;
    padding-bottom: 80px;
    max-width: 960px;
    margin: 0 auto;
  }
  
  .bottom-nav {
    max-width: 960px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 16px 16px 0 0;
  }
}
</style>
