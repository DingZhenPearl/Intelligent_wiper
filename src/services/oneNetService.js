// src/services/oneNetService.js
import { ref } from 'vue';
import { get } from './api';

// OneNET服务
const oneNetService = {
  // 始终使用OneNET数据源
  isOneNetSource: ref(true),

  // 初始化
  async init() {
    try {
      console.log('[OneNET服务] 初始化');
      // 确保localStorage中的设置也是正确的
      localStorage.setItem('useOneNetSource', 'true');
    } catch (error) {
      console.error('[OneNET服务] 初始化错误:', error);
    }
  },

  // 最后更新时间
  lastUpdateTime: ref(null),

  // 统计数据最后更新时间
  statsLastUpdateTime: ref({
    '10min': null,
    'hourly': null,
    'daily': null,
    'all': null
  }),

  // 是否正在加载
  loading: ref(false),

  // 统计数据加载状态
  statsLoading: ref({
    '10min': false,
    'hourly': false,
    'daily': false,
    'all': false
  }),

  // 错误信息
  error: ref(null),

  // 统计数据错误信息
  statsError: ref({
    '10min': null,
    'hourly': null,
    'daily': null,
    'all': null
  }),

  // 数据源始终为OneNET

  // 从OneNET平台获取雨量数据
  async fetchRainfallData() {
    try {
      // 设置加载状态
      this.loading.value = true;
      this.error.value = null;

      console.log('[OneNET服务] 开始从OneNET平台获取雨量数据');

      // 调用后端API获取OneNET数据
      const response = await get('/api/rainfall/onenet');

      if (response.ok) {
        const data = await response.json();
        console.log('[OneNET服务] 获取OneNET雨量数据成功:', data);

        if (data.success) {
          // 更新最后更新时间
          this.lastUpdateTime.value = new Date();

          // 检查是否有警告信息
          if (data.warning) {
            console.warn(`[OneNET服务] 警告: ${data.warning}`);
            // 存储警告信息，但不影响成功状态
            this.error.value = data.warning;
          } else {
            // 清除之前的错误信息
            this.error.value = null;
          }

          return {
            success: true,
            data: data.data,
            warning: data.warning
          };
        } else {
          this.error.value = data.error || '获取OneNET数据失败';
          return { success: false, error: data.error };
        }
      } else {
        const errorData = await response.json();
        this.error.value = errorData.error || '获取OneNET数据失败';
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error('[OneNET服务] 获取OneNET雨量数据错误:', error);
      this.error.value = error.message || '网络错误';
      return { success: false, error: error.message };
    } finally {
      this.loading.value = false;
    }
  },

  // 从OneNET平台获取统计数据
  async fetchStatisticsData(period = '10min') {
    try {
      // 设置加载状态
      this.statsLoading.value[period] = true;
      this.statsError.value[period] = null;

      console.log(`[OneNET服务] 开始从OneNET平台获取${period}统计数据`);

      // 调用后端API获取OneNET统计数据
      const response = await get(`/api/rainfall/onenet/stats?period=${period}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[OneNET服务] 获取OneNET ${period}统计数据成功:`, data);

        if (data.success) {
          // 更新最后更新时间
          this.statsLastUpdateTime.value[period] = new Date();

          // 检查是否有警告信息
          if (data.warning) {
            console.warn(`[OneNET服务] ${period}统计数据警告: ${data.warning}`);
            // 存储警告信息，但不影响成功状态
            this.statsError.value[period] = data.warning;
          } else {
            // 清除之前的错误信息
            this.statsError.value[period] = null;
          }

          return {
            success: true,
            data: data.data || [],
            currentHour: data.currentHour,
            unit: data.unit,
            warning: data.warning
          };
        } else {
          this.statsError.value[period] = data.error || `获取OneNET ${period}数据失败`;
          return { success: false, error: data.error };
        }
      } else {
        const errorData = await response.json();
        this.statsError.value[period] = errorData.error || `获取OneNET ${period}数据失败`;
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error(`[OneNET服务] 获取OneNET ${period}统计数据错误:`, error);
      this.statsError.value[period] = error.message || '网络错误';
      return { success: false, error: error.message };
    } finally {
      this.statsLoading.value[period] = false;
    }
  },

  // 数据源始终为OneNET，不提供切换功能
};

export default oneNetService;
