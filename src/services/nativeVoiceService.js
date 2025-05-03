// src/services/nativeVoiceService.js
import { ref } from 'vue';
import { isNative } from '../utils/platform';

// 创建一个单例服务，用于原生语音识别
const nativeVoiceService = {
  // 语音识别状态
  isListening: ref(false),

  // 识别结果
  recognitionResult: ref(''),

  // 错误信息
  error: ref(null),

  // 权限状态
  microphonePermissionGranted: ref(false),

  // 原生桥接器
  nativeBridge: null,

  // 初始化服务
  setup() {
    console.log('[原生语音服务] 设置服务');

    // 只在原生环境中初始化
    if (!isNative()) {
      console.log('[原生语音服务] 非原生环境，跳过初始化');
      return false;
    }

    try {
      // 获取原生桥接器
      this.nativeBridge = window.NativeVoice;

      if (!this.nativeBridge) {
        console.error('[原生语音服务] 未找到原生桥接器');
        this.error.value = '未找到原生语音识别桥接器';
        return false;
      }

      console.log('[原生语音服务] 找到原生桥接器');

      // 设置事件监听器
      this.setupEventListeners();

      // 检查麦克风权限
      this.checkMicrophonePermission();

      return true;
    } catch (err) {
      console.error('[原生语音服务] 初始化失败:', err);
      this.error.value = `初始化失败: ${err.message}`;
      return false;
    }
  },

  // 设置事件监听器
  setupEventListeners() {
    console.log('[原生语音服务] 设置事件监听器');

    // 监听权限授予事件
    window.addEventListener('nativeVoicePermissionGranted', () => {
      console.log('[原生语音服务] 收到权限授予事件');
      this.microphonePermissionGranted.value = true;
    });

    // 监听权限拒绝事件
    window.addEventListener('nativeVoicePermissionDenied', () => {
      console.log('[原生语音服务] 收到权限拒绝事件');
      this.microphonePermissionGranted.value = false;
      this.error.value = '麦克风权限被拒绝，无法使用语音识别功能';
    });

    // 监听监听状态变化事件
    window.addEventListener('nativeVoiceListeningChanged', (event) => {
      console.log('[原生语音服务] 收到监听状态变化事件:', event.detail);

      if (event.detail && typeof event.detail === 'string') {
        try {
          const data = JSON.parse(event.detail);
          this.isListening.value = data.isListening;
        } catch (err) {
          console.error('[原生语音服务] 解析监听状态数据失败:', err);
        }
      } else if (event.detail) {
        this.isListening.value = event.detail.isListening;
      }
    });

    // 监听识别结果事件
    window.addEventListener('nativeVoiceResult', (event) => {
      console.log('[原生语音服务] 收到识别结果事件:', event.detail);

      let result = '';

      if (event.detail && typeof event.detail === 'string') {
        try {
          const data = JSON.parse(event.detail);
          result = data.result;
          this.recognitionResult.value = result;

          // 触发自定义事件
          window.dispatchEvent(new CustomEvent('voice-result', {
            detail: { result }
          }));
        } catch (err) {
          console.error('[原生语音服务] 解析识别结果数据失败:', err);
        }
      } else if (event.detail) {
        result = event.detail.result;
        this.recognitionResult.value = result;

        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('voice-result', {
          detail: { result }
        }));
      }

      // 在控制台中显示识别结果
      if (result) {
        console.log('%c【语音识别】识别到语音: ' + result, 'color: #4CAF50; font-weight: bold; font-size: 14px;');
      }
    });

    // 监听错误事件
    window.addEventListener('nativeVoiceError', (event) => {
      console.error('[原生语音服务] 收到错误事件:', event.detail);

      let errorMessage = '';

      if (event.detail && typeof event.detail === 'string') {
        try {
          const data = JSON.parse(event.detail);
          errorMessage = data.errorMessage;
          this.error.value = errorMessage;

          // 触发自定义事件
          window.dispatchEvent(new CustomEvent('voice-error', {
            detail: { error: errorMessage }
          }));
        } catch (err) {
          console.error('[原生语音服务] 解析错误数据失败:', err);
        }
      } else if (event.detail) {
        errorMessage = event.detail.errorMessage;
        this.error.value = errorMessage;

        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('voice-error', {
          detail: { error: errorMessage }
        }));
      }

      // 在控制台中显示错误信息
      if (errorMessage) {
        console.log('%c【语音识别】错误: ' + errorMessage, 'color: #F44336; font-weight: bold; font-size: 14px;');
      }
    });
  },

  // 移除事件监听器
  removeEventListeners() {
    console.log('[原生语音服务] 移除事件监听器');

    window.removeEventListener('nativeVoicePermissionGranted', () => {});
    window.removeEventListener('nativeVoicePermissionDenied', () => {});
    window.removeEventListener('nativeVoiceListeningChanged', () => {});
    window.removeEventListener('nativeVoiceResult', () => {});
    window.removeEventListener('nativeVoiceError', () => {});
  },

  // 检查麦克风权限
  checkMicrophonePermission() {
    console.log('[原生语音服务] 检查麦克风权限');

    if (!this.nativeBridge) {
      console.error('[原生语音服务] 未找到原生桥接器');
      return false;
    }

    try {
      const hasPermission = this.nativeBridge.checkMicrophonePermission();
      console.log('[原生语音服务] 麦克风权限状态:', hasPermission);

      this.microphonePermissionGranted.value = hasPermission;
      return hasPermission;
    } catch (err) {
      console.error('[原生语音服务] 检查麦克风权限失败:', err);
      return false;
    }
  },

  // 请求麦克风权限
  requestMicrophonePermission() {
    console.log('[原生语音服务] 请求麦克风权限');

    if (!this.nativeBridge) {
      console.error('[原生语音服务] 未找到原生桥接器');
      return false;
    }

    try {
      this.nativeBridge.requestMicrophonePermission();
      return true;
    } catch (err) {
      console.error('[原生语音服务] 请求麦克风权限失败:', err);
      return false;
    }
  },

  // 开始语音识别
  start() {
    console.log('[原生语音服务] 开始语音识别');

    if (!this.nativeBridge) {
      console.error('[原生语音服务] 未找到原生桥接器');
      this.error.value = '未找到原生语音识别桥接器';
      return false;
    }

    // 检查麦克风权限
    if (!this.microphonePermissionGranted.value) {
      console.log('[原生语音服务] 麦克风权限未授予，尝试请求权限');
      this.requestMicrophonePermission();
      return false;
    }

    try {
      // 清除之前的结果
      this.recognitionResult.value = '';
      this.error.value = null;

      // 启动语音识别
      this.nativeBridge.startListening();
      return true;
    } catch (err) {
      console.error('[原生语音服务] 启动语音识别失败:', err);
      this.error.value = `启动语音识别失败: ${err.message}`;
      return false;
    }
  },

  // 停止语音识别
  stop() {
    console.log('[原生语音服务] 停止语音识别');

    if (!this.nativeBridge) {
      console.error('[原生语音服务] 未找到原生桥接器');
      return false;
    }

    try {
      this.nativeBridge.stopListening();
      return true;
    } catch (err) {
      console.error('[原生语音服务] 停止语音识别失败:', err);
      return false;
    }
  },

  // 处理语音命令
  processCommand(command) {
    if (!command) return null;

    // 转换为小写并去除空格
    const normalizedCommand = command.toLowerCase().trim();
    console.log(`[原生语音服务] 处理语音命令: ${normalizedCommand}`);

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
        console.log(`[原生语音服务] 匹配到命令: ${keyword} -> ${action}`);
        return action;
      }
    }

    // 如果没有匹配到任何命令
    console.log('[原生语音服务] 未匹配到任何命令');
    return null;
  }
};

export default nativeVoiceService;
