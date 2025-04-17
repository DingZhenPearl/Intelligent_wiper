// src/services/rainfallDataService.js
import { ref } from 'vue';
import { get } from './api';

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

  // 获取首页实时雨量数据
  async fetchHomeData() {
    try {
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

  // 初始化模拟数据并启动数据采集器，每5秒生成一个新数据点
  async generateMockData(days = 7) {
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

      // 确保 days 是一个数字
      const daysValue = typeof days === 'number' ? days : 7;
      console.log(`[雨量数据服务] 开始初始化模拟数据并启动数据采集器，用户名: ${username}, 天数: ${daysValue}`);

      // 发送API请求，直接在URL中传递用户名
      const response = await get(`/api/rainfall/mock?days=${daysValue}&username=${encodeURIComponent(username)}`);

      if (response.ok) {
        const data = await response.json();
        console.log('[雨量数据服务] 初始化模拟数据成功:', data);

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
      console.log('[雨量数据服务] 开始停止数据采集器...');

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
            console.log('[雨量数据服务] 停止数据采集器，当前用户名:', username);
          }
        } catch (e) {
          console.error('[雨量数据服务] 解析用户信息出错:', e);
        }
      } else {
        console.log('[雨量数据服务] localStorage中没有用户信息，使用默认用户名:', username);
      }

      console.log(`[雨量数据服务] 停止数据采集器，最终使用的用户名: ${username}`);

      // 检查当前数据采集器状态
      const currentStatus = localStorage.getItem('collectorRunning');
      console.log(`[雨量数据服务] 当前数据采集器状态: ${currentStatus}`);

      // 发送API请求，直接在URL中传递用户名
      const stopUrl = `/api/rainfall/stop?username=${encodeURIComponent(username)}`;
      console.log(`[雨量数据服务] 发送停止请求到: ${stopUrl}`);
      const response = await get(stopUrl);
      console.log(`[雨量数据服务] 停止请求响应状态:`, response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('[雨量数据服务] 停止数据采集器响应数据:', data);

        if (data.success) {
          // 更新全局数据收集状态并保存到localStorage
          this.updateCollectorStatus(false);
          console.log('[雨量数据服务] 数据采集器状态已更新为停止');

          // 再次检查localStorage中的状态
          const updatedStatus = localStorage.getItem('collectorRunning');
          console.log(`[雨量数据服务] 更新后的数据采集器状态: ${updatedStatus}`);

          return {
            success: true,
            message: data.message
          };
        } else {
          console.error('[雨量数据服务] 停止数据采集器失败:', data.error);
          return { success: false, error: data.error };
        }
      } else {
        console.error('[雨量数据服务] 停止数据采集器请求失败:', response.status, response.statusText);
        let errorData;
        try {
          errorData = await response.json();
          console.error('[雨量数据服务] 停止数据采集器错误数据:', errorData);
        } catch (jsonError) {
          console.error('[雨量数据服务] 解析错误响应失败:', jsonError);
          errorData = { error: `服务器响应错误: ${response.status} ${response.statusText}` };
        }

        // 即使请求失败，也将本地状态设置为停止
        this.updateCollectorStatus(false);
        console.log('[雨量数据服务] 尽管请求失败，但本地数据采集器状态已设置为停止');

        return { success: false, error: errorData.error };
      }
    } catch (error) {
      console.error('[雨量数据服务] 停止数据采集器错误:', error);

      // 即使出错，也将本地状态设置为停止
      this.updateCollectorStatus(false);
      console.log('[雨量数据服务] 尽管出错，但本地数据采集器状态已设置为停止');

      return { success: false, error: error.message };
    }
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

      // 获取一次数据，更新数据显示
      try {
        // 尝试从服务器获取状态信息
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
  }
};

export default rainfallDataService;
