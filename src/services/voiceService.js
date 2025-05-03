// src/services/voiceService.js
import { ref } from 'vue';
import { isNative } from '../utils/platform';
import { Capacitor } from '@capacitor/core';

// 创建一个单例服务，用于语音识别
const voiceService = {
  // 语音识别状态
  isListening: ref(false),

  // 识别结果
  recognitionResult: ref(''),

  // 错误信息
  error: ref(null),

  // 权限状态
  microphonePermissionGranted: ref(false),

  // 语音识别实例
  recognition: null,

  // 初始化服务
  async setup() {
    console.log('[语音服务] 设置服务');

    // 监听原生权限事件
    if (isNative()) {
      this.setupNativeListeners();
    }

    // 初始化语音识别
    await this.init();

    // 在应用启动时主动请求麦克风权限
    setTimeout(async () => {
      console.log('[语音服务] 应用启动后主动请求麦克风权限');
      await this.checkMicrophonePermission();
    }, 2000); // 延迟2秒，确保应用已完全加载
  },

  // 设置原生事件监听器
  setupNativeListeners() {
    console.log('[语音服务] 设置原生事件监听器');

    // 监听麦克风权限授予事件
    window.addEventListener('microphonePermissionGranted', () => {
      console.log('[语音服务] 收到麦克风权限授予事件');
      this.microphonePermissionGranted.value = true;
    });

    // 监听麦克风权限拒绝事件
    window.addEventListener('microphonePermissionDenied', () => {
      console.log('[语音服务] 收到麦克风权限拒绝事件');
      this.microphonePermissionGranted.value = false;
      this.error.value = '麦克风权限被拒绝，无法使用语音识别功能';
    });
  },

  // 移除原生事件监听器
  removeNativeListeners() {
    console.log('[语音服务] 移除原生事件监听器');

    window.removeEventListener('microphonePermissionGranted', () => {});
    window.removeEventListener('microphonePermissionDenied', () => {});
  },

  // 检查麦克风权限
  async checkMicrophonePermission() {
    console.log('[语音服务] 检查麦克风权限');

    // 在Android原生环境中检查权限
    if (isNative() && Capacitor.getPlatform() === 'android') {
      return await this.checkAndroidMicrophonePermission();
    }

    // 在Web环境中检查权限
    return await this.checkWebMicrophonePermission();
  },

  // 检查Android麦克风权限
  async checkAndroidMicrophonePermission() {
    console.log('[语音服务] 检查Android麦克风权限');

    try {
      // 尝试导入Android权限API
      console.log('[语音服务] 尝试导入Android权限API');

      // 使用Capacitor的Android平台API
      const { PermissionState, requestPermissions } = await import('@capacitor/android');

      console.log('[语音服务] 请求麦克风权限');
      const result = await requestPermissions(['android.permission.RECORD_AUDIO']);

      console.log('[语音服务] 麦克风权限状态:', result);

      if (result && result['android.permission.RECORD_AUDIO'] === PermissionState.GRANTED) {
        console.log('[语音服务] 麦克风权限已授予');
        this.microphonePermissionGranted.value = true;
        return true;
      } else {
        console.error('[语音服务] 麦克风权限被拒绝');
        this.error.value = '麦克风权限被拒绝，无法使用语音识别功能';
        this.microphonePermissionGranted.value = false;
        return false;
      }
    } catch (err) {
      console.error('[语音服务] 检查Android麦克风权限失败:', err);

      // 如果API调用失败，尝试直接使用WebView请求权限
      return await this.requestWebViewPermission();
    }
  },

  // 检查Web麦克风权限
  async checkWebMicrophonePermission() {
    console.log('[语音服务] 检查Web麦克风权限');

    try {
      // 尝试使用navigator.permissions API（Web标准）
      if (navigator.permissions) {
        console.log('[语音服务] 尝试使用navigator.permissions API');
        const permissionResult = await navigator.permissions.query({ name: 'microphone' });

        console.log('[语音服务] 麦克风权限状态:', permissionResult.state);

        if (permissionResult.state === 'granted') {
          this.microphonePermissionGranted.value = true;
          return true;
        } else if (permissionResult.state === 'prompt') {
          // 将在用户尝试使用麦克风时提示
          return true;
        } else {
          this.error.value = '麦克风权限被拒绝，无法使用语音识别功能';
          this.microphonePermissionGranted.value = false;
          return false;
        }
      }
    } catch (permErr) {
      console.error('[语音服务] navigator.permissions API失败:', permErr);
    }

    // 如果navigator.permissions不可用，尝试直接请求权限
    return await this.requestWebViewPermission();
  },

  // 在WebView中直接请求麦克风权限
  async requestWebViewPermission() {
    console.log('[语音服务] 在WebView中直接请求麦克风权限');

    try {
      // 创建一个临时的MediaStream来触发权限请求
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 如果成功获取流，则权限已授予
      console.log('[语音服务] 成功获取音频流，麦克风权限已授予');

      // 停止所有轨道
      stream.getTracks().forEach(track => track.stop());

      this.microphonePermissionGranted.value = true;
      return true;
    } catch (err) {
      console.error('[语音服务] 请求麦克风权限失败:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.error.value = '麦克风权限被拒绝，无法使用语音识别功能';
        this.microphonePermissionGranted.value = false;
        return false;
      }

      // 对于其他错误，假设权限可能已授予
      console.log('[语音服务] 无法确定权限状态，假设已授予');
      return true;
    }
  },

  // 初始化语音识别
  async init() {
    console.log('[语音服务] 初始化语音识别服务');

    // 检查浏览器是否支持语音识别
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('[语音服务] 当前浏览器不支持语音识别');
      this.error.value = '当前浏览器不支持语音识别';
      return false;
    }

    try {
      // 创建语音识别实例
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();

      // 配置语音识别
      this.recognition.continuous = false; // 不持续识别
      this.recognition.interimResults = false; // 不返回中间结果
      this.recognition.lang = 'zh-CN'; // 设置语言为中文

      // 设置事件处理器
      this.setupEventHandlers();

      console.log('[语音服务] 语音识别服务初始化成功');
      return true;
    } catch (err) {
      console.error('[语音服务] 初始化语音识别失败:', err);
      this.error.value = `初始化语音识别失败: ${err.message}`;
      return false;
    }
  },

  // 设置事件处理器
  setupEventHandlers() {
    if (!this.recognition) return;

    // 结果事件
    this.recognition.onresult = (event) => {
      const result = event.results[0][0].transcript;
      console.log(`[语音服务] 识别结果: ${result}`);
      this.recognitionResult.value = result;

      // 触发自定义事件
      window.dispatchEvent(new CustomEvent('voice-result', {
        detail: { result }
      }));
    };

    // 错误事件
    this.recognition.onerror = (event) => {
      console.error(`[语音服务] 识别错误: ${event.error}`);
      this.error.value = `识别错误: ${event.error}`;
      this.isListening.value = false;

      // 触发自定义事件
      window.dispatchEvent(new CustomEvent('voice-error', {
        detail: { error: event.error }
      }));
    };

    // 结束事件
    this.recognition.onend = () => {
      console.log('[语音服务] 识别结束');
      this.isListening.value = false;

      // 触发自定义事件
      window.dispatchEvent(new CustomEvent('voice-end'));
    };
  },

  // 开始语音识别
  async start() {
    console.log('[语音服务] 开始语音识别');

    // 在原生环境中，检查权限状态
    if (isNative()) {
      console.log('[语音服务] 在原生环境中检查麦克风权限状态');

      // 如果已知权限被拒绝，直接返回错误
      if (this.microphonePermissionGranted.value === false) {
        console.error('[语音服务] 麦克风权限已被拒绝');
        this.error.value = '麦克风权限被拒绝，请在设置中允许应用使用麦克风';
        return false;
      }

      // 如果权限状态未知，尝试请求权限
      if (this.microphonePermissionGranted.value !== true) {
        console.log('[语音服务] 权限状态未知，尝试请求权限');
        const hasPermission = await this.checkMicrophonePermission();
        if (!hasPermission) {
          console.error('[语音服务] 没有麦克风权限，无法启动语音识别');
          this.error.value = '没有麦克风权限，请在设置中允许应用使用麦克风';
          return false;
        }
      }
    } else {
      // 在Web环境中，使用Web API检查权限
      const hasPermission = await this.checkMicrophonePermission();
      if (!hasPermission) {
        console.error('[语音服务] 没有麦克风权限，无法启动语音识别');
        this.error.value = '没有麦克风权限，请在设置中允许应用使用麦克风';
        return false;
      }
    }

    if (!this.recognition) {
      const initSuccess = await this.init();
      if (!initSuccess) return false;
    }

    try {
      // 在启动前添加一个小延迟，确保权限已经完全生效
      await new Promise(resolve => setTimeout(resolve, 500));

      // 添加更多日志，帮助调试
      console.log('[语音服务] 尝试启动语音识别...');

      this.recognition.start();
      this.isListening.value = true;
      this.error.value = null;
      this.recognitionResult.value = '';
      console.log('[语音服务] 语音识别已启动');
      return true;
    } catch (err) {
      console.error('[语音服务] 启动语音识别失败:', err);
      console.error('[语音服务] 错误名称:', err.name);
      console.error('[语音服务] 错误消息:', err.message);

      // 提供更详细的错误信息
      let errorMessage = `启动语音识别失败: ${err.message}`;

      if (err.name === 'NotAllowedError') {
        errorMessage = '麦克风访问被拒绝，请确保已授予麦克风权限';
        // 更新权限状态
        this.microphonePermissionGranted.value = false;
      } else if (err.name === 'NotFoundError') {
        errorMessage = '未找到麦克风设备';
      }

      this.error.value = errorMessage;
      this.isListening.value = false;
      return false;
    }
  },

  // 停止语音识别
  stop() {
    console.log('[语音服务] 停止语音识别');

    if (!this.recognition) return;

    try {
      this.recognition.stop();
      this.isListening.value = false;
      console.log('[语音服务] 语音识别已停止');
    } catch (err) {
      console.error('[语音服务] 停止语音识别失败:', err);
      this.error.value = `停止语音识别失败: ${err.message}`;
    }
  },

  // 处理语音命令
  processCommand(command) {
    if (!command) return null;

    // 转换为小写并去除空格
    const normalizedCommand = command.toLowerCase().trim();
    console.log(`[语音服务] 处理语音命令: ${normalizedCommand}`);

    // 定义命令映射
    const commandMap = {
      // 开关命令
      '开启': 'start',
      '打开': 'start',
      '启动': 'start',
      '开始': 'start',
      '关闭': 'stop',
      '停止': 'stop',
      '关掉': 'stop',

      // 模式命令
      '智能模式': 'smart',
      '智能': 'smart',
      '自动': 'smart',
      '间歇模式': 'interval',
      '间歇': 'interval',
      '低速模式': 'low',
      '低速': 'low',
      '慢速': 'low',
      '高速模式': 'high',
      '高速': 'high',
      '快速': 'high'
    };

    // 检查命令是否包含关键词
    for (const [keyword, action] of Object.entries(commandMap)) {
      if (normalizedCommand.includes(keyword)) {
        console.log(`[语音服务] 匹配到命令: ${keyword} -> ${action}`);
        return action;
      }
    }

    // 如果没有匹配到任何命令
    console.log('[语音服务] 未匹配到任何命令');
    return null;
  }
};

export default voiceService;
