// src/services/voiceService.js
import { ref } from 'vue';
import CryptoJS from 'crypto-js';

// 讯飞语音听写API配置
const XFYUN_APP_ID = '67093950';
const XFYUN_API_KEY = '0de5f528ef3bd2b67625b45543c704e7';
const XFYUN_API_SECRET = 'NjVkNWVjMTljMGZlZjJiNTRjZmJjMzJl';
const XFYUN_API_URL = 'wss://iat-api.xfyun.cn/v2/iat';


// 音频配置
const SAMPLE_RATE = 16000; // 采样率 16kHz
const FRAME_SIZE = 1280; // 每帧音频大小 (40ms @ 16kHz = 640 samples = 1280 bytes)
const SEND_INTERVAL = 40; // 发送间隔 40ms

// 创建一个单例服务，用于语音识别
const voiceService = {
  // 语音识别状态
  isListening: ref(false),

  // 操作锁，防止并发操作
  isLocked: ref(false),

  // 识别结果
  recognitionResult: ref(''),

  // 错误信息
  error: ref(null),

  // 语音识别实例 (浏览器原生API)
  recognition: null,

  // WebSocket连接
  ws: null,

  // 音频上下文
  audioContext: null,
  audioStream: null,
  audioProcessor: null,
  audioBufferQueue: [], // 音频缓冲区队列
  audioSendTimer: null, // 音频发送定时器

  // 超时定时器
  timeoutTimer: null,

  // 是否使用WebSocket方式
  useWebSocket: false,

  // 初始化语音识别
  init() {
    console.log('[语音服务] 初始化语音识别服务');

    // 检测是否在安卓环境中
    const isAndroid = /android/i.test(navigator.userAgent);
    this.useWebSocket = isAndroid;

    if (this.useWebSocket) {
      console.log('[语音服务] 使用WebSocket方式进行语音识别');
      return true;
    } else {
      console.log('[语音服务] 使用浏览器原生API进行语音识别');
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
    }
  },

  // 设置事件处理器 (浏览器原生API)
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

  // 生成讯飞API鉴权URL
  generateAuthUrl() {
    const apiKey = XFYUN_API_KEY;
    const apiSecret = XFYUN_API_SECRET;
    const url = new URL(XFYUN_API_URL);
    const host = url.host;
    const path = url.pathname;
    const date = new Date().toUTCString();
    const algorithm = 'hmac-sha256';
    const headers = 'host date request-line';
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;

    // 使用HMAC-SHA256算法结合apiSecret对signatureOrigin签名
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
    const signature = CryptoJS.enc.Base64.stringify(signatureSha);

    // 构建authorization_origin
    const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;

    // 对authorization_origin进行base64编码
    const authorization = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(authorizationOrigin));

    // 构建最终的URL
    const authUrl = `${XFYUN_API_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;

    return authUrl;
  },

  // 检查并请求录音权限
  async checkAndRequestAudioPermissions() {
    console.log('[语音服务] 检查录音权限');

    // 检查是否在Capacitor环境中
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Permissions) {
      const { Permissions } = window.Capacitor.Plugins;

      try {
        // 检查录音权限
        const recordAudioStatus = await Permissions.query({ name: 'microphone' });
        console.log(`[语音服务] 录音权限状态: ${recordAudioStatus.state}`);

        // 如果没有权限，请求权限
        if (recordAudioStatus.state !== 'granted') {
          console.log('[语音服务] 请求录音权限');
          const requestResult = await Permissions.request({ name: 'microphone' });
          console.log(`[语音服务] 录音权限请求结果: ${requestResult.state}`);

          if (requestResult.state !== 'granted') {
            console.error('[语音服务] 录音权限被拒绝');
            this.error.value = '录音权限被拒绝，无法使用语音识别功能';
            return false;
          }
        }

        return true;
      } catch (err) {
        console.error('[语音服务] 权限检查错误:', err);
        // 如果出错，尝试使用传统方式请求权限
        return this.requestPermissionTraditional();
      }
    } else {
      // 在非Capacitor环境中，使用传统方式请求权限
      return this.requestPermissionTraditional();
    }
  },

  // 使用传统方式请求权限
  async requestPermissionTraditional() {
    try {
      // 直接尝试获取媒体流，这会触发浏览器的权限请求
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 如果成功获取，立即释放资源
      stream.getTracks().forEach(track => track.stop());

      console.log('[语音服务] 成功获取录音权限');
      return true;
    } catch (err) {
      console.error('[语音服务] 获取录音权限失败:', err);
      this.error.value = `录音权限被拒绝: ${err.message}`;
      return false;
    }
  },

  // 初始化WebSocket连接
  async initWebSocket() {
    // 确保没有活跃的WebSocket连接
    if (this.ws) {
      try {
        this.ws.close();
        this.ws = null;
      } catch (err) {
        console.error('[语音服务] 关闭现有WebSocket连接错误:', err);
      }
    }

    // 首先检查并请求权限
    const hasPermission = await this.checkAndRequestAudioPermissions();
    if (!hasPermission) {
      console.error('[语音服务] 没有录音权限，无法启动语音识别');
      this.error.value = '没有录音权限，无法启动语音识别';

      // 触发自定义事件
      window.dispatchEvent(new CustomEvent('voice-error', {
        detail: { error: '没有录音权限' }
      }));

      return false;
    }

    // 生成鉴权URL
    const url = this.generateAuthUrl();
    console.log('[语音服务] 连接讯飞语音听写WebSocket API');

    // 创建WebSocket连接
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(url);

        // 设置连接超时
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            console.error('[语音服务] WebSocket连接超时');
            this.error.value = 'WebSocket连接超时';

            // 触发错误事件
            window.dispatchEvent(new CustomEvent('voice-error', {
              detail: { error: 'WebSocket连接超时' }
            }));

            // 关闭连接
            if (this.ws) {
              this.ws.close();
              this.ws = null;
            }

            resolve(false);
          }
        }, 5000);

        // 连接建立
        this.ws.onopen = () => {
          console.log('[语音服务] WebSocket连接已建立');
          clearTimeout(connectionTimeout);

          // 开始录音
          this.startRecording();
          resolve(true);
        };

        // 接收消息
        this.ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleWebSocketMessage(data);
          } catch (err) {
            console.error('[语音服务] 处理WebSocket消息错误:', err);
          }
        };

        // 连接关闭
        this.ws.onclose = (event) => {
          console.log(`[语音服务] WebSocket连接已关闭, 代码: ${event.code}, 原因: ${event.reason}`);
          clearTimeout(connectionTimeout);

          // 停止录音
          this.stopRecording();

          // 更新状态
          this.isListening.value = false;

          // 触发结束事件
          window.dispatchEvent(new CustomEvent('voice-end'));

          if (!event.wasClean && this.isListening.value) {
            // 如果是非正常关闭且仍在监听状态，触发错误事件
            this.error.value = '语音识别连接意外关闭';
            window.dispatchEvent(new CustomEvent('voice-error', {
              detail: { error: '语音识别连接意外关闭' }
            }));
          }

          resolve(false);
        };

        // 连接错误
        this.ws.onerror = (e) => {
          console.error('[语音服务] WebSocket连接错误:', e);
          clearTimeout(connectionTimeout);

          this.error.value = '语音识别连接错误';
          this.isListening.value = false;

          // 触发自定义事件
          window.dispatchEvent(new CustomEvent('voice-error', {
            detail: { error: 'WebSocket连接错误' }
          }));

          resolve(false);
        };
      } catch (err) {
        console.error('[语音服务] 创建WebSocket连接错误:', err);
        this.error.value = `创建WebSocket连接错误: ${err.message}`;
        resolve(false);
      }
    });
  },

  // 处理WebSocket消息
  handleWebSocketMessage(data) {
    if (data.code !== 0) {
      console.error(`[语音服务] 讯飞API返回错误: ${data.code}, ${data.message}`);
      this.error.value = `讯飞API错误: ${data.message}`;
      return;
    }

    console.log(`[语音服务] 收到WebSocket消息: ${JSON.stringify(data)}`);

    // 处理识别结果
    if (data.data && data.data.result) {
      let result = '';
      const resultData = data.data.result;

      // 检查是否有动态修正
      const hasDynamicCorrection = resultData.pgs === 'rpl';
      const isLastSegment = resultData.ls;

      // 解析识别结果
      if (resultData.ws) {
        const words = resultData.ws.map(item => {
          if (item.cw && item.cw.length > 0) {
            return item.cw[0].w;
          }
          return '';
        });
        result = words.join('');
      }

      if (result) {
        console.log(`[语音服务] 识别结果: ${result}, 动态修正: ${hasDynamicCorrection}, 最后片段: ${isLastSegment}`);

        // 如果是动态修正，替换之前的结果
        if (hasDynamicCorrection) {
          this.recognitionResult.value = result;
        } else {
          // 否则追加结果
          this.recognitionResult.value += result;
        }

        // 如果是最后一个结果，触发结果事件
        if (data.data.status === 2 || isLastSegment) {
          console.log(`[语音服务] 最终识别结果: ${this.recognitionResult.value}`);

          // 触发自定义事件
          window.dispatchEvent(new CustomEvent('voice-result', {
            detail: { result: this.recognitionResult.value }
          }));
        }
      }
    }

    // 如果识别结束
    if (data.data && data.data.status === 2) {
      console.log('[语音服务] 讯飞语音识别结束');

      // 检查是否有最终结果但未触发事件
      const finalResult = this.recognitionResult.value.trim();
      if (finalResult && !data.data.result) {
        console.log(`[语音服务] 识别结束时发现未处理的最终结果: "${finalResult}"`);

        // 触发结果事件
        window.dispatchEvent(new CustomEvent('voice-result', {
          detail: { result: finalResult }
        }));

        // 给事件处理一些时间
        setTimeout(() => {
          this.stopWebSocket();
        }, 100);
      } else {
        this.stopWebSocket();
      }
    }
  },

  // 开始录音
  async startRecording() {
    try {
      // 清空音频缓冲区队列
      this.audioBufferQueue = [];

      // 请求麦克风权限
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // 创建音频上下文
      const AudioContextClass = window.AudioContext || window.AudioContext;
      this.audioContext = new AudioContextClass({
        sampleRate: SAMPLE_RATE
      });

      console.log(`[语音服务] 音频上下文采样率: ${this.audioContext.sampleRate}Hz`);

      const audioInput = this.audioContext.createMediaStreamSource(this.audioStream);

      // 创建处理器节点 - 使用更小的缓冲区大小以减少延迟
      this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      // 连接节点
      audioInput.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);

      // 标记是否是第一帧
      let isFirstFrame = true;

      // 处理音频数据
      this.audioProcessor.onaudioprocess = (e) => {
        // 确保WebSocket连接已建立且处于开启状态
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const buffer = e.inputBuffer.getChannelData(0);

          // 将音频数据添加到队列中
          this.audioBufferQueue.push(buffer);
        }
      };

      // 设置定时器，按照固定间隔发送音频数据
      this.audioSendTimer = setInterval(() => {
        this.processAudioQueue(isFirstFrame);

        // 第一帧发送后，将标记设为false
        if (isFirstFrame && this.audioBufferQueue.length > 0) {
          isFirstFrame = false;
        }
      }, SEND_INTERVAL);

      console.log('[语音服务] 开始录音');
    } catch (err) {
      console.error('[语音服务] 启动录音失败:', err);
      this.error.value = `启动录音失败: ${err.message}`;
      this.stopWebSocket();
    }
  },

  // 处理音频队列
  processAudioQueue(isFirstFrame) {
    if (this.audioBufferQueue.length === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // 从队列中取出一个音频缓冲区
    const buffer = this.audioBufferQueue.shift();

    // 如果缓冲区大小超过了FRAME_SIZE，则需要分片处理
    const samplesPerFrame = FRAME_SIZE / 2; // 每帧采样点数 (16位 = 2字节/采样)

    // 如果缓冲区大小小于一帧，直接发送
    if (buffer.length <= samplesPerFrame) {
      this.sendAudioData(buffer, isFirstFrame);
    } else {
      // 分片处理
      let offset = 0;
      let firstChunk = isFirstFrame;

      while (offset < buffer.length) {
        const end = Math.min(offset + samplesPerFrame, buffer.length);
        const chunk = buffer.slice(offset, end);

        this.sendAudioData(chunk, firstChunk);

        offset += samplesPerFrame;
        firstChunk = false; // 只有第一个分片是第一帧
      }
    }
  },

  // 停止录音
  stopRecording() {
    // 清除音频发送定时器
    if (this.audioSendTimer) {
      clearInterval(this.audioSendTimer);
      this.audioSendTimer = null;
    }

    // 清空音频缓冲区队列
    this.audioBufferQueue = [];

    if (this.audioProcessor) {
      try {
        this.audioProcessor.disconnect();
      } catch (err) {
        console.error('[语音服务] 断开音频处理器错误:', err);
      }
      this.audioProcessor = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close().catch(err => {
          console.error('[语音服务] 关闭音频上下文错误:', err);
        });
      } catch (err) {
        console.error('[语音服务] 关闭音频上下文错误:', err);
      }
      this.audioContext = null;
    }

    if (this.audioStream) {
      try {
        this.audioStream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('[语音服务] 停止音频流错误:', err);
      }
      this.audioStream = null;
    }

    console.log('[语音服务] 停止录音');
  },

  // 发送音频数据
  sendAudioData(buffer, isFirstFrame = false) {
    try {
      // 将Float32Array转换为Int16Array
      const int16Data = new Int16Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        // 将-1.0 ~ 1.0的浮点数转换为-32768 ~ 32767的整数
        int16Data[i] = Math.max(-32768, Math.min(32767, buffer[i] * 32768));
      }

      // 将数组转换为Base64字符串
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)));

      // 构建请求数据
      let audioData = {
        data: {
          status: isFirstFrame ? 0 : 1, // 0表示第一帧，1表示中间帧
          format: `audio/L16;rate=${SAMPLE_RATE}`,
          encoding: 'raw',
          audio: base64Data
        }
      };

      // 如果是第一帧，添加common和business参数
      if (isFirstFrame) {
        audioData.common = {
          app_id: XFYUN_APP_ID // 讯飞应用ID
        };

        audioData.business = {
          language: 'zh_cn',    // 中文
          domain: 'iat',        // 日常用语
          accent: 'mandarin',   // 普通话
          vad_eos: 5000,        // 静音检测，静音5秒后自动停止
          dwa: 'wpgs',          // 开启动态修正功能
          ptt: 1,               // 开启标点符号
          nunum: 1,             // 将数字转换为阿拉伯数字
          vinfo: 1              // 返回音频的起始和结束帧偏移值
        };
      }

      // 发送数据
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(audioData));

        // 记录日志，但不记录音频数据(太大)
        if (isFirstFrame) {
          const logData = { ...audioData };
          logData.data = { ...audioData.data };
          delete logData.data.audio;
          console.log(`[语音服务] 发送第一帧数据: ${JSON.stringify(logData)}`);
        }
      }
    } catch (err) {
      console.error('[语音服务] 发送音频数据错误:', err);
    }
  },

  // 发送结束标志
  sendEndFlag() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const endData = {
        data: {
          status: 2 // 2表示最后一帧音频
        }
      };
      this.ws.send(JSON.stringify(endData));
    }
  },

  // 停止WebSocket连接
  stopWebSocket() {
    this.stopRecording();

    if (this.ws) {
      // 发送结束标志
      this.sendEndFlag();

      // 延迟关闭WebSocket，确保结束标志被发送
      setTimeout(() => {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
      }, 1000);
    }
  },

  // 清理所有资源
  async cleanupResources(preserveResult = false) {
    console.log('[语音服务] 清理所有资源, 保留结果:', preserveResult);

    // 保存当前识别结果（如果需要）
    const currentResult = preserveResult ? this.recognitionResult.value : '';

    // 清除超时定时器
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    // 停止录音
    this.stopRecording();

    // 关闭WebSocket连接
    if (this.ws) {
      try {
        // 发送结束标志
        this.sendEndFlag();

        // 关闭WebSocket连接
        setTimeout(() => {
          if (this.ws) {
            this.ws.close();
            this.ws = null;
          }
        }, 500);
      } catch (err) {
        console.error('[语音服务] 关闭WebSocket连接错误:', err);
        this.ws = null;
      }
    }

    // 停止浏览器原生语音识别
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (err) {
        console.error('[语音服务] 停止浏览器语音识别错误:', err);
      }
    }

    // 重置状态
    this.isListening.value = false;

    // 如果需要保留结果，则恢复保存的结果
    if (preserveResult) {
      this.recognitionResult.value = currentResult;
    } else {
      this.recognitionResult.value = '';
    }

    // 等待一小段时间确保资源释放
    return new Promise(resolve => setTimeout(resolve, 300));
  },

  // 开始语音识别
  async start() {
    console.log('[语音服务] 开始语音识别');

    // 检查是否已经在监听
    if (this.isListening.value) {
      console.warn('[语音服务] 已经在监听中，忽略此次启动请求');
      return true;
    }

    // 检查是否被锁定
    if (this.isLocked.value) {
      console.warn('[语音服务] 操作被锁定，忽略此次启动请求');
      return false;
    }

    // 锁定操作
    this.isLocked.value = true;

    try {
      // 先清理所有资源，确保干净的开始
      await this.cleanupResources();

      // 重置错误状态
      this.error.value = null;

      // 设置状态为正在监听，这样UI可以立即响应
      this.isListening.value = true;

      if (this.useWebSocket) {
        // 使用WebSocket方式
        try {
          // 异步初始化WebSocket
          const initSuccess = await this.initWebSocket();
          if (initSuccess) {
            console.log('[语音服务] WebSocket语音识别已启动');

            // 设置超时定时器，如果10秒内没有结果，自动停止
            this.timeoutTimer = setTimeout(() => {
              if (this.isListening.value) {
                console.log('[语音服务] 识别超时，自动停止');
                this.stop();

                // 触发错误事件
                window.dispatchEvent(new CustomEvent('voice-error', {
                  detail: { error: '识别超时，未检测到语音' }
                }));
              }
            }, 10000);

            return true;
          } else {
            await this.cleanupResources();
            return false;
          }
        } catch (err) {
          console.error('[语音服务] 启动WebSocket语音识别失败:', err);
          this.error.value = `启动语音识别失败: ${err.message}`;
          await this.cleanupResources();
          return false;
        }
      } else {
        // 使用浏览器原生API
        if (!this.recognition) {
          const initSuccess = this.init();
          if (!initSuccess) {
            this.isLocked.value = false;
            return false;
          }
        }

        try {
          // 检查并请求权限
          const hasPermission = await this.requestPermissionTraditional();
          if (!hasPermission) {
            console.error('[语音服务] 没有录音权限，无法启动语音识别');
            this.error.value = '没有录音权限，无法启动语音识别';
            await this.cleanupResources();
            return false;
          }

          this.recognition.start();
          console.log('[语音服务] 浏览器语音识别已启动');

          // 设置超时定时器，如果10秒内没有结果，自动停止
          this.timeoutTimer = setTimeout(() => {
            if (this.isListening.value) {
              console.log('[语音服务] 识别超时，自动停止');
              this.stop();

              // 触发错误事件
              window.dispatchEvent(new CustomEvent('voice-error', {
                detail: { error: '识别超时，未检测到语音' }
              }));
            }
          }, 10000);

          return true;
        } catch (err) {
          console.error('[语音服务] 启动浏览器语音识别失败:', err);
          this.error.value = `启动语音识别失败: ${err.message}`;
          await this.cleanupResources();
          return false;
        }
      }
    } finally {
      // 解锁操作
      setTimeout(() => {
        this.isLocked.value = false;
      }, 1000); // 延迟1秒解锁，防止快速连续点击
    }
  },

  // 停止语音识别
  async stop(preserveResult = true) {
    console.log('[语音服务] 停止语音识别, 保留结果:', preserveResult);

    // 检查是否被锁定
    if (this.isLocked.value) {
      console.warn('[语音服务] 操作被锁定，将在锁定解除后停止');

      // 等待锁定解除
      setTimeout(() => {
        if (!this.isLocked.value) {
          this.stop(preserveResult);
        }
      }, 1200);

      return;
    }

    // 锁定操作
    this.isLocked.value = true;

    // 检查是否有识别结果
    const hasResult = !!this.recognitionResult.value.trim();
    console.log(`[语音服务] 当前识别结果: "${this.recognitionResult.value}", 有结果: ${hasResult}`);

    try {
      // 如果有识别结果且需要保留，则触发结果事件
      if (hasResult && preserveResult) {
        console.log(`[语音服务] 手动停止时发现有识别结果: "${this.recognitionResult.value}"`);

        // 触发结果事件
        window.dispatchEvent(new CustomEvent('voice-result', {
          detail: { result: this.recognitionResult.value }
        }));

        // 等待一小段时间，确保事件被处理
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 清理所有资源，根据参数决定是否保留结果
      await this.cleanupResources(preserveResult);
      console.log('[语音服务] 语音识别已完全停止');
    } catch (err) {
      console.error('[语音服务] 停止语音识别时发生错误:', err);
      this.error.value = `停止语音识别失败: ${err.message}`;
    } finally {
      // 确保状态正确
      this.isListening.value = false;

      // 延迟解锁操作
      setTimeout(() => {
        this.isLocked.value = false;
      }, 1000);
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
