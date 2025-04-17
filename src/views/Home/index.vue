<template>
  <div class="control-panel">
    <h1>主控制界面</h1>

    <div class="responsive-layout">
      <!-- 雨量百分比图 -->
      <div class="rainfall-chart">
        <div class="pie-chart">
          <div class="pie" :style="{ background: `conic-gradient(${getRainfallColor(rainfall)} ${rainfall}%, #e8f0fe ${rainfall}% 100%)` }"></div>
          <div class="percentage">{{ rainfall }}%</div>
          <div class="rainfall-level">{{ getRainfallLevelText(rainfall) }}</div>
        </div>
        <div class="label">实时雨量</div>
        <div class="data-status" v-if="!mockDataMessage && !isMockDataLoading">
          {{ backendMessage || '点击下方按钮开始收集数据' }}
        </div>

        <!-- 数据收集控制按钮 -->
        <div class="data-control-buttons">
          <button
            v-if="!isDataPollingActive"
            class="mock-data-btn start"
            @click="() => generateMockData(7)"
            :disabled="isMockDataLoading"
          >
            <span class="icon material-icons">play_arrow</span>
            {{ isMockDataLoading ? '正在初始化...' : '开始收集数据' }}
          </button>
          <button
            v-else
            class="mock-data-btn stop"
            @click="stopServiceDataCheck"
          >
            <span class="icon material-icons">stop</span>
            停止收集数据
          </button>
        </div>
        <div v-if="mockDataMessage" class="mock-data-message" :class="{ success: mockDataSuccess, error: !mockDataSuccess }">
          {{ mockDataMessage }}
        </div>
      </div>

      <!-- 工作状态列表 -->
      <div class="work-status">
        <h2>当前雨刷工作状态</h2>
        <ul class="status-list">
          <li :class="{ active: currentStatus === 'off' }" @click="changeStatus('off')">关闭</li>
          <li :class="{ active: currentStatus === 'interval' }" @click="changeStatus('interval')">间歇</li>
          <li :class="{ active: currentStatus === 'low' }" @click="changeStatus('low')">低速</li>
          <li :class="{ active: currentStatus === 'high' }" @click="changeStatus('high')">高速</li>
          <li :class="{ active: currentStatus === 'smart' }" @click="changeStatus('smart')">智能</li>
        </ul>

        <!-- 控制按钮 -->
        <button class="control-btn" @click="toggleWiper">
        <!-- 将 ⏻ 替换为更通用的图标 -->
        <span class="icon material-icons">power_settings_new</span>
          {{ currentStatus === 'off' ? '开启雨刷' : '立即关闭' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import rainfallService from '@/services/rainfallService'
import rainfallDataService from '@/services/rainfallDataService'

export default {
  name: 'ControlPanel',
  setup() {
    // 使用响应式引用存储雨量数据
    const rainfall = ref(0) // 实时雨量百分比
    const rainfallLevel = ref({ level: 'none', text: '无降雨' }) // 雨量级别
    const currentStatus = ref('low') // 当前工作状态
    const backendMessage = ref('') // 来自后端的消息

    // 模拟数据相关状态
    const isMockDataLoading = ref(false) // 是否正在生成模拟数据
    const mockDataMessage = ref('') // 模拟数据生成结果消息
    const mockDataSuccess = ref(true) // 模拟数据生成是否成功

    // 监听共享服务中的雨量数据变化
    watch(() => rainfallService.rainfallPercentage.value, (newPercentage) => {
      rainfall.value = newPercentage;
      const now = new Date();
      console.log(`[Home] 更新雨量百分比: ${newPercentage}% (时间: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()})`);
    }, { immediate: true }); // 立即触发一次

    // 监听共享服务中的雨量级别变化
    watch(() => rainfallService.rainfallLevel.value, (newLevel) => {
      rainfallLevel.value = newLevel;
      const now = new Date();
      console.log(`[Home] 更新雨量级别: ${newLevel.text} (时间: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()})`);
    }, { immediate: true }); // 立即触发一次

    // 定时从后端获取雨量数据
    const dataPollingInterval = ref(null); // 存储定时器ID
    const isDataPollingActive = ref(false); // 数据轮询是否活跃

    // 启动数据轮询
    const startServiceDataCheck = () => {
      console.log('[Home] 开始定时从后端获取雨量数据');

      // 先清除现有定时器，确保不会有多个定时器同时运行
      if (dataPollingInterval.value) {
        console.log('[Home] 清除现有定时器');
        clearInterval(dataPollingInterval.value);
        dataPollingInterval.value = null;
      }

      // 立即获取一次数据
      fetchRainfallFromBackend();

      // 每5秒获取一次数据
      console.log('[Home] 设置新的定时器，每5秒获取一次数据');
      dataPollingInterval.value = setInterval(() => {
        console.log('[Home] 定时器触发，获取最新数据');
        fetchRainfallFromBackend();
      }, 5000);

      // 更新本地和全局轮询状态
      isDataPollingActive.value = true;
      localStorage.setItem('homePagePollingActive', 'true'); // 将轮询状态保存到localStorage
      console.log('[Home] 本地轮询状态已设置为活动并保存到localStorage');
    };

    // 停止数据轮询和数据采集器
    const stopServiceDataCheck = async () => {
      console.log('[Home] 开始停止数据采集器和轮询...');

      // 显示正在停止的消息
      backendMessage.value = '正在停止数据采集器...';
      mockDataMessage.value = '正在停止数据采集器...';
      mockDataSuccess.value = true;

      // 停止前端数据轮询
      if (dataPollingInterval.value) {
        console.log('[Home] 停止前端数据轮询');
        clearInterval(dataPollingInterval.value);
        dataPollingInterval.value = null;
        console.log('[Home] 前端数据轮询已停止');
      } else {
        console.log('[Home] 没有正在运行的前端数据轮询');
      }

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
            console.error('[Home] 解析用户信息出错:', e);
          }
        }
        console.log(`[Home] 停止数据采集器，用户名: ${username}`);

        // 调用后端 API 停止数据采集器
        console.log('[Home] 调用后端 API 停止数据采集器');
        const result = await rainfallDataService.stopDataCollector();
        console.log('[Home] 停止数据采集器API返回结果:', result);

        if (result.success) {
          // 设置数据采集器状态为非活动
          isDataPollingActive.value = false;
          localStorage.setItem('homePagePollingActive', 'false'); // 将轮询状态保存到localStorage
          console.log('[Home] 本地轮询状态已设置为非活动并保存到localStorage');

          // 设置提示消息
          backendMessage.value = '数据采集已停止，点击按钮开始收集数据';
          mockDataMessage.value = '数据采集器已停止';
          console.log(`[Home] 停止数据采集器成功: ${result.message}`);

          // 获取最新状态
          fetchRainfallFromBackend();

          // 5秒后清除消息
          setTimeout(() => {
            mockDataMessage.value = '';
          }, 5000);
        } else {
          console.error(`[Home] 停止数据采集器失败: ${result.error}`);
          backendMessage.value = `停止数据采集器失败: ${result.error || '未知错误'}`;
          mockDataMessage.value = `停止数据采集器失败: ${result.error || '未知错误'}`;
          mockDataSuccess.value = false;

          // 5秒后清除错误消息
          setTimeout(() => {
            mockDataMessage.value = '';
          }, 5000);
        }
      } catch (error) {
        console.error('[Home] 停止数据采集器错误:', error);
        backendMessage.value = `停止数据采集器错误: ${error.message || '未知错误'}`;
        mockDataMessage.value = `停止数据采集器错误: ${error.message || '未知错误'}`;
        mockDataSuccess.value = false;

        // 5秒后清除错误消息
        setTimeout(() => {
          mockDataMessage.value = '';
        }, 5000);
      }
    };



    // 从后端获取雨量数据
    const fetchRainfallFromBackend = async () => {
      try {
        console.log('[Home] 开始从后端获取雨量数据');

        // 从后端获取数据
        const result = await rainfallDataService.fetchHomeData();

        if (result.success) {
          const data = result.data;
          const now = new Date();

          // 更新共享服务中的雨量数据
          rainfallService.updateRainfallData(
            data.rainfall_value,
            { level: data.rainfall_level, text: getRainfallLevelText(data.rainfall_percentage) },
            data.rainfall_percentage
          );

          // 如果有消息，显示它
          if (result.message) {
            backendMessage.value = result.message;
          } else {
            backendMessage.value = '';
          }

          console.log(`[Home] 从后端获取雨量数据成功: ${data.rainfall_value} mm/h (${data.rainfall_level}, ${data.rainfall_percentage}%) (时间: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()})`);
        } else {
          console.error('[Home] 从后端获取雨量数据失败:', result.error);
          backendMessage.value = result.error || '获取数据失败';

          // 不再处理未登录错误
        }
      } catch (error) {
        console.error('[Home] 从后端获取雨量数据错误:', error);
        backendMessage.value = `获取数据错误: ${error.message || '未知错误'}`;
      }
    };



    // 智能模式是一个固定的模式，实际的自动调节逻辑在硬件端实现

    const changeStatus = (status, logChange = true) => {
      currentStatus.value = status
      // 这里可以添加与后端通信的逻辑
      if (logChange) {
        console.log(`雨刷状态切换为: ${status}`)
      }
    }

    const toggleWiper = () => {
      if (currentStatus.value === 'off') {
        // 如果当前是关闭状态，则切换到智能模式
        changeStatus('smart')
      } else {
        // 如果当前是其他状态，则切换到关闭状态
        changeStatus('off')
      }
    }

    // 根据雨量百分比获取颜色
    const getRainfallColor = (percentage) => {
      if (percentage === 0) {
        // 无降雨
        return '#cccccc';
      } else if (percentage > 0 && percentage <= 25) {
        // 小雨
        return '#4285f4';
      } else if (percentage > 25 && percentage <= 50) {
        // 中雨
        return '#fbbc05';
      } else {
        // 大雨
        return '#ea4335';
      }
    };

    // 根据雨量百分比获取级别文本
    const getRainfallLevelText = (percentage) => {
      if (percentage === 0) {
        return '无降雨';
      } else if (percentage > 0 && percentage <= 25) {
        return '小雨';
      } else if (percentage > 25 && percentage <= 50) {
        return '中雨';
      } else {
        return '大雨';
      }
    };

    // 初始化模拟数据并开始实时收集
    const generateMockData = async (days = 7) => {
      try {
        // 设置加载状态
        isMockDataLoading.value = true;
        mockDataMessage.value = '';

        // 显示localstorage中的用户信息
        const userDataStr = localStorage.getItem('user');
        console.log('[首页] localStorage中的用户信息:', userDataStr);
        if (userDataStr) {
          try {
            const userData = JSON.parse(userDataStr);
            console.log('[首页] 解析后的用户信息:', userData);
            console.log('[首页] 当前用户名:', userData.username);
          } catch (e) {
            console.error('[首页] 解析用户信息出错:', e);
          }
        } else {
          console.log('[首页] localStorage中没有用户信息');
        }

        // 确保 days 是一个数字
        const daysValue = typeof days === 'number' ? days : 7;

        console.log(`[首页] 开始初始化模拟数据并启动数据采集器，天数: ${daysValue}`);

        // 调用服务初始化模拟数据
        const result = await rainfallDataService.generateMockData(daysValue);

        if (result.success) {
          mockDataSuccess.value = true;
          mockDataMessage.value = `数据采集器已启动，每5秒生成一个新数据点`;
          console.log(`[首页] 模拟数据初始化成功: ${result.message}`);

          // 立即获取最新数据并启动数据轮询
          fetchRainfallFromBackend();
          startServiceDataCheck();

          // 10秒后清除消息
          setTimeout(() => {
            mockDataMessage.value = '';
          }, 10000);
        } else {
          mockDataSuccess.value = false;
          mockDataMessage.value = `初始化模拟数据失败: ${result.error || '未知错误'}`;
          console.error(`[首页] 初始化模拟数据失败:`, result.error);

          // 5秒后清除错误消息
          setTimeout(() => {
            mockDataMessage.value = '';
          }, 5000);
        }
      } catch (error) {
        mockDataSuccess.value = false;
        mockDataMessage.value = `初始化模拟数据错误: ${error.message || '未知错误'}`;
        console.error(`[首页] 初始化模拟数据错误:`, error);

        // 5秒后清除错误消息
        setTimeout(() => {
          mockDataMessage.value = '';
        }, 5000);
      } finally {
        // 重置加载状态
        isMockDataLoading.value = false;
      }
    };

    // 生命周期钩子
    onMounted(async () => {
      console.log('首页组件已挂载');

      // 不再检查登录状态

      // 检查localStorage中的轮询状态
      const homePagePollingActive = localStorage.getItem('homePagePollingActive');
      console.log(`[首页] localStorage中的轮询状态: ${homePagePollingActive}`);

      // 检查localStorage中的数据采集器状态
      const collectorRunning = localStorage.getItem('collectorRunning');
      console.log(`[首页] localStorage中的数据采集器状态: ${collectorRunning}`);

      // 检查数据采集器状态
      try {
        console.log('[首页] 开始检查数据采集器状态...');
        const statusResult = await rainfallDataService.checkCollectorStatus();
        console.log('[首页] 检查数据采集器状态结果:', statusResult);

        if (statusResult.success) {
          // 更新数据采集器状态
          isDataPollingActive.value = statusResult.isRunning;
          console.log(`[首页] 检查到数据采集器状态: ${isDataPollingActive.value ? '运行中' : '已停止'}`);

          // 如果数据采集器正在运行，或者localStorage中的轮询状态为活动，启动数据轮询
          if (isDataPollingActive.value || homePagePollingActive === 'true') {
            console.log('[首页] 数据采集器正在运行或者之前的轮询状态为活动，启动数据轮询');
            // 强制启动数据轮询，不考虑当前状态
            startServiceDataCheck();
            backendMessage.value = '数据采集器正在运行中';
          } else {
            console.log('[首页] 数据采集器未运行且之前的轮询状态为非活动，只获取一次数据');
            // 只获取一次数据，不启动轮询
            fetchRainfallFromBackend();
            backendMessage.value = '点击按钮开始收集数据';
          }
        } else {
          console.error(`[首页] 检查数据采集器状态失败: ${statusResult.error}`);

          // 即使检查失败，也根据localStorage中的状态决定是否启动轮询
          if (homePagePollingActive === 'true' || collectorRunning === 'true') {
            console.log('[首页] 检查失败但localStorage中的状态为活动，启动数据轮询');
            startServiceDataCheck();
            backendMessage.value = '数据采集器可能正在运行，已启动数据更新';
          } else {
            // 只获取一次数据，不启动轮询
            fetchRainfallFromBackend();
            backendMessage.value = '点击按钮开始收集数据';
          }
        }
      } catch (error) {
        console.error(`[首页] 检查数据采集器状态错误: ${error}`);

        // 即使出错，也根据localStorage中的状态决定是否启动轮询
        if (homePagePollingActive === 'true' || collectorRunning === 'true') {
          console.log('[首页] 检查出错但localStorage中的状态为活动，启动数据轮询');
          startServiceDataCheck();
          backendMessage.value = '数据采集器可能正在运行，已启动数据更新';
        } else {
          // 只获取一次数据，不启动轮询
          fetchRainfallFromBackend();
          backendMessage.value = '点击按钮开始收集数据';
        }
      }
    });

    onUnmounted(() => {
      console.log("首页组件已卸载");

      // 清理定时器，但保留轮询状态
      if (dataPollingInterval.value) {
        console.log('首页卸载，清理定时器，但保留轮询状态');
        clearInterval(dataPollingInterval.value);
        dataPollingInterval.value = null;

        // 只重置本地定时器状态，不重置轮询状态
        // isDataPollingActive.value = false; // 不重置轮询状态

        // 记录当前时间
        const now = new Date();
        console.log(`首页卸载时间: ${now.toLocaleString()}, 轮询状态: ${isDataPollingActive.value ? '活动' : '非活动'}, localStorage中的状态: ${localStorage.getItem('homePagePollingActive')}`);
      }
    });

    return {
      rainfall,
      rainfallLevel,
      currentStatus,
      changeStatus,
      toggleWiper,
      getRainfallColor,
      getRainfallLevelText,
      // 模拟数据相关
      isMockDataLoading,
      mockDataMessage,
      mockDataSuccess,
      generateMockData,
      backendMessage,
      // 数据轮询相关
      isDataPollingActive,
      startServiceDataCheck,
      stopServiceDataCheck
    }
  }
}
</script>

<style lang="scss" scoped>
.control-panel {
  padding: var(--spacing-lg) var(--spacing-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  height: 100%;
  overflow-y: auto;

  h1 {
    margin-bottom: var(--spacing-lg);
    color: #333;
    font-size: var(--font-size-xxl);
  }

  .responsive-layout {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-lg);
  }

  .rainfall-chart {
    text-align: center;
    width: 100%;

    .pie-chart {
      position: relative;
      width: min(70vw, 60vh);
      height: min(70vw, 60vh);
      max-width: 350px; /* 限制最大尺寸 */
      max-height: 350px;
      margin: 0 auto var(--spacing-lg);

      .pie {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        transform: rotate(-90deg);
      }

      .percentage {
        position: absolute;
        top: 40%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: calc(var(--font-size-xxl) * 1.25);
        font-weight: bold;
        color: var(--primary-color);
      }

      .rainfall-level {
        position: absolute;
        top: 60%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: var(--font-size-lg);
        font-weight: bold;
        color: #555;
        background-color: rgba(255, 255, 255, 0.7);
        padding: 2px 8px;
        border-radius: 10px;
      }
    }

    .label {
      font-size: var(--font-size-xl);
      color: #666;
      margin-bottom: var(--spacing-xs);
    }

    .data-status {
      font-size: var(--font-size-sm);
      color: #888;
      margin-bottom: var(--spacing-md);
      font-style: italic;
    }

    .data-control-buttons {
      display: flex;
      justify-content: center;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-sm);
    }

    .mock-data-btn {
      background-color: #4285f4;
      color: white;
      border: none;
      border-radius: var(--border-radius-md);
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: var(--font-size-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      transition: background-color 0.3s ease;

      &.start {
        background-color: #4285f4;

        &:hover:not(:disabled) {
          background-color: #3367d6;
        }
      }

      &.stop {
        background-color: #ea4335;

        &:hover:not(:disabled) {
          background-color: #d33426;
        }
      }

      &:disabled {
        background-color: #a0a0a0;
        cursor: not-allowed;
      }

      .icon {
        font-size: calc(var(--font-size-sm) * 1.2);
      }
    }

    .mock-data-message {
      margin-top: var(--spacing-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--border-radius-sm);
      font-size: var(--font-size-sm);
      text-align: center;

      &.success {
        background-color: rgba(76, 175, 80, 0.1);
        color: #4caf50;
        border: 1px solid rgba(76, 175, 80, 0.3);
      }

      &.error {
        background-color: rgba(244, 67, 54, 0.1);
        color: #f44336;
        border: 1px solid rgba(244, 67, 54, 0.3);
      }
    }
  }

  .work-status {
    width: 100%;
    max-width: 90%;

    h2 {
      margin-bottom: var(--spacing-md);
      color: #333;
      font-size: var(--font-size-xl);
    }

    .status-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);

      li {
        flex: 1 0 calc(50% - var(--spacing-xs));
        padding: var(--spacing-md) var(--spacing-lg);
        margin-bottom: 0;
        border-radius: var(--border-radius-md);
        font-size: var(--font-size-md);
        background-color: #f5f5f5;
        color: #666;
        cursor: pointer;
        transition: all 0.3s ease;
        text-align: center;

        &.active {
          background-color: var(--primary-color);
          color: white;
        }

        &:hover:not(.active) {
          background-color: #e0e0e0;
        }
      }
    }
  }

  .control-btn {
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-md) var(--spacing-xl);
    font-size: var(--font-size-lg);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    transition: background-color 0.3s ease;
    margin-top: var(--spacing-md);
    width: 100%;
    max-width: 400px;
    justify-content: center;

    &:hover {
      background-color: #3367d6;
    }

    .icon {
      font-size: calc(var(--font-size-lg) * 1.2);
    }
  }

  /* 添加额外的响应式样式 */
  @media screen and (max-width: 360px) {
    .rainfall-chart {
      .pie-chart {
        width: min(80vw, 50vh);
        height: min(80vw, 50vh);
        max-width: 200px; /* 较小屏幕限制尺寸 */
        max-height: 200px;

        .percentage {
          font-size: calc(var(--font-size-xl) * 1.5);
        }
      }

      .label {
        font-size: var(--font-size-lg);
      }
    }

    .work-status {
      .status-list li {
        flex: 1 0 100%;
        padding: var(--spacing-sm) var(--spacing-md);
      }
    }
  }

  /* 手机横屏模式特别优化 - 新增 */
  @media screen and (orientation: landscape) and (max-width: 900px) {
    padding: var(--spacing-md) var(--spacing-sm);

    h1 {
      font-size: var(--font-size-xl);
      margin-bottom: var(--spacing-md);
    }

    .responsive-layout {
      flex-direction: row;
      align-items: flex-start;
      gap: var(--spacing-md);
    }

    .rainfall-chart {
      flex: 0 0 40%;

      .pie-chart {
        width: 25vh;
        height: 25vh;
        min-width: 100px;
        min-height: 100px;
        max-width: 150px;
        max-height: 150px;
      }

      .label {
        font-size: var(--font-size-md);
      }
    }

    .work-status {
      flex: 0 0 55%;

      h2 {
        font-size: var(--font-size-lg);
        margin-bottom: var(--spacing-sm);
      }

      .status-list {
        gap: var(--spacing-xs);

        li {
          padding: var(--spacing-sm) var(--spacing-xs);
          font-size: var(--font-size-sm);
        }
      }

      .control-btn {
        padding: var(--spacing-sm) var(--spacing-md);
        font-size: var(--font-size-md);
        margin-top: var(--spacing-sm);
      }
    }
  }

  @media screen and (min-width: 768px) and (max-width: 1023px) {
    padding: var(--spacing-md);
    gap: var(--spacing-md);

    .work-status .status-list {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--spacing-xs);

      li {
        padding: var(--spacing-sm) var(--spacing-xs);
      }
    }

    .rainfall-chart {
      .pie-chart {
        width: min(40vw, 300px);
        height: min(40vw, 300px);
      }
    }
  }

  /* 桌面端布局优化 - 调整 */
  @media screen and (min-width: 1024px) {
    padding: var(--spacing-xl);

    .responsive-layout {
      flex-direction: row;
      justify-content: space-between;
      align-items: stretch;
      gap: var(--spacing-xl);
      max-width: 90%;
      margin: 0 auto;
    }

    .rainfall-chart {
      flex: 1;
      max-width: 40%;
      padding: var(--spacing-lg);
      background-color: white;
      border-radius: var(--border-radius-lg);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      justify-content: center;

      .pie-chart {
        width: min(30vw, 300px);
        height: min(30vw, 300px);
        max-width: 300px;
        max-height: 300px;
        margin: 0 auto var(--spacing-lg);
      }
    }

    .work-status {
      flex: 1;
      max-width: 55%;
      padding: var(--spacing-lg);
      background-color: white;
      border-radius: var(--border-radius-lg);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);

      h2 {
        margin-top: 0;
      }

      .status-list {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--spacing-md);

        li {
          padding: var(--spacing-md);
          font-size: var(--font-size-lg);
        }
      }

      .control-btn {
        margin-top: var(--spacing-lg);
        max-width: none;
        padding: var(--spacing-md) var(--spacing-xl);
      }
    }
  }

  /* 大屏幕优化 - 调整 */
  @media screen and (min-width: 1400px) {
    .responsive-layout {
      max-width: 80%;
    }

    .rainfall-chart {
      .pie-chart {
        width: min(25vw, 350px);
        height: min(25vw, 350px);
        max-width: 350px;
        max-height: 350px;
      }
    }

    .work-status {
      .status-list {
        grid-template-columns: repeat(5, 1fr);
      }
    }
  }

  /* 超大屏幕优化 - 新增 */
  @media screen and (min-width: 1800px) {
    .responsive-layout {
      max-width: 1600px;
    }
  }
}
</style>