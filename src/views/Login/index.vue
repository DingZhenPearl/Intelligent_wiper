<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="app-title">智能雨刷系统</h1>
      
      <!-- 显示服务器状态 -->
      <div class="server-status" @click="showConfig = true">
        <span class="status-icon" :class="{ 'connected': isServerConnected }"></span>
        <span class="status-text">服务器: {{ serverStatusText }}</span>
      </div>
      
      <div class="mode-switch">
        <button 
          :class="['switch-btn', { active: mode === 'login' }]"
          @click="mode = 'login'"
        >登录</button>
        <button 
          :class="['switch-btn', { active: mode === 'register' }]"
          @click="mode = 'register'"
        >注册</button>
      </div>
      
      <!-- 登录表单 -->
      <form v-if="mode === 'login'" @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <div class="input-wrapper">
            <i class="input-icon user-icon"></i>
            <input
              type="text"
              id="username"
              v-model="username"
              placeholder="请输入用户名"
              required
            />
          </div>
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <div class="input-wrapper">
            <i class="input-icon lock-icon"></i>
            <input
              type="password"
              id="password"
              v-model="password"
              placeholder="请输入密码"
              required
            />
          </div>
        </div>
        <div class="error-message" v-if="errorMessage">
          {{ errorMessage }}
        </div>
        <button type="submit" class="btn-submit">登录</button>
      </form>
      
      <!-- 注册表单 -->
      <form v-else @submit.prevent="handleRegister" class="login-form">
        <div class="form-group">
          <label for="reg-username">用户名</label>
          <div class="input-wrapper">
            <i class="input-icon user-icon"></i>
            <input
              type="text"
              id="reg-username"
              v-model="username"
              placeholder="请输入用户名"
              required
            />
          </div>
        </div>
        <div class="form-group">
          <label for="reg-password">密码</label>
          <div class="input-wrapper">
            <i class="input-icon lock-icon"></i>
            <input
              type="password"
              id="reg-password"
              v-model="password"
              placeholder="请输入密码"
              required
            />
          </div>
        </div>
        <div class="form-group">
          <label for="confirm-password">确认密码</label>
          <div class="input-wrapper">
            <i class="input-icon lock-icon"></i>
            <input
              type="password"
              id="confirm-password"
              v-model="confirmPassword"
              placeholder="请再次输入密码"
              required
            />
          </div>
        </div>
        <div class="error-message" v-if="errorMessage">
          {{ errorMessage }}
        </div>
        <button type="submit" class="btn-submit">注册</button>
      </form>
      
      <!-- 服务器设置按钮 - 更明显的位置 -->
      <button @click="showConfig = true" class="server-config-btn">
        <span class="icon">⚙️</span> 服务器设置
      </button>
      
      <!-- 提示信息 -->
      <p class="footer-text">© 2023 智能雨刷系统 · 版权所有</p>
    </div>
    
    <div class="background-decoration"></div>
    
    <!-- 服务器配置弹窗 -->
    <div class="config-modal" v-if="showConfig">
      <div class="config-panel">
        <h3>服务器配置</h3>
        
        <div v-if="availableServers.length > 0" class="server-list">
          <p>推荐服务器地址：</p>
          <div 
            v-for="(server, index) in availableServers" 
            :key="index" 
            class="server-option"
            @click="selectServer(server)"
          >
            {{ server }}
          </div>
        </div>
        
        <div class="form-group">
          <label for="server-url">服务器地址:</label>
          <input 
            type="text" 
            id="server-url" 
            v-model="serverUrl" 
            placeholder="例如: 192.168.1.100:3000"
          />
        </div>
        
        <div class="button-group">
          <button @click="testConnection" class="btn-test">测试连接</button>
          <button @click="saveServerConfig" class="btn-save" :disabled="isConnecting">
            {{ isConnecting ? '连接中...' : '保存' }}
          </button>
          <button @click="showConfig = false" class="btn-cancel">取消</button>
        </div>
        
        <div v-if="connectionMessage" 
          :class="['connection-message', { 'success': connectionSuccess, 'error': !connectionSuccess }]">
          {{ connectionMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'LoginPage',
  setup() {
    const router = useRouter()
    const mode = ref('login')
    const username = ref('')
    const password = ref('')
    const confirmPassword = ref('')
    const errorMessage = ref('')
    
    // 服务器配置相关
    const showConfig = ref(false)
    const serverUrl = ref('')
    const isConnecting = ref(false)
    const connectionMessage = ref('')
    const connectionSuccess = ref(false)
    const isServerConnected = ref(false)
    const availableServers = ref([])
    
    // 服务器状态文本
    const serverStatusText = computed(() => {
      if (!serverUrl.value) return '未配置';
      return isServerConnected.value ? '已连接' : '未连接';
    })
    
    // 从本地存储加载服务器配置
    onMounted(() => {
      const savedUrl = localStorage.getItem('server_url')
      if (savedUrl) {
        serverUrl.value = savedUrl
        // 自动测试服务器连接
        testConnectionToServer(savedUrl)
      }
      
      // 尝试检测局域网中的服务器
      detectLocalServers()
    })
    
    // 检测局域网中的服务器
    const detectLocalServers = async () => {
      // 获取设备IP地址，通常形如192.168.x.y
      const ipPrefix = getLocalIpPrefix()
      if (ipPrefix) {
        const servers = []
        
        // 先添加默认的localhost
        servers.push('localhost:3000')
        
        // 添加特定的常用IP，比如主机的IP
        for (let i = 1; i <= 254; i++) {
          if (i % 50 === 0) {
            const ip = `${ipPrefix}.${i}:3000`
            servers.push(ip)
            
            // 测试这个IP是否可连接
            testConnectionToServer(ip, false).then(connected => {
              if (connected) {
                console.log(`找到可用服务器: ${ip}`)
                if (!availableServers.value.includes(ip)) {
                  availableServers.value.push(ip)
                }
              }
            })
          }
        }
      }
    }
    
    // 获取本地IP前缀
    const getLocalIpPrefix = () => {
      // 模拟获取IP前缀，实际应用中可能需要使用网络API
      // 这里简单假设一个常见的网络前缀
      return '192.168.1'
    }
    
    // 选择推荐的服务器
    const selectServer = (server) => {
      serverUrl.value = server
      testConnectionToServer(server)
    }
    
    // 保存服务器配置
    const saveServerConfig = () => {
      // 移除可能的http://前缀
      let url = serverUrl.value.replace(/^https?:\/\//, '')
      if (url) {
        localStorage.setItem('server_url', url)
        showConfig.value = false
        
        // 保存后重新测试连接
        testConnectionToServer(url)
      }
    }
    
    // 测试连接
    const testConnection = () => {
      // 移除可能的http://前缀
      let url = serverUrl.value.replace(/^https?:\/\//, '')
      if (url) {
        testConnectionToServer(url)
      } else {
        connectionMessage.value = '请输入服务器地址'
        connectionSuccess.value = false
      }
    }
    
    // 测试服务器连接
    const testConnectionToServer = async (serverUrl, showMessage = true) => {
      isConnecting.value = true
      if (showMessage) {
        connectionMessage.value = '正在连接服务器...'
      }
      
      try {
        const response = await fetch(`http://${serverUrl}/api/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors', // 确保启用CORS
          cache: 'no-cache', // 不缓存结果
          timeout: 5000 // 5秒超时
        })
        
        if (response.ok) {
          isServerConnected.value = true
          if (showMessage) {
            connectionSuccess.value = true
            connectionMessage.value = '服务器连接成功!'
          }
          return true
        } else {
          isServerConnected.value = false
          if (showMessage) {
            connectionSuccess.value = false
            connectionMessage.value = `服务器返回错误: ${response.status}`
          }
          return false
        }
      } catch (error) {
        console.error('连接测试错误:', error)
        isServerConnected.value = false
        if (showMessage) {
          connectionSuccess.value = false
          connectionMessage.value = `连接失败: ${error.message}`
        }
        return false
      } finally {
        isConnecting.value = false
      }
    }
    
    // 获取动态API地址
    const getApiBaseUrl = () => {
      const savedUrl = localStorage.getItem('server_url')
      if (savedUrl) {
        return `http://${savedUrl}/api/auth`
      } else {
        return 'http://localhost:3000/api/auth'
      }
    }

    const handleLogin = async () => {
      try {
        errorMessage.value = ''
        
        // 验证服务器连接
        const apiUrl = getApiBaseUrl()
        if (!isServerConnected.value) {
          // 尝试重新连接
          const serverAddress = apiUrl.replace('http://', '').replace('/api/auth', '')
          const connected = await testConnectionToServer(serverAddress, false)
          if (!connected) {
            errorMessage.value = '无法连接到服务器，请检查服务器设置'
            showConfig.value = true
            return
          }
        }
        
        if (!username.value || !password.value) {
          errorMessage.value = '用户名和密码不能为空'
          return
        }
        
        // 使用动态API地址
        const API_BASE_URL = getApiBaseUrl()
        console.log('使用API地址:', API_BASE_URL)
        
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            username: username.value,
            password: password.value
          })
        })

        const data = await response.json()
        
        console.log('登录响应:', response.status, data)

        if (response.ok) {
          // 存储用户信息并跳转
          localStorage.setItem('user', JSON.stringify({
            user_id: data.user_id,
            username: data.username
          }))
          router.push('/home')
        } else {
          errorMessage.value = data.error || (
            response.status === 500 
              ? '服务器内部错误，请稍后重试' 
              : '登录失败，请检查用户名和密码'
          )
        }
      } catch (error) {
        console.error('登录错误:', error)
        errorMessage.value = '网络错误，请检查服务器连接后重试'
        // 遇到网络错误自动打开服务器配置
        showConfig.value = true
      }
    }

    const handleRegister = async () => {
      if (password.value !== confirmPassword.value) {
        errorMessage.value = '两次输入的密码不一致'
        return
      }
      
      try {
        errorMessage.value = ''
        
        // 使用动态API地址
        const API_BASE_URL = getApiBaseUrl()
        
        const response = await fetch(`${API_BASE_URL}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // 添加此行以支持跨域cookie
          body: JSON.stringify({
            username: username.value,
            password: password.value
          })
        })

        const data = await response.json()

        if (response.ok) {
          // 注册成功，切换到登录模式
          mode.value = 'login'
          username.value = ''
          password.value = ''
          confirmPassword.value = ''
          alert('注册成功，请登录')
        } else {
          errorMessage.value = data.error || '注册失败，用户名可能已被占用'
        }
      } catch (error) {
        console.error('注册错误:', error)
        errorMessage.value = '网络错误，请检查服务器连接后重试'
      }
    }

    return {
      mode,
      username,
      password,
      confirmPassword,
      errorMessage,
      handleLogin,
      handleRegister,
      // 服务器配置相关
      showConfig,
      serverUrl,
      saveServerConfig,
      testConnection,
      isConnecting,
      connectionMessage,
      connectionSuccess,
      isServerConnected,
      serverStatusText,
      availableServers,
      selectServer
    }
  }
}
</script>

<style lang="scss" scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f5f5f5;
  padding: min(4vw, 30px); // 使用视口宽度的百分比，但设置上限
  position: relative;
  overflow: hidden;
  
  .background-decoration {
    position: absolute;
    top: -10%;
    left: -10%;
    width: 120%;
    height: 120%;
    background: linear-gradient(135deg, rgba(98, 0, 238, 0.05) 0%, rgba(63, 81, 181, 0.05) 100%);
    opacity: 0.8;
    z-index: 0;
    pointer-events: none;
    background-image: radial-gradient(circle, rgba(98, 0, 238, 0.1) 2px, transparent 2px);
    background-size: 24px 24px;
  }

  .login-card {
    background: white;
    border-radius: clamp(8px, 2vw, 30px);
    padding: max(3vw, 30px);
    width: 95%;
    max-width: none;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    position: relative;
    z-index: 1;
    
    .app-title {
      text-align: center;
      margin-bottom: max(3vw, 30px);
      font-size: calc(2.5vw + 24px);
      font-weight: 500;
      color: #6200ee;
    }
  }
  
  .mode-switch {
    display: flex;
    margin-bottom: clamp(20px, 3vw, 40px); // 响应式下边距
    border-radius: clamp(4px, 0.8vw, 10px);
    overflow: hidden;
    background-color: #f5f5f5;
    padding: clamp(2px, 0.5vw, 6px);

    .switch-btn {
      flex: 1;
      padding: clamp(10px, 1.5vw, 20px) clamp(8px, 1vw, 18px); // 响应式内边距
      background: transparent;
      border: none;
      color: #6200ee;
      font-size: clamp(16px, 1vw + 0.8rem, 26px); // 响应式字体大小
      cursor: pointer;
      transition: all 0.2s ease;
      border-radius: clamp(4px, 0.6vw, 8px);

      &.active {
        background: #6200ee;
        color: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
      }

      &:hover:not(.active) {
        background: rgba(98, 0, 238, 0.08);
      }
    }
  }

  .login-form {
    .form-group {
      margin-bottom: clamp(20px, 3vw, 45px); // 响应式下边距
      position: relative;

      label {
        display: block;
        margin-bottom: clamp(6px, 1vw, 15px); // 响应式下边距
        color: #757575;
        font-weight: 400;
        font-size: clamp(14px, 1vw + 0.5rem, 22px); // 响应式字体大小
      }
      
      .input-wrapper {
        position: relative;
        
        .input-icon {
          position: absolute;
          left: clamp(3px, 0.5vw, 8px);
          top: 50%;
          transform: translateY(-50%);
          width: clamp(24px, 2.5vw, 36px); // 响应式图标大小
          height: clamp(24px, 2.5vw, 36px);
          opacity: 0.6;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          color: #6200ee;
          
          &.user-icon {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236200ee'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'%3E%3C/path%3E%3C/svg%3E");
          }
          
          &.lock-icon {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236200ee'%3E%3Cpath d='M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'%3E%3C/path%3E%3C/svg%3E");
          }
        }

        input {
          width: 100%;
          padding: clamp(12px, 1.8vw, 24px) clamp(10px, 1.5vw, 22px) 
                  clamp(8px, 1.2vw, 18px) clamp(32px, 4vw, 55px); // 响应式内边距
          border: none;
          border-bottom: 2px solid #e0e0e0;
          font-size: clamp(16px, 1vw + 0.7rem, 24px); // 响应式字体大小
          transition: all 0.2s;
          background-color: transparent;
          border-radius: 0;
          border-bottom-width: clamp(1px, 0.2vw, 3px); // 响应式边框

          &:focus {
            outline: none;
            border-bottom-width: clamp(2px, 0.3vw, 4px);
            padding-bottom: calc(clamp(8px, 1.2vw, 18px) - 1px);
          }
          
          &:not(:placeholder-shown) {
            border-bottom-color: #6200ee;
          }
        }

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: clamp(2px, 0.3vw, 4px); // 响应式下划线高度
          background-color: #6200ee;
          transition: width 0.3s ease;
        }
        
        input:focus + &::after {
          width: 100%;
        }
      }
    }

    .error-message {
      color: #b00020;
      margin-bottom: 16px;
      font-size: clamp(14px, 0.8vw + 0.5rem, 18px);
      padding: clamp(6px, 1vw, 12px);
      background-color: rgba(176, 0, 32, 0.08);
      border-radius: 4px;
      text-align: center;
    }

    .btn-submit {
      width: 100%;
      padding: clamp(12px, 1.5vw, 22px); // 响应式按钮内边距
      background: #6200ee;
      color: white;
      border: none;
      border-radius: clamp(4px, 0.7vw, 10px);
      font-size: clamp(16px, 1vw + 0.7rem, 24px); // 响应式字体大小
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: clamp(20px, 3vw, 40px);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);

      &:hover {
        background: #7928f5;
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
      }
      
      &:active {
        background: #5000d1;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        transform: translateY(1px);
      }
    }
  }
  
  .footer-text {
    text-align: center;
    margin-top: clamp(20px, 3vw, 36px);
    font-size: clamp(12px, 0.8vw + 0.3rem, 18px);
    color: #757575;
    position: relative;
    
    .config-icon {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      font-size: 20px;
      opacity: 0.6;
      
      &:hover {
        opacity: 1;
      }
    }
  }

  .config-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    
    .config-panel {
      background: white;
      padding: 20px;
      border-radius: 8px;
      width: 85%;
      max-width: 400px;
      
      h3 {
        margin-top: 0;
        margin-bottom: 20px;
        color: #6200ee;
      }
      
      .form-group {
        margin-bottom: 20px;
        
        label {
          display: block;
          margin-bottom: 8px;
          color: #333;
        }
        
        input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          
          &:focus {
            outline: none;
            border-color: #6200ee;
          }
        }
      }
      
      .button-group {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        
        button {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          font-size: 14px;
          cursor: pointer;
          
          &.btn-save {
            background: #6200ee;
            color: white;
          }
          
          &.btn-cancel {
            background: #f5f5f5;
            color: #333;
          }
        }
      }
    }
  }

  @media screen and (max-width: 380px) {
    padding: 10px;

    .login-card {
      padding: 15px;
      width: 96%;
    }

    .form-group .input-wrapper input {
      font-size: 16px; // 确保在小屏设备上不会自动缩放
    }
  }
}

/* 增加服务器状态指示器 */
.server-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  margin-bottom: 15px;
  cursor: pointer;
  
  .status-icon {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #f44336; /* 红色表示未连接 */
    margin-right: 8px;
    
    &.connected {
      background-color: #4caf50; /* 绿色表示已连接 */
    }
  }
  
  .status-text {
    font-size: 14px;
    color: #666;
  }
}

/* 明显的服务器配置按钮 */
.server-config-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20px auto 0;
  padding: 10px 15px;
  background-color: #f5f5f5;
  border: none;
  border-radius: 4px;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s;
  
  .icon {
    margin-right: 8px;
  }
  
  &:hover {
    background-color: #e0e0e0;
  }
}

/* 改进配置弹窗样式 */
.config-modal {
  .config-panel {
    .server-list {
      margin-bottom: 20px;
      padding: 10px;
      background-color: #f9f9f9;
      border-radius: 4px;
      
      p {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: #333;
      }
      
      .server-option {
        padding: 8px 10px;
        border-radius: 4px;
        margin-bottom: 5px;
        background-color: #f0f0f0;
        cursor: pointer;
        font-size: 14px;
        
        &:hover {
          background-color: #e0e0e0;
        }
      }
    }
    
    .button-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      
      .btn-test {
        grid-column: 1 / span 2;
        background: #2196f3;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 4px;
        cursor: pointer;
        
        &:hover {
          background: #1e88e5;
        }
      }
    }
    
    .connection-message {
      margin-top: 15px;
      padding: 10px;
      border-radius: 4px;
      text-align: center;
      font-size: 14px;
      
      &.success {
        background-color: rgba(76, 175, 80, 0.2);
        color: #388e3c;
      }
      
      &.error {
        background-color: rgba(244, 67, 54, 0.2);
        color: #d32f2f;
      }
    }
  }
}
</style>