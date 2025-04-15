// src/services/rainfallDataService.js
import { ref } from 'vue';
import { get } from './api';

// 创建一个单例服务，用于获取和缓存雨量数据
const rainfallDataService = {
  // 统计数据
  statisticsData: ref({
    '10min': [],
    'hourly': [],
    'daily': [],
    'all': []
  }),

  // 当前小时数据
  currentHourData: ref(null),

  // 最后更新时间
  lastUpdateTime: ref({
    '10min': null,
    'hourly': null,
    'daily': null,
    'all': null
  }),

  // 是否正在加载
  loading: ref({
    '10min': false,
    'hourly': false,
    'daily': false,
    'all': false
  }),

  // 错误信息
  error: ref({
    '10min': null,
    'hourly': null,
    'daily': null,
    'all': null
  }),

  // 获取统计数据
  async fetchStatisticsData(period = '10min') {
    // 设置加载状态
    this.loading.value[period] = true;
    this.error.value[period] = null;

    try {
      console.log(`[雨量数据服务] 获取${period}统计数据`);

      // 发送API请求
      const response = await get(`/api/rainfall/stats?period=${period}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[雨量数据服务] 获取${period}统计数据成功:`, data);

        if (data.success) {
          // 更新数据
          this.statisticsData.value[period] = data.data || [];

          // 更新当前小时数据（如果有）
          if (data.currentHour) {
            this.currentHourData.value = data.currentHour;
          }

          // 更新最后更新时间
          this.lastUpdateTime.value[period] = new Date();

          return {
            success: true,
            data: data.data,
            currentHour: data.currentHour,
            unit: data.unit
          };
        } else {
          this.error.value[period] = data.error || '获取数据失败';
          return { success: false, error: data.error };
        }
      } else {
        const errorData = await response.json();
        this.error.value[period] = errorData.error || '获取数据失败';
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error(`[雨量数据服务] 获取${period}统计数据错误:`, error);
      this.error.value[period] = error.message || '网络错误';
      return { success: false, error: error.message };
    } finally {
      this.loading.value[period] = false;
    }
  },

  // 获取首页实时雨量数据
  async fetchHomeData() {
    try {
      console.log('[雨量数据服务] 获取首页实时雨量数据');

      // 发送API请求
      const response = await get('/api/rainfall/home');

      if (response.ok) {
        const data = await response.json();
        console.log('[雨量数据服务] 获取首页实时雨量数据成功:', data);

        if (data.success) {
          // 更新共享服务中的雨量数据
          const rainfallData = data.data;

          // 返回数据
          return {
            success: true,
            data: rainfallData
          };
        } else {
          return { success: false, error: data.error };
        }
      } else {
        const errorData = await response.json();

        // 不再处理401错误

        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error('[雨量数据服务] 获取首页实时雨量数据错误:', error);
      return { success: false, error: error.message };
    }
  },

  // 启动定时更新
  startPolling(period = '10min', interval = 5000) {
    console.log(`[雨量数据服务] 启动${period}数据定时更新，间隔: ${interval}ms`);

    // 立即获取一次数据
    this.fetchStatisticsData(period);

    // 设置定时器
    const timerId = setInterval(() => {
      this.fetchStatisticsData(period);
    }, interval);

    // 返回定时器ID，以便于停止
    return timerId;
  },

  // 初始化模拟数据并启动数据采集器，每5秒生成一个新数据点
  async generateMockData(days = 7) {
    try {
      // 确保 days 是一个数字
      const daysValue = typeof days === 'number' ? days : 7;
      console.log(`[雨量数据服务] 开始初始化模拟数据并启动数据采集器，天数: ${daysValue}`);

      // 发送API请求
      const response = await get(`/api/rainfall/mock?days=${daysValue}`);

      if (response.ok) {
        const data = await response.json();
        console.log('[雨量数据服务] 初始化模拟数据成功:', data);

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

        // 不再处理401错误

        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error('[雨量数据服务] 初始化模拟数据错误:', error);
      return { success: false, error: error.message };
    }
  },

  // 停止数据采集器
  async stopDataCollector() {
    try {
      console.log('[雨量数据服务] 停止数据采集器');

      // 发送API请求
      const response = await get('/api/rainfall/stop');

      if (response.ok) {
        const data = await response.json();
        console.log('[雨量数据服务] 停止数据采集器成功:', data);

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

        // 不再处理401错误

        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error('[雨量数据服务] 停止数据采集器错误:', error);
      return { success: false, error: error.message };
    }
  }
};

export default rainfallDataService;
