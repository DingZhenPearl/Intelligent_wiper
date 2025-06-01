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
          {{ backendMessage || 'OneNET数据同步服务状态' }}
        </div>

        <!-- 使用OneNET平台作为数据源 -->

        <!-- 数据同步消息显示 -->
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

        <!-- 语音控制按钮 -->
        <button class="voice-control-btn" @click="toggleVoiceControl" :class="{ 'listening': isVoiceListening }">
          <span class="icon material-icons">{{ isVoiceListening ? 'mic' : 'mic_none' }}</span>
          {{ isVoiceListening ? '正在聆听...' : '语音控制' }}
        </button>

        <!-- 语音识别结果提示 -->
        <div v-if="voiceResult" class="voice-result" :class="{ 'success': voiceSuccess, 'error': !voiceSuccess }">
          <span class="icon material-icons">{{ voiceSuccess ? 'check_circle' : 'error' }}</span>
          <span>{{ voiceResult }}</span>
        </div>

        <!-- 雨刷控制消息 -->
        <div v-if="wiperControlMessage" class="wiper-control-message" :class="{ 'success': wiperControlSuccess, 'error': !wiperControlSuccess }">
          <span class="icon material-icons">{{ wiperControlSuccess ? 'check_circle' : 'error' }}</span>
          <span>{{ wiperControlMessage }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import rainfallService from '@/services/rainfallService'
import rainfallDataService from '@/services/rainfallDataService'
import voiceService from '@/services/voiceService'
import wiperService from '@/services/wiperService'
import oneNetService from '@/services/oneNetService'

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

    // 数据源始终为OneNET平台
    const isOneNetSource = ref(true) // 始终使用OneNET数据源

    // OneNET同步相关变量和函数已移除

    // 语音控制相关状态
    const isVoiceListening = ref(false) // 是否正在监听语音
    const voiceResult = ref('') // 语音识别结果
    const voiceSuccess = ref(true) // 语音识别是否成功

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

    // 数据源始终为OneNET平台
    console.log('[Home] 使用OneNET平台作为数据源');

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

    // 停止数据轮询和OneNET同步服务
    const stopOneNetSync = async () => {
      console.log('[Home] 开始停止OneNET同步服务和轮询...');

      // 显示正在停止的消息
      backendMessage.value = '正在停止OneNET同步服务...';
      mockDataMessage.value = '正在停止OneNET同步服务...';
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
        console.log(`[Home] 停止OneNET同步服务，用户名: ${username}`);

        // 调用后端 API 停止OneNET同步服务
        console.log('[Home] 调用后端 API 停止OneNET同步服务');
        const result = await rainfallDataService.stopOneNetSync();
        console.log('[Home] 停止OneNET同步服务API返回结果:', result);

        if (result.success) {
          // 设置数据采集器状态为非活动
          isDataPollingActive.value = false;
          localStorage.setItem('homePagePollingActive', 'false'); // 将轮询状态保存到localStorage
          console.log('[Home] 本地轮询状态已设置为非活动并保存到localStorage');

          // 设置提示消息
          backendMessage.value = 'OneNET同步已停止，点击按钮开始同步数据';
          mockDataMessage.value = 'OneNET同步服务已停止';
          console.log(`[Home] 停止OneNET同步服务成功: ${result.message}`);

          // 获取最新状态
          fetchRainfallFromBackend();

          // 5秒后清除消息
          setTimeout(() => {
            mockDataMessage.value = '';
          }, 5000);
        } else {
          console.error(`[Home] 停止OneNET同步服务失败: ${result.error}`);
          backendMessage.value = `停止OneNET同步服务失败: ${result.error || '未知错误'}`;
          mockDataMessage.value = `停止OneNET同步服务失败: ${result.error || '未知错误'}`;
          mockDataSuccess.value = false;

          // 5秒后清除错误消息
          setTimeout(() => {
            mockDataMessage.value = '';
          }, 5000);
        }
      } catch (error) {
        console.error('[Home] 停止OneNET同步服务错误:', error);
        backendMessage.value = `停止OneNET同步服务错误: ${error.message || '未知错误'}`;
        mockDataMessage.value = `停止OneNET同步服务错误: ${error.message || '未知错误'}`;
        mockDataSuccess.value = false;

        // 5秒后清除错误消息
        setTimeout(() => {
          mockDataMessage.value = '';
        }, 5000);
      }
    };

    // 保留此方法以兼容旧代码
    const stopServiceDataCheck = stopOneNetSync;



    // 从后端获取雨量数据
    const fetchRainfallFromBackend = async () => {
      try {
        console.log('[Home] 开始从后端获取雨量数据');

        // 直接从OneNET服务获取数据
        const result = await oneNetService.fetchRainfallData();

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

          console.log(`[Home] 从OneNET获取雨量数据成功: ${data.rainfall_value} mm/h (${data.rainfall_level}, ${data.rainfall_percentage}%) (时间: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()})`);
        } else {
          // 如果从OneNET获取失败，尝试从后端获取
          console.log('[Home] 从OneNET获取数据失败，尝试从后端获取');
          const backendResult = await rainfallDataService.fetchHomeData();

          if (backendResult.success) {
            const data = backendResult.data;
            const now = new Date();

            // 更新共享服务中的雨量数据
            rainfallService.updateRainfallData(
              data.rainfall_value,
              { level: data.rainfall_level, text: getRainfallLevelText(data.rainfall_percentage) },
              data.rainfall_percentage
            );

            // 如果有消息，显示它
            if (backendResult.message) {
              backendMessage.value = backendResult.message;
            } else {
              backendMessage.value = '';
            }

            console.log(`[Home] 从后端获取雨量数据成功: ${data.rainfall_value} mm/h (${data.rainfall_level}, ${data.rainfall_percentage}%) (时间: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()})`);
          } else {
            console.error('[Home] 从后端获取雨量数据也失败:', backendResult.error);
            backendMessage.value = backendResult.error || '获取数据失败';
          }
        }
      } catch (error) {
        console.error('[Home] 从后端获取雨量数据错误:', error);
        backendMessage.value = `获取数据错误: ${error.message || '未知错误'}`;
      }
    };



    // 智能模式是一个固定的模式，实际的自动调节逻辑在硬件端实现

    // 数据源始终为OneNET平台

    // 雨刷控制消息
    const wiperControlMessage = ref('');
    const wiperControlSuccess = ref(true);

    // 雨刷控制状态
    const isWiperControlLoading = ref(false);

    // 显示雨刷控制结果消息
    const showWiperControlMessage = (message, success = true) => {
      wiperControlMessage.value = message;
      wiperControlSuccess.value = success;

      // 5秒后清除消息
      setTimeout(() => {
        wiperControlMessage.value = '';
      }, 5000);
    };



    // 修改雨刷状态
    const changeStatus = async (status, logChange = true) => {
      try {
        // 设置加载状态
        isWiperControlLoading.value = true;

        if (logChange) {
          console.log(`[Home] 准备切换雨刷状态为: ${status}`);
        }

        // 直接使用前端状态
        // 调用服务控制雨刷
        const result = await wiperService.control(status);

        if (result.success) {
          // 更新本地状态
          currentStatus.value = status;

          if (logChange) {
            console.log(`[Home] 雨刷状态已切换为: ${status}`);
            showWiperControlMessage(`雨刷已切换到${getStatusText(status)}模式`);
          }
        } else {
          console.error('[Home] 控制雨刷失败:', result.error);
          showWiperControlMessage(`控制雨刷失败: ${result.error || '未知错误'}`, false);
        }
      } catch (error) {
        console.error('[Home] 控制雨刷错误:', error);
        showWiperControlMessage(`控制雨刷错误: ${error.message || '未知错误'}`, false);
      } finally {
        // 重置加载状态
        isWiperControlLoading.value = false;
      }
    };

    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        'off': '关闭',
        'interval': '间歇',
        'low': '低速',
        'high': '高速',
        'smart': '智能'
      };
      return statusMap[status] || status;
    };

    // 切换雨刷开关
    const toggleWiper = async () => {
      if (currentStatus.value === 'off') {
        // 如果当前是关闭状态，则切换到智能模式
        await changeStatus('smart');
      } else {
        // 如果当前是其他状态，则切换到关闭状态
        await changeStatus('off');
      }
    };

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

    // 启动OneNET同步服务
    const startOneNetSync = async () => {
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

        console.log(`[首页] 开始启动OneNET同步服务`);

        // 调用服务启动OneNET同步
        const result = await rainfallDataService.startOneNetSync();

        if (result.success) {
          mockDataSuccess.value = true;
          mockDataMessage.value = `OneNET同步服务已启动，每5秒从OneNET平台同步一次数据`;
          console.log(`[首页] OneNET同步服务启动成功: ${result.message}`);

          // 立即获取最新数据并启动数据轮询
          fetchRainfallFromBackend();
          startServiceDataCheck();

          // 10秒后清除消息
          setTimeout(() => {
            mockDataMessage.value = '';
          }, 10000);
        } else {
          mockDataSuccess.value = false;
          mockDataMessage.value = `启动OneNET同步服务失败: ${result.error || '未知错误'}`;
          console.error(`[首页] 启动OneNET同步服务失败:`, result.error);

          // 5秒后清除错误消息
          setTimeout(() => {
            mockDataMessage.value = '';
          }, 5000);
        }
      } catch (error) {
        mockDataSuccess.value = false;
        mockDataMessage.value = `启动OneNET同步服务错误: ${error.message || '未知错误'}`;
        console.error(`[首页] 启动OneNET同步服务错误:`, error);

        // 5秒后清除错误消息
        setTimeout(() => {
          mockDataMessage.value = '';
        }, 5000);
      } finally {
        // 重置加载状态
        isMockDataLoading.value = false;
      }
    };



    // 语音控制相关变量
    const isVoiceButtonLocked = ref(false); // 防止按钮快速连续点击

    // 语音控制相关方法
    const toggleVoiceControl = async () => {
      console.log('[Home] 切换语音控制状态');

      // 防止按钮快速连续点击
      if (isVoiceButtonLocked.value) {
        console.warn('[Home] 按钮已锁定，忽略此次点击');
        return;
      }

      // 锁定按钮
      isVoiceButtonLocked.value = true;

      try {
        if (voiceService.isListening.value) {
          // 如果正在监听，则停止
          await stopVoiceListening();
        } else {
          // 如果没有监听，则开始
          await startVoiceListening();
        }
      } finally {
        // 延迟解锁按钮，防止快速连续点击
        setTimeout(() => {
          isVoiceButtonLocked.value = false;
        }, 1000);
      }
    };

    // 开始语音监听
    const startVoiceListening = async () => {
      console.log('[Home] 开始语音监听');

      // 清除之前的结果
      voiceResult.value = '';

      // 同步UI状态与服务状态
      isVoiceListening.value = voiceService.isListening.value;

      try {
        // 启动语音识别（异步）
        const startSuccess = await voiceService.start();

        // 同步UI状态与服务状态
        isVoiceListening.value = voiceService.isListening.value;

        if (!startSuccess) {
          // 启动失败
          showVoiceResult(voiceService.error.value || '启动语音识别失败', false);
        }
      } catch (err) {
        console.error('[Home] 启动语音识别出错:', err);
        isVoiceListening.value = false;
        showVoiceResult(`启动语音识别出错: ${err.message || '未知错误'}`, false);
      }
    };

    // 停止语音监听
    const stopVoiceListening = async () => {
      console.log('[Home] 停止语音监听');

      try {
        // 检查是否有识别结果
        const currentResult = voiceService.recognitionResult.value.trim();

        if (currentResult) {
          console.log(`[Home] 停止语音监听前发现有识别结果: "${currentResult}"`);
        }

        // 停止语音识别服务，保留结果
        await voiceService.stop(true);

        // 如果有识别结果但没有被处理（可能是因为没有触发voice-result事件）
        // 这是一个额外的安全措施，通常不会执行到这里，因为voiceService.stop已经会触发事件
        if (currentResult && !voiceResult.value) {
          console.log(`[Home] 手动处理未被处理的识别结果: "${currentResult}"`);
          handleVoiceCommand(currentResult);
        }
      } catch (err) {
        console.error('[Home] 停止语音识别出错:', err);
      } finally {
        // 确保UI状态与服务状态同步
        isVoiceListening.value = voiceService.isListening.value;
      }
    };

    // 显示语音结果
    const showVoiceResult = (result, success = true) => {
      console.log(`[Home] 显示语音结果: ${result}, 成功: ${success}`);

      voiceResult.value = result;
      voiceSuccess.value = success;

      // 5秒后清除结果
      setTimeout(() => {
        voiceResult.value = '';
      }, 5000);
    };

    // 处理语音命令
    const handleVoiceCommand = (command) => {
      console.log(`[Home] 处理语音命令: ${command}`);

      // 使用语音服务处理命令
      const action = voiceService.processCommand(command);

      if (action) {
        console.log(`[Home] 识别到语音命令: ${action}`);

        // 根据命令执行相应操作
        if (action === 'start') {
          // 开启雨刷
          if (currentStatus.value === 'off') {
            changeStatus('smart');
            showVoiceResult('已开启雨刷（智能模式）');
          } else {
            showVoiceResult('雨刷已经处于开启状态');
          }
        } else if (action === 'stop') {
          // 关闭雨刷
          if (currentStatus.value !== 'off') {
            changeStatus('off');
            showVoiceResult('已关闭雨刷');
          } else {
            showVoiceResult('雨刷已经处于关闭状态');
          }
        } else if (['smart', 'interval', 'low', 'high'].includes(action)) {
          // 切换到特定模式
          changeStatus(action);

          // 获取模式的中文名称
          const modeNames = {
            'smart': '智能',
            'interval': '间歇',
            'low': '低速',
            'high': '高速'
          };

          showVoiceResult(`已切换到${modeNames[action]}模式`);
        } else {
          // 未知命令
          showVoiceResult(`无法执行命令: ${command}`, false);
        }
      } else {
        // 未识别到有效命令
        showVoiceResult(`未识别到有效命令: ${command}`, false);
      }
    };

    // 事件处理函数（定义在外部，以便正确移除）
    const voiceResultHandler = (event) => {
      console.log('[Home] 收到语音识别结果事件:', event.detail);

      const result = event.detail.result;

      // 处理语音命令
      handleVoiceCommand(result);
    };

    const voiceErrorHandler = (event) => {
      console.error('[Home] 收到语音识别错误事件:', event.detail);

      // 显示错误消息
      showVoiceResult(`语音识别错误: ${event.detail.error}`, false);

      // 确保UI状态与服务状态同步
      isVoiceListening.value = voiceService.isListening.value;
    };

    const voiceEndHandler = () => {
      console.log('[Home] 收到语音识别结束事件');

      // 确保UI状态与服务状态同步
      isVoiceListening.value = voiceService.isListening.value;
    };

    // 🔧 修复：检查登录状态
    const checkLoginStatus = async () => {
      console.log('[Home] 检查登录状态');

      try {
        // 使用专门的验证API检查session是否有效
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.isLoggedIn) {
            console.log(`[Home] Session有效，用户已登录: ${data.username}`);
            return true;
          }
        }

        console.log('[Home] Session无效或已过期');
        // 清除本地存储的用户信息
        localStorage.removeItem('user');
        // 跳转到登录页面
        window.location.href = '/login';
        return false;

      } catch (error) {
        console.error('[Home] 检查登录状态失败:', error);
        // 清除本地存储的用户信息
        localStorage.removeItem('user');
        // 跳转到登录页面
        window.location.href = '/login';
        return false;
      }
    };

    // 设置语音事件监听器
    const setupVoiceEventListeners = () => {
      console.log('[Home] 设置语音事件监听器');

      // 先移除可能存在的事件监听器，防止重复添加
      removeVoiceEventListeners();

      // 添加事件监听器
      window.addEventListener('voice-result', voiceResultHandler);
      window.addEventListener('voice-error', voiceErrorHandler);
      window.addEventListener('voice-end', voiceEndHandler);

      console.log('[Home] 语音事件监听器设置完成');
    };

    // 移除语音事件监听器
    const removeVoiceEventListeners = () => {
      console.log('[Home] 移除语音事件监听器');

      // 正确移除事件监听器
      window.removeEventListener('voice-result', voiceResultHandler);
      window.removeEventListener('voice-error', voiceErrorHandler);
      window.removeEventListener('voice-end', voiceEndHandler);

      console.log('[Home] 语音事件监听器移除完成');
    };

    // 组件挂载后初始化
    onMounted(async () => {
      console.log('[Home] 组件已挂载');

      try {
        // 🔧 修复：首先验证登录状态
        await checkLoginStatus();

        // 设置语音事件监听器
        setupVoiceEventListeners();

        // 检查数据采集器状态
        const statusResult = await rainfallDataService.checkCollectorStatus();
        console.log('[Home] 数据采集器状态检查结果:', statusResult);

        if (statusResult.success) {
          isDataPollingActive.value = statusResult.isRunning;
          if (statusResult.isRunning) {
            // 数据采集器已在运行，启动数据轮询
            console.log('[Home] 数据采集器已在运行，启动前端数据轮询');
            startServiceDataCheck();
          } else {
            // 数据采集器未在运行，自动启动OneNET同步
            console.log('[Home] 数据采集器未在运行，自动启动OneNET同步');
            backendMessage.value = '正在启动OneNET同步...';

            // 自动启动OneNET同步
            try {
              const result = await rainfallDataService.startOneNetSync();
              if (result.success) {
                console.log('[Home] 自动启动OneNET同步成功');
                mockDataSuccess.value = true;
                mockDataMessage.value = `OneNET同步服务已自动启动`;

                // 立即获取最新数据并启动数据轮询
                fetchRainfallFromBackend();
                startServiceDataCheck();

                // 5秒后清除消息
                setTimeout(() => {
                  mockDataMessage.value = '';
                }, 5000);
              } else {
                console.error('[Home] 自动启动OneNET同步失败:', result.error);
                backendMessage.value = `OneNET同步启动失败: ${result.error || '未知错误'}`;
              }
            } catch (error) {
              console.error('[Home] 自动启动OneNET同步错误:', error);
              backendMessage.value = `OneNET同步启动错误: ${error.message || '未知错误'}`;
            }
          }
        } else {
          // 检查状态出错，显示错误信息
          console.error('[Home] 检查数据采集器状态出错:', statusResult.error);
          backendMessage.value = `检查同步状态出错: ${statusResult.error || '未知错误'}`;
        }
      } catch (error) {
        console.error('[Home] 初始化错误:', error);
        backendMessage.value = `初始化错误: ${error.message || '未知错误'}`;
      }
    });

    // 组件卸载清理资源
    onUnmounted(async () => {
      console.log("[Home] 组件已卸载");

      try {
        // 确保停止语音监听
        if (voiceService.isListening.value || isVoiceListening.value) {
          console.log('[Home] 组件卸载时停止语音识别');
          await voiceService.cleanupResources();
        }

        // 移除语音事件监听器
        removeVoiceEventListeners();

        console.log('[Home] 语音服务资源已清理');
      } catch (err) {
        console.error('[Home] 清理语音服务资源出错:', err);
      }

      // 清理定时器，但保留轮询状态
      if (dataPollingInterval.value) {
        console.log('[Home] 卸载时清理定时器');
        clearInterval(dataPollingInterval.value);
        dataPollingInterval.value = null;
      }
    });

    // OneNET自动同步状态相关函数已移除

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
      backendMessage,
      // 数据轮询相关
      isDataPollingActive,
      startServiceDataCheck,
      stopServiceDataCheck,
      // 数据源相关
      isOneNetSource,
      startOneNetSync,
      stopOneNetSync,
      // 语音控制相关
      isVoiceListening,
      voiceResult,
      voiceSuccess,
      toggleVoiceControl,
      // 雨刷控制消息相关
      wiperControlMessage,
      wiperControlSuccess,
      isWiperControlLoading
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

    .data-source-switch {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-xs);
      margin-bottom: var(--spacing-md);
    }

    .data-source-label {
      font-size: var(--font-size-sm);
      color: #666;
    }

    .data-source-btn {
      background-color: #f5f5f5;
      color: #666;
      border: 1px solid #ddd;
      border-radius: var(--border-radius-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: var(--font-size-xs);
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .data-source-btn.active {
      background-color: #4285f4;
      color: white;
      border-color: #4285f4;
    }

    .data-source-btn:hover:not(.active) {
      background-color: #e0e0e0;
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

  .voice-control-btn {
    background-color: #34a853;
    color: white;
    border: none;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: var(--font-size-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    transition: all 0.3s ease;
    margin-top: var(--spacing-md);
    width: 100%;
    max-width: 400px;
    justify-content: center;

    &:hover {
      background-color: #2d9249;
    }

    &.listening {
      background-color: #ea4335;
      animation: pulse 1.5s infinite;

      &:hover {
        background-color: #d33426;
      }
    }

    .icon {
      font-size: calc(var(--font-size-md) * 1.2);
    }
  }

  .voice-result {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-md);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    width: 100%;
    max-width: 400px;

    &.success {
      background-color: rgba(52, 168, 83, 0.1);
      color: #34a853;
      border: 1px solid rgba(52, 168, 83, 0.3);
    }

    &.error {
      background-color: rgba(234, 67, 53, 0.1);
      color: #ea4335;
      border: 1px solid rgba(234, 67, 53, 0.3);
    }

    .icon {
      font-size: var(--font-size-md);
    }
  }


  .wiper-control-message {
    margin-top: var(--spacing-md);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);

    &.success {
      background-color: rgba(52, 168, 83, 0.1);
      color: #34a853;
      border: 1px solid rgba(52, 168, 83, 0.3);
    }

    &.error {
      background-color: rgba(234, 67, 53, 0.1);
      color: #ea4335;
      border: 1px solid rgba(234, 67, 53, 0.3);
    }

    .icon {
      font-size: calc(var(--font-size-sm) * 1.2);
    }
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
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

  /* 开关按钮样式已移除 */
}
</style>