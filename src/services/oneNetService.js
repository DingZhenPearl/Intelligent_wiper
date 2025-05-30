// src/services/oneNetService.js
import { ref } from 'vue';
import { get, post } from './api';

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

      // 从 localStorage 中获取用户名
      let username = 'admin'; // 默认用户名
      const userDataStr = localStorage.getItem('user');

      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          if (userData && userData.username) {
            username = userData.username;
          }
        } catch (e) {
          console.error('[OneNET服务] 解析用户信息出错:', e);
        }
      }

      console.log(`[OneNET服务] 获取OneNET雨量数据，用户名: ${username}`);

      // 调用后端API获取OneNET数据，传递用户名参数
      const response = await get(`/api/rainfall/onenet?username=${encodeURIComponent(username)}`);

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

      // 从 localStorage 中获取用户名
      let username = 'admin'; // 默认用户名
      const userDataStr = localStorage.getItem('user');

      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          if (userData && userData.username) {
            username = userData.username;
          }
        } catch (e) {
          console.error('[OneNET服务] 解析用户信息出错:', e);
        }
      }

      console.log(`[OneNET服务] 获取OneNET ${period}统计数据，用户名: ${username}`);

      // 调用后端API获取OneNET统计数据，传递用户名参数
      const response = await get(`/api/rainfall/onenet/stats?period=${period}&username=${encodeURIComponent(username)}`);

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

  // 原始数据加载状态
  rawDataLoading: ref(false),

  // 原始数据错误信息
  rawDataError: ref(null),

  // 原始数据最后更新时间
  rawDataLastUpdateTime: ref(null),

  // 直接从OneNET平台获取原始数据
  async fetchRawData(timeRange = '1h') {
    try {
      // 设置加载状态
      this.rawDataLoading.value = true;
      this.rawDataError.value = null;

      console.log(`[OneNET服务] 开始直接从OneNET平台获取原始数据，时间范围: ${timeRange}`);

      // 从 localStorage 中获取用户名
      let username = 'admin'; // 默认用户名
      const userDataStr = localStorage.getItem('user');

      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          if (userData && userData.username) {
            username = userData.username;
          }
        } catch (e) {
          console.error('[OneNET服务] 解析用户信息出错:', e);
        }
      }

      // 调用后端API获取OneNET原始数据
      const response = await get(`/api/rainfall/onenet/raw?username=${encodeURIComponent(username)}&timeRange=${timeRange}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[OneNET服务] 获取OneNET原始数据成功:`, data);

        if (data.success) {
          // 更新最后更新时间
          this.rawDataLastUpdateTime.value = new Date();

          // 处理数据点，转换为ECharts格式
          const chartData = (data.datapoints || []).map(point => {
            return {
              value: [
                point.timestamp, // 时间戳
                point.value      // 雨量值
              ]
            };
          });

          // 按时间排序
          chartData.sort((a, b) => {
            return new Date(a.value[0]) - new Date(b.value[0]);
          });

          return {
            success: true,
            data: chartData,
            message: data.message
          };
        } else {
          this.rawDataError.value = data.error || '获取OneNET原始数据失败';
          return { success: false, error: data.error };
        }
      } else {
        const errorData = await response.json();
        this.rawDataError.value = errorData.error || '获取OneNET原始数据失败';
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error(`[OneNET服务] 获取OneNET原始数据错误:`, error);
      this.rawDataError.value = error.message || '网络错误';
      return { success: false, error: error.message };
    } finally {
      this.rawDataLoading.value = false;
    }
  },

  // 为用户创建OneNET数据流
  async createDatastreamForUser(username) {
    try {
      console.log(`[OneNET服务] 为用户 ${username} 创建OneNET数据流`);

      const response = await post('/api/rainfall/onenet/datastream/create', {
        username: username
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[OneNET服务] 创建OneNET数据流成功:', data);
        return data;
      } else {
        const errorData = await response.json();
        console.error('[OneNET服务] 创建OneNET数据流失败:', errorData);
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error('[OneNET服务] 创建OneNET数据流错误:', error);
      return { success: false, error: error.message };
    }
  }
};

export default oneNetService;
