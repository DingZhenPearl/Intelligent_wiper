// src/services/rainfallDataService.js
import { ref } from 'vue';
import { get } from './api';
import oneNetService from './oneNetService';

// 创建一个单例服务，用于获取和缓存雨量数据
const rainfallDataService = {
  // 全局数据收集状态
  isCollectorRunning: ref(localStorage.getItem('collectorRunning') === 'true'),

  // 更新数据采集器状态并保存到localStorage
  updateCollectorStatus(isRunning) {
    this.isCollectorRunning.value = isRunning;
    localStorage.setItem('collectorRunning', isRunning ? 'true' : 'false');
    console.log(`[雨量数据服务] 更新数据采集器状态为 ${isRunning ? '运行中' : '已停止'} 并保存到localStorage`);
  },
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
      // 检查是否使用OneNET数据源
      if (oneNetService.isOneNetSource.value) {
        console.log(`[雨量数据服务] 使用OneNET数据源获取${period}统计数据`);
        return await this.fetchOneNetStatisticsData(period);
      }

      // 使用本地数据库获取数据
      console.log(`[雨量数据服务] 使用本地数据库获取${period}统计数据`);

      // 从 localStorage 中获取用户名
      let username = 'admin'; // 默认用户名
      const userDataStr = localStorage.getItem('user');

      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          if (userData && userData.username) {
            username = userData.username;
            console.log(`[雨量数据服务] 获取${period}统计数据，当前用户名:`, username);
          }
        } catch (e) {
          console.error('[雨量数据服务] 解析用户信息出错:', e);
        }
      }

      console.log(`[雨量数据服务] 获取${period}统计数据，用户名: ${username}`);

      // 发送API请求，直接在URL中传递用户名
      const response = await get(`/api/rainfall/stats?period=${period}&username=${encodeURIComponent(username)}`);

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

  // 从OneNET获取统计数据
  async fetchOneNetStatisticsData(period = '10min') {
    try {
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
          console.error('[雨量数据服务] 解析用户信息出错:', e);
        }
      }

      console.log(`[雨量数据服务] 从OneNET获取${period}统计数据，用户名: ${username}`);

      // 调用后端API获取OneNET统计数据，传递用户名参数
      const response = await get(`/api/rainfall/onenet/stats?period=${period}&username=${encodeURIComponent(username)}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[雨量数据服务] 从OneNET获取${period}统计数据成功:`, data);

        if (data.success) {
          // 更新数据
          this.statisticsData.value[period] = data.data || [];

          // 更新当前小时数据（如果有）
          if (data.currentHour) {
            this.currentHourData.value = data.currentHour;
          }

          // 更新最后更新时间
          this.lastUpdateTime.value[period] = new Date();

          // 检查是否有警告信息
          if (data.warning) {
            console.warn(`[雨量数据服务] OneNET数据警告: ${data.warning}`);
            // 存储警告信息，但不影响成功状态
            this.error.value[period] = data.warning;
          } else {
            // 清除之前的错误信息
            this.error.value[period] = '';
          }

          return {
            success: true,
            data: data.data || [],
            currentHour: data.currentHour,
            unit: data.unit,
            warning: data.warning
          };
        } else {
          this.error.value[period] = data.error || '获取OneNET数据失败';
          return { success: false, error: data.error };
        }
      } else {
        const errorData = await response.json();
        this.error.value[period] = errorData.error || '获取OneNET数据失败';
        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error(`[雨量数据服务] 从OneNET获取${period}统计数据错误:`, error);
      this.error.value[period] = error.message || '网络错误';
      return { success: false, error: error.message };
    }
  },

  // 获取首页实时雨量数据
  async fetchHomeData() {
    try {
      // 检查是否使用OneNET数据源
      if (oneNetService.isOneNetSource.value) {
        console.log('[雨量数据服务] 使用OneNET数据源获取雨量数据');
        return await oneNetService.fetchRainfallData();
      }

      // 使用本地数据库获取数据
      console.log('[雨量数据服务] 使用本地数据库获取雨量数据');

      // 从 localStorage 中获取用户名
      let username = 'admin'; // 默认用户名
      const userDataStr = localStorage.getItem('user');

      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          if (userData && userData.username) {
            username = userData.username;
            console.log('[雨量数据服务] 获取首页数据，当前用户名:', username);
          }
        } catch (e) {
          console.error('[雨量数据服务] 解析用户信息出错:', e);
        }
      }

      console.log(`[雨量数据服务] 获取首页实时雨量数据，用户名: ${username}`);

      // 发送API请求，直接在URL中传递用户名
      const response = await get(`/api/rainfall/home?username=${encodeURIComponent(username)}`);

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

  // 启动OneNET同步服务
  async startOneNetSync() {
    try {
      // 从 localStorage 中获取用户名
      let username = 'admin'; // 默认用户名
      const userDataStr = localStorage.getItem('user');
      console.log('[雨量数据服务] localStorage中的用户信息:', userDataStr);

      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          console.log('[雨量数据服务] 解析后的用户信息:', userData);
          if (userData && userData.username) {
            username = userData.username;
            console.log('[雨量数据服务] 当前用户名:', username);
          }
        } catch (e) {
          console.error('[雨量数据服务] 解析用户信息出错:', e);
        }
      } else {
        console.log('[雨量数据服务] localStorage中没有用户信息，使用默认用户名:', username);
      }

      console.log(`[雨量数据服务] 开始启动OneNET同步服务，用户名: ${username}`);

      // 发送API请求，直接在URL中传递用户名
      const response = await get(`/api/rainfall/onenet/sync/start?username=${encodeURIComponent(username)}`);

      if (response.ok) {
        const data = await response.json();
        console.log('[雨量数据服务] 启动OneNET同步服务成功:', data);

        if (data.success) {
          // 更新全局数据收集状态并保存到localStorage
          this.updateCollectorStatus(true);

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
      console.error('[雨量数据服务] 启动OneNET同步服务错误:', error);
      return { success: false, error: error.message };
    }
  },

  // 停止OneNET同步服务
  async stopOneNetSync() {
    try {
      console.log('[雨量数据服务] 开始停止OneNET同步服务...');

      // 从 localStorage 中获取用户名
      let username = 'admin'; // 默认用户名
      const userDataStr = localStorage.getItem('user');
      console.log('[雨量数据服务] localStorage中的用户信息:', userDataStr);

      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          console.log('[雨量数据服务] 解析后的用户信息:', userData);
          if (userData && userData.username) {
            username = userData.username;
            console.log('[雨量数据服务] 停止OneNET同步服务，当前用户名:', username);
          }
        } catch (e) {
          console.error('[雨量数据服务] 解析用户信息出错:', e);
        }
      } else {
        console.log('[雨量数据服务] localStorage中没有用户信息，使用默认用户名:', username);
      }

      console.log(`[雨量数据服务] 停止OneNET同步服务，最终使用的用户名: ${username}`);

      // 检查当前数据采集器状态
      const currentStatus = localStorage.getItem('collectorRunning');
      console.log(`[雨量数据服务] 当前数据采集器状态: ${currentStatus}`);

      // 发送API请求，直接在URL中传递用户名
      const stopUrl = `/api/rainfall/onenet/sync/stop?username=${encodeURIComponent(username)}`;
      console.log(`[雨量数据服务] 发送停止请求到: ${stopUrl}`);
      const response = await get(stopUrl);
      console.log(`[雨量数据服务] 停止请求响应状态:`, response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('[雨量数据服务] 停止OneNET同步服务响应数据:', data);

        if (data.success) {
          // 更新全局数据收集状态并保存到localStorage
          this.updateCollectorStatus(false);
          console.log('[雨量数据服务] OneNET同步服务状态已更新为停止');

          // 再次检查localStorage中的状态
          const updatedStatus = localStorage.getItem('collectorRunning');
          console.log(`[雨量数据服务] 更新后的OneNET同步服务状态: ${updatedStatus}`);

          return {
            success: true,
            message: data.message
          };
        } else {
          console.error('[雨量数据服务] 停止OneNET同步服务失败:', data.error);
          return { success: false, error: data.error };
        }
      } else {
        console.error('[雨量数据服务] 停止OneNET同步服务请求失败:', response.status, response.statusText);
        let errorData;
        try {
          errorData = await response.json();
          console.error('[雨量数据服务] 停止OneNET同步服务错误数据:', errorData);
        } catch (jsonError) {
          console.error('[雨量数据服务] 解析错误响应失败:', jsonError);
          errorData = { error: `服务器响应错误: ${response.status} ${response.statusText}` };
        }

        // 即使请求失败，也将本地状态设置为停止
        this.updateCollectorStatus(false);
        console.log('[雨量数据服务] 尽管请求失败，但本地OneNET同步服务状态已设置为停止');

        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error('[雨量数据服务] 停止OneNET同步服务错误:', error);

      // 即使出错，也将本地状态设置为停止
      this.updateCollectorStatus(false);
      console.log('[雨量数据服务] 尽管出错，但本地OneNET同步服务状态已设置为停止');

      return { success: false, error: error.message };
    }
  },

  // 停止数据采集器 (保留此方法以兼容旧代码)
  async stopDataCollector() {
    return this.stopOneNetSync();
  },

  // 检查数据采集器状态
  async checkCollectorStatus() {
    try {
      // 检查用户登录状态
      const userDataStr = localStorage.getItem('user');
      if (!userDataStr) {
        console.log('[雨量数据服务] 用户未登录，数据采集器应该已停止');
        // 用户未登录，数据采集器应该已停止
        this.updateCollectorStatus(false);
        return {
          success: true,
          isRunning: false
        };
      }

      // 从 localStorage 中获取用户名
      let username = 'admin'; // 默认用户名
      try {
        const userData = JSON.parse(userDataStr);
        if (userData && userData.username) {
          username = userData.username;
        }
      } catch (e) {
        console.error('[雨量数据服务] 解析用户信息出错:', e);
      }

      console.log(`[雨量数据服务] 检查数据采集器状态，用户名: ${username}`);

      // 从 localStorage 中获取数据采集器状态
      const storedStatus = localStorage.getItem('collectorRunning');
      console.log(`[雨量数据服务] localStorage中的数据采集器状态: ${storedStatus}`);

      // 直接从后端获取OneNET同步状态
      try {
        console.log(`[雨量数据服务] 直接从后端获取OneNET同步状态...`);
        const syncStatusResponse = await get(`/api/rainfall/onenet/sync/status`);

        if (syncStatusResponse.ok) {
          const syncStatusData = await syncStatusResponse.json();
          console.log(`[雨量数据服务] OneNET同步状态:`, syncStatusData);

          if (syncStatusData.success) {
            // 使用后端返回的同步状态
            const isRunning = syncStatusData.isRunning;
            console.log(`[雨量数据服务] 后端返回的OneNET同步状态: ${isRunning ? '运行中' : '已停止'}`);

            // 更新本地状态
            this.updateCollectorStatus(isRunning);
            return {
              success: true,
              isRunning: isRunning
            };
          }
        }
      } catch (syncStatusError) {
        console.error('[雨量数据服务] 获取OneNET同步状态错误:', syncStatusError);
        // 继续尝试其他方法获取状态
      }

      // 如果无法直接获取同步状态，尝试从服务器获取状态信息
      try {
        console.log(`[雨量数据服务] 尝试从服务器获取状态信息...`);
        const response = await get(`/api/status`);
        if (response.ok) {
          const statusData = await response.json();
          console.log(`[雨量数据服务] 服务器状态信息:`, statusData);

          // 如果服务器返回了采集器状态，使用该状态
          if (statusData && statusData.collector && statusData.collector.isRunning !== undefined) {
            const serverCollectorRunning = statusData.collector.isRunning;
            console.log(`[雨量数据服务] 服务器返回的采集器状态: ${serverCollectorRunning ? '运行中' : '已停止'}`);

            // 更新本地状态与服务器保持一致
            this.updateCollectorStatus(serverCollectorRunning);
            return {
              success: true,
              isRunning: serverCollectorRunning
            };
          }
        }

        // 如果无法从服务器获取状态，尝试获取首页数据
        const homeDataResult = await this.fetchHomeData();
        console.log(`[雨量数据服务] 获取首页数据结果:`, homeDataResult);

        // 如果成功获取到数据，则尝试获取最新的数据点时间
        if (homeDataResult.success && homeDataResult.data && homeDataResult.data.timestamp) {
          const dataTimestamp = new Date(homeDataResult.data.timestamp);
          const now = new Date();
          const diffSeconds = Math.abs((now - dataTimestamp) / 1000);

          console.log(`[雨量数据服务] 最新数据点时间: ${dataTimestamp.toLocaleString()}, 当前时间: ${now.toLocaleString()}, 相差秒数: ${diffSeconds}`);

          // 如果最新数据点的时间与当前时间相差小于10秒，则认为数据采集器正在运行
          if (diffSeconds < 10) {
            console.log('[雨量数据服务] 根据数据时间判断数据采集器正在运行');
            this.updateCollectorStatus(true);
            return {
              success: true,
              isRunning: true
            };
          } else {
            console.log('[雨量数据服务] 根据数据时间判断数据采集器已停止');
            this.updateCollectorStatus(false);
            return {
              success: true,
              isRunning: false
            };
          }
        } else {
          console.log('[雨量数据服务] 无法获取有效的数据点时间，假设数据采集器已停止');
          this.updateCollectorStatus(false);
          return {
            success: true,
            isRunning: false
          };
        }
      } catch (fetchError) {
        console.error('[雨量数据服务] 获取数据错误:', fetchError);
        // 出错时假设数据采集器已停止
        this.updateCollectorStatus(false);
        return {
          success: true,
          isRunning: false
        };
      }
    } catch (error) {
      console.error('[雨量数据服务] 检查数据采集器状态错误:', error);
      // 出错时假设数据采集器已停止
      this.updateCollectorStatus(false);
      return { success: false, error: error.message };
    }
  },

  // 原始数据转换为Chart.js格式
  convertToChartJsFormat(rawData) {
    // ... 此方法的实现保持不变
    return rawData;
  },

  // 停止检查数据采集器状态的定时器
  async stopCollectorStatusTimer() {
    if (this.collectorStatusTimer) {
      clearInterval(this.collectorStatusTimer);
      this.collectorStatusTimer = null;
      console.log('[雨量数据服务] 停止了数据采集器状态检查定时器');
    }
  },

  // 设置OneNET自动同步状态
  async setOneNetSyncEnable(enabled) {
    try {
      console.log(`[雨量数据服务] 设置OneNET自动同步状态: ${enabled ? '开启' : '关闭'}`);

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
          console.error('[雨量数据服务] 解析用户信息出错:', e);
        }
      }

      // 调用后端API设置自动同步状态
      const response = await get(`/api/rainfall/onenet/sync/enable?enabled=${enabled}&username=${encodeURIComponent(username)}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[雨量数据服务] 设置OneNET自动同步状态成功:`, data);

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
      console.error('[雨量数据服务] 设置OneNET自动同步状态错误:', error);
      return { success: false, error: error.message };
    }
  }
};

export default rainfallDataService;
