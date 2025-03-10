// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home'
import RainfallChart from '@/views/RainfallChart'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/rainfall',
    name: 'RainfallChart', 
    component: RainfallChart
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router