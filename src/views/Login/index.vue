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
import { post } from '@/services/api'  // 导入API服务
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

        // 发送登录请求
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

    .remember-me {
      display: flex;
      align-items: center;
      margin-top: calc(var(--spacing-md) - 5px);
      margin-bottom: calc(var(--spacing-md) - 5px);

      .checkbox-container {
        display: flex;
        align-items: center;
        cursor: pointer;
        user-select: none;

        input[type="checkbox"] {
          margin-right: 8px;
          width: 16px;
          height: 16px;
          accent-color: var(--primary-color);
        }

        .checkbox-text {
          font-size: clamp(14px, 0.9vw + 0.4rem, 18px);
          color: #666;
        }
      }
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

  /* 移动端样式 - 保持不变 */
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

  /* 浏览器中的样式优化 */
  @media screen and (min-width: 768px) {
    .login-card {
      max-width: 800px; /* 显著增大最大宽度 */
      padding: 60px;
      border-radius: 12px;
      box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);

      .app-title {
        font-size: 42px; /* 显著增大字体大小 */
        margin-bottom: 50px;
      }
    }

    .mode-switch {
      margin-bottom: 50px;

      .switch-btn {
        padding: 20px 30px;
        font-size: 22px; /* 显著增大字体大小 */
        border-radius: 8px;
      }
    }

    .login-form {
      .form-group {
        margin-bottom: 45px;

        label {
          font-size: 22px; /* 显著增大字体大小 */
          margin-bottom: 15px;
        }

        .input-wrapper {
          .input-icon {
            width: 32px; /* 显著增大图标大小 */
            height: 32px;
            left: 15px;
          }

          input {
            padding: 22px 20px 18px 60px; /* 显著增大内边距 */
            font-size: 22px; /* 显著增大字体大小 */
            border-bottom-width: 3px;
          }
        }
      }

      .error-message {
        font-size: 18px;
        padding: 12px;
        margin-bottom: 20px;
      }

      .remember-me {
        margin: 25px 0;

        .checkbox-container {
          input[type="checkbox"] {
            width: 22px; /* 显著增大复选框大小 */
            height: 22px;
            margin-right: 12px;
          }

          .checkbox-text {
            font-size: 20px;
          }
        }
      }

      .btn-submit {
        padding: 22px;
        font-size: 22px;
        border-radius: 8px;
        margin-top: 45px;
        letter-spacing: 1px;
      }
    }
  }

  /* 大屏幕浏览器优化 */
  @media screen and (min-width: 1200px) {
    .login-card {
      max-width: 900px; /* 显著增大宽度 */
      padding: 70px;
    }

    /* 优化背景装饰 */
    .background-decoration {
      background-size: 40px 40px; /* 显著增大背景图案大小 */
      opacity: 0.6; /* 降低不透明度，使其更加美观 */
    }

    /* 大屏幕上的元素进一步增大 */
    .app-title {
      font-size: 48px !important;
      margin-bottom: 60px !important;
    }

    .mode-switch .switch-btn {
      padding: 24px 36px;
      font-size: 24px;
    }

    .login-form {
      .form-group {
        margin-bottom: 55px;

        label {
          font-size: 24px;
          margin-bottom: 18px;
        }
      }

      .input-wrapper {
        .input-icon {
          width: 36px;
          height: 36px;
          left: 18px;
        }

        input {
          padding: 26px 24px 22px 70px;
          font-size: 24px;
          border-bottom-width: 3px;
        }
      }

      .remember-me .checkbox-container {
        .checkbox-text {
          font-size: 22px;
        }

        input[type="checkbox"] {
          width: 24px;
          height: 24px;
          margin-right: 14px;
        }
      }

      .btn-submit {
        padding: 26px;
        font-size: 24px;
        margin-top: 55px;
        letter-spacing: 1.5px;
      }
    }
  }

  /* 超大屏幕优化 */
  @media screen and (min-width: 1600px) {
    .login-card {
      max-width: 1000px; /* 超大屏幕上的最大宽度 */
      padding: 80px;
    }

    .app-title {
      font-size: 52px !important;
    }

    /* 增强视觉效果 */
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  }

  /* 添加浏览器特定的悬停效果 */
  @media (hover: hover) and (pointer: fine) {
    .btn-submit:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 16px rgba(98, 0, 238, 0.25);
    }

    .switch-btn:hover:not(.active) {
      background: rgba(98, 0, 238, 0.15);
      transform: translateY(-2px);
    }
  }
}
</style>