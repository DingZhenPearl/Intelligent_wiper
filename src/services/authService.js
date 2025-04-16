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

    // 登出前显示localstorage中的用户信息
    const userDataStr = localStorage.getItem('user');
    console.log('[认证服务] 登出前的localStorage中的用户信息:', userDataStr);
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        console.log('[认证服务] 登出前的解析后的用户信息:', userData);
        console.log('[认证服务] 登出前的当前用户名:', userData.username);
      } catch (e) {
        console.error('[认证服务] 解析用户信息出错:', e);
      }
    } else {
      console.log('[认证服务] 登出前的localStorage中没有用户信息');
    }

    // 清除本地存储
    localStorage.removeItem('user');
    console.log('[认证服务] 已清除localStorage中的user项');

    // 清除后再次检查
    const afterClearUserData = localStorage.getItem('user');
    console.log('[认证服务] 清除后的localStorage中的用户信息:', afterClearUserData);

    // 重定向到登录页面
    router.push('/login');
  }
};

export default authService;
