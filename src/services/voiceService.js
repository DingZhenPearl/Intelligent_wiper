// src/services/voiceService.js
import { ref } from 'vue';

// 创建一个单例服务，用于语音识别
const voiceService = {
  // 语音识别状态
  isListening: ref(false),

  // 识别结果
  recognitionResult: ref(''),

  // 错误信息
  error: ref(null),

  // 语音识别实例
  recognition: null,

  // 初始化语音识别
  init() {
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
  start() {
    console.log('[语音服务] 开始语音识别');

    if (!this.recognition) {
      const initSuccess = this.init();
      if (!initSuccess) return false;
    }

    try {
      this.recognition.start();
      this.isListening.value = true;
      this.error.value = null;
      this.recognitionResult.value = '';
      console.log('[语音服务] 语音识别已启动');
      return true;
    } catch (err) {
      console.error('[语音服务] 启动语音识别失败:', err);
      this.error.value = `启动语音识别失败: ${err.message}`;
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
