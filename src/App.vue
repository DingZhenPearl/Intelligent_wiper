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
  padding: 20px;
  padding-bottom: 70px; /* 为底部导航留出空间 */
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  background-color: white;
  padding: 10px 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: #666;
  font-size: 12px;
  padding: 5px 0;
  transition: color 0.3s;
}

.nav-item .icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.router-link-active {
  color: #4285f4;
}
</style>
