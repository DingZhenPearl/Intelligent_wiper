// src/services/oneNetService.js
import { ref } from 'vue';
import { get, post } from './api';

// OneNET服务
const oneNetService = {
  // 是否使用OneNET数据源
  isOneNetSource: ref(localStorage.getItem('useOneNetSource') === 'true'),

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

  // 更新数据源设置并保存到localStorage
  updateDataSource(useOneNet) {
    this.isOneNetSource.value = useOneNet;
    localStorage.setItem('useOneNetSource', useOneNet ? 'true' : 'false');
    console.log(`[OneNET服务] 更新数据源为 ${useOneNet ? 'OneNET' : '本地数据库'} 并保存到localStorage`);
  },

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

          return {
            success: true,
            data: data.data
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

          return {
            success: true,
            data: data.data,
            currentHour: data.currentHour,
            unit: data.unit
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

  // 切换数据源
  async switchDataSource(useOneNet) {
    try {
      console.log(`[OneNET服务] 开始切换数据源为 ${useOneNet ? 'OneNET' : '本地数据库'}`);

      // 更新本地设置
      this.updateDataSource(useOneNet);

      // 通知后端切换数据源
      const response = await post('/api/rainfall/switch-source', {
        useOneNet: useOneNet
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[OneNET服务] 切换数据源成功:', data);

        if (data.success) {
          return {
            success: true,
            message: data.message
          };
        } else {
          return { success: false, error: data.error };
        }
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error('[OneNET服务] 切换数据源错误:', error);
      return { success: false, error: error.message };
    }
  }
};

export default oneNetService;
