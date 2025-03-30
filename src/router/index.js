// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login/index.vue')
  },
  {
    path: '/control',
    name: 'Control',
    component: Home
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('@/views/Statistics/index.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings/index.vue')
  },
  {
    path: '/',
    redirect: '/login'
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router