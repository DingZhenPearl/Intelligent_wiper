<template>
  <div class="app-container">
    <!-- 导航栏 -->
    <nav class="nav-bar">
      <router-link to="/" class="nav-item">首页</router-link>
      <router-link to="/rainfall" class="nav-item">雨量显示</router-link>
    </nav>
    
    <!-- 主内容区域 -->
    <div class="main-content">
      <router-view />
    </div>
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
}

.nav-bar {
  display: flex;
  background-color: #2c3e50;
  padding: 15px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-item {
  color: #ffffff;
  text-decoration: none;
  margin-right: 20px;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.nav-item:hover,
.router-link-active {
  background-color: #42b983;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
