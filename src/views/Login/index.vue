<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="app-title">智能雨刷系统</h1>

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

        <!-- 添加记住密码选项 -->
        <div class="remember-me">
          <label class="checkbox-container">
            <input type="checkbox" v-model="rememberPassword">
            <span class="checkbox-text">记住密码</span>
          </label>
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

      <!-- 提示信息 -->
      <p class="footer-text">© 2023 智能雨刷系统 · 版权所有</p>
    </div>

    <div class="background-decoration"></div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { get, post } from '@/services/api'  // 导入API服务
import { isNative } from '@/utils/platform'  // 导入平台检测工具
import oneNetService from '@/services/oneNetService'  // 导入OneNet服务

export default {
  name: 'LoginPage',
  setup() {
    const router = useRouter()
    const mode = ref('login')
    const username = ref('')
    const password = ref('')
    const confirmPassword = ref('')
    const errorMessage = ref('')
    const rememberPassword = ref(false)

    // 从本地存储加载保存的登录信息
    onMounted(() => {
      // 检查用户是否已登录，如果已登录直接进入控制页面
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser)
          if (userData && userData.user_id) {
            console.log('检测到用户已登录，自动跳转到控制页面')
            router.push('/home')
            return // 直接返回，不执行后续代码
          }
        } catch (e) {
          console.error('解析用户数据出错:', e)
          // 出错时清除可能损坏的数据
          localStorage.removeItem('user')
        }
      }

      // 检查是否有保存的登录信息
      const savedCredentials = localStorage.getItem('saved_credentials')
      if (savedCredentials) {
        try {
          const credentials = JSON.parse(savedCredentials)
          username.value = credentials.username || ''
          password.value = credentials.password || ''
          rememberPassword.value = true
        } catch (e) {
          console.error('解析保存的登录凭证出错:', e)
          // 出错时清除可能损坏的数据
          localStorage.removeItem('saved_credentials')
        }
      }
    })

    const handleLogin = async () => {
      try {
        errorMessage.value = ''

        // 严格的表单验证
        if (!username.value || username.value.trim() === '') {
          errorMessage.value = '用户名不能为空'
          return
        }

        if (!password.value || password.value.trim() === '') {
          errorMessage.value = '密码不能为空'
          return
        }

        // 准备登录数据
        const loginData = {
          username: username.value.trim(),
          password: password.value.trim()
        }

        console.log('准备登录:', {
          username: loginData.username,
          passwordLength: loginData.password.length,
          isNative: isNative()
        })

        // 先测试服务器连接
        if (isNative()) {
          console.log('原生应用：测试服务器连接...')
          try {
            const testResponse = await get('/api/auth/verify')
            console.log('服务器连接测试结果:', testResponse.status)
            if (!testResponse.ok && testResponse.status !== 401) {
              throw new Error(`服务器连接失败: ${testResponse.status}`)
            }
          } catch (testError) {
            console.error('服务器连接测试失败:', testError)
            errorMessage.value = '无法连接到服务器，请检查网络连接和服务器状态'
            return
          }
        }

        // 发送登录请求
        console.log('发送登录请求...')
        const response = await post('/api/auth/login', loginData)

        console.log('登录响应:', response)

        if (response.ok) {
          const data = await response.json()
          console.log('登录成功, 用户数据:', data)

          // 存储用户信息
          const userData = {
            user_id: data.user_id,
            username: data.username
          };

          // 如果是原生应用且返回了token，保存token
          if (isNative() && data.token) {
            userData.token = data.token;
            userData.auth_type = 'token';
            console.log('[登录页面] 原生应用保存token认证信息');
          } else if (data.auth_type === 'session') {
            userData.auth_type = 'session';
            console.log('[登录页面] Web应用使用session认证');
          }

          console.log('[登录页面] 存储到localStorage的用户信息:', userData);
          localStorage.setItem('user', JSON.stringify(userData));

          // 确认存储后的数据
          const storedUserData = localStorage.getItem('user');
          console.log('[登录页面] 存储后立即从 localStorage 读取的用户信息:', storedUserData);
          try {
            const parsedUserData = JSON.parse(storedUserData);
            console.log('[登录页面] 解析后的用户信息:', parsedUserData);
            console.log('[登录页面] 存储的用户名:', parsedUserData.username);
          } catch (e) {
            console.error('[登录页面] 解析存储的用户信息出错:', e);
          }

          // 处理记住密码功能
          if (rememberPassword.value) {
            localStorage.setItem('saved_credentials', JSON.stringify({
              username: username.value.trim(),
              password: password.value.trim()
            }))
          } else {
            // 如果不记住密码，则清除之前保存的凭证
            localStorage.removeItem('saved_credentials')
          }

          router.push('/home')
        } else {
          const errorData = await response.json()
          console.error('登录失败:', errorData)

          errorMessage.value = errorData.error || (
            response.status === 500
              ? '服务器内部错误，请稍后重试'
              : '登录失败，请检查用户名和密码'
          )
        }
      } catch (error) {
        console.error('登录过程错误:', error)
        errorMessage.value = `网络错误: ${error.message || '请检查网络连接'}`
      }
    }

    const handleRegister = async () => {
      if (password.value !== confirmPassword.value) {
        errorMessage.value = '两次输入的密码不一致'
        return
      }

      try {
        errorMessage.value = ''

        // 使用API服务发送注册请求
        const response = await post('/api/auth/register', {
          username: username.value,
          password: password.value
        })

        const data = await response.json()

        if (response.ok) {
          // 注册成功，为用户创建OneNet数据流
          console.log(`为新用户 ${username.value} 创建OneNet数据流`)
          try {
            const datastreamResult = await oneNetService.createDatastreamForUser(username.value)
            if (datastreamResult.success) {
              console.log('OneNet数据流创建成功:', datastreamResult)
            } else {
              console.warn('OneNet数据流创建失败，但不影响注册:', datastreamResult.error)
            }
          } catch (error) {
            console.warn('创建OneNet数据流时出错，但不影响注册:', error)
          }

          // 切换到登录模式
          mode.value = 'login'
          username.value = ''
          password.value = ''
          confirmPassword.value = ''
          alert('注册成功，已为您创建专属设备，请登录')
        } else {
          errorMessage.value = data.error || '注册失败，用户名可能已被占用'
        }
      } catch (error) {
        console.error('注册错误:', error)
        errorMessage.value = '网络错误，请检查网络连接后重试'
      }
    }

    return {
      mode,
      username,
      password,
      confirmPassword,
      errorMessage,
      rememberPassword,
      handleLogin,
      handleRegister
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/assets/css/global.scss";

.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f8f9fa;
  padding: var(--spacing-lg);
  position: relative;
  overflow: hidden;

  .background-decoration {
    position: absolute;
    top: -10%;
    left: -10%;
    width: 120%;
    height: 120%;
    background: linear-gradient(135deg, rgba(66, 133, 244, 0.05) 0%, rgba(52, 168, 83, 0.05) 100%);
    opacity: 0.8;
    z-index: 0;
    pointer-events: none;
    background-image: radial-gradient(circle, rgba(66, 133, 244, 0.1) 2px, transparent 2px);
    background-size: 24px 24px;
  }

  .login-card {
    background: white;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-xl);
    width: 95%;
    max-width: none;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 1;

    .app-title {
      text-align: center;
      margin-bottom: var(--spacing-xl);
      font-size: var(--font-size-xxl);
      font-weight: 600;
      color: var(--primary-color);
    }
  }

  .mode-switch {
    display: flex;
    margin-bottom: var(--spacing-xl);
    border-radius: var(--border-radius-md);
    overflow: hidden;
    background-color: #f5f5f5;
    padding: var(--spacing-xs);

    .switch-btn {
      flex: 1;
      padding: var(--spacing-sm) var(--spacing-md);
      background: transparent;
      border: none;
      color: var(--primary-color);
      font-size: var(--font-size-md);
      cursor: pointer;
      transition: all 0.3s ease;
      border-radius: var(--border-radius-sm);

      &.active {
        background: var(--primary-color);
        color: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.08);
      }

      &:hover:not(.active) {
        background: rgba(66, 133, 244, 0.1);
      }
    }
  }

  .login-form {
    .form-group {
      margin-bottom: var(--spacing-lg);
      position: relative;

      label {
        display: block;
        margin-bottom: var(--spacing-xs);
        color: #757575;
        font-weight: 400;
        font-size: var(--font-size-md);
      }

      .input-wrapper {
        position: relative;

        .input-icon {
          position: absolute;
          left: var(--spacing-sm);
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 24px;
          opacity: 0.6;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          color: var(--primary-color);

          &.user-icon {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234285f4'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'%3E%3C/path%3E%3C/svg%3E");
          }

          &.lock-icon {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234285f4'%3E%3Cpath d='M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'%3E%3C/path%3E%3C/svg%3E");
          }
        }

        input {
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md) var(--spacing-xs) calc(var(--spacing-md) * 2);
          border: none;
          border-bottom: 2px solid #e0e0e0;
          font-size: var(--font-size-md);
          transition: all 0.2s;
          background-color: transparent;
          border-radius: 0;

          &:focus {
            outline: none;
            border-bottom-width: 3px;
            padding-bottom: calc(var(--spacing-xs) - 1px);
          }

          &:not(:placeholder-shown) {
            border-bottom-color: var(--primary-color);
          }
        }

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 3px;
          background-color: var(--primary-color);
          transition: width 0.3s ease;
        }

        input:focus + &::after {
          width: 100%;
        }
      }
    }

    .error-message {
      color: var(--danger-color);
      margin-bottom: var(--spacing-md);
      font-size: var(--font-size-sm);
      padding: var(--spacing-sm);
      background-color: rgba(234, 67, 53, 0.08);
      border-radius: var(--border-radius-sm);
      text-align: center;
    }

    .remember-me {
      display: flex;
      align-items: center;
      margin: var(--spacing-md) 0;

      .checkbox-container {
        display: flex;
        align-items: center;
        cursor: pointer;
        user-select: none;

        input[type="checkbox"] {
          margin-right: var(--spacing-xs);
          width: 18px;
          height: 18px;
          accent-color: var(--primary-color);
        }

        .checkbox-text {
          font-size: var(--font-size-sm);
          color: #666;
        }
      }
    }

    .btn-submit {
      width: 100%;
      padding: var(--spacing-md);
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: var(--border-radius-md);
      font-size: var(--font-size-md);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: var(--spacing-lg);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);

      &:hover {
        background: #3367d6;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }

      &:active {
        transform: translateY(1px);
      }
    }
  }

  .footer-text {
    text-align: center;
    margin-top: var(--spacing-lg);
    font-size: var(--font-size-sm);
    color: #757575;
  }

  /* 移动端样式 */
  @media screen and (max-width: 380px) {
    padding: var(--spacing-sm);

    .login-card {
      padding: var(--spacing-md);
      width: 100%;
    }
  }

  /* 浏览器中的样式优化 */
  @media screen and (min-width: 768px) {
    .login-card {
      max-width: 600px;
      padding: var(--spacing-xl);

      .app-title {
        font-size: var(--font-size-xxl);
        margin-bottom: var(--spacing-xl);
      }
    }

    .mode-switch {
      margin-bottom: var(--spacing-xl);

      .switch-btn {
        padding: var(--spacing-md) var(--spacing-lg);
        font-size: var(--font-size-md);
      }
    }

    .login-form {
      .form-group {
        margin-bottom: var(--spacing-xl);

        label {
          font-size: var(--font-size-md);
        }

        .input-wrapper {
          .input-icon {
            width: 28px;
            height: 28px;
          }

          input {
            padding: var(--spacing-md) var(--spacing-lg) var(--spacing-sm) calc(var(--spacing-lg) * 1.5);
            font-size: var(--font-size-md);
          }
        }
      }

      .btn-submit {
        padding: var(--spacing-md);
        font-size: var(--font-size-md);
      }
    }
  }

  /* 大屏幕浏览器优化 */
  @media screen and (min-width: 1024px) {
    .login-card {
      max-width: 700px;
      padding: var(--spacing-xxl);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }

    .app-title {
      font-size: calc(var(--font-size-xxl) * 1.2);
    }

    .background-decoration {
      background-size: 30px 30px;
    }
  }

  /* 添加浏览器特定的悬停效果 */
  @media (hover: hover) and (pointer: fine) {
    .btn-submit:hover {
      transform: translateY(-3px);
    }

    .switch-btn:hover:not(.active) {
      transform: translateY(-2px);
    }
  }
}
</style>