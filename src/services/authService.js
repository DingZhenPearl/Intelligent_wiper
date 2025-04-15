// src/services/authService.js
import router from '../router';

// 最简化的认证服务，只处理localStorage存储和清除

const authService = {
  // 获取当前登录用户信息
  getCurrentUser() {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch (e) {
      console.error('解析用户数据出错:', e);
      return null;
    }
  },

  // 登出
  logout() {
    console.log('[认证服务] 用户登出');

    // 清除本地存储
    localStorage.removeItem('user');

    // 重定向到登录页面
    router.push('/login');
  }
};

export default authService;
