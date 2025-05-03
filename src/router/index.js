// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

// 定义路由配置
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login/index.vue')
  },
  {
    path: '/home',
    name: 'Control',
    component: () => import('../views/Home/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('../views/Statistics/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/weather',
    name: 'Weather',
    component: () => import('../views/Weather/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/map',
    name: 'Map',
    component: () => import('../views/Map/index.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/',
    redirect: () => {
      // 检查是否已登录，决定重定向到哪里
      const isLoggedIn = localStorage.getItem('user') !== null
      return isLoggedIn ? '/home' : '/login'
    }
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局前置守卫
router.beforeEach((to, from, next) => {
  // 检查用户是否已登录
  const isLoggedIn = localStorage.getItem('user') !== null

  // 检查将要进入的路由是否需要认证
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth && !isLoggedIn) {
    // 如果需要认证但未登录，重定向到登录页面
    next('/login')
  } else if (to.path === '/login' && isLoggedIn) {
    // 如果已登录但尝试访问登录页面，重定向到首页
    next('/home')
  } else {
    // 其他情况正常导航
    next()
  }
})

export default router