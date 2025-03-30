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
      
      <p class="footer-text">© 2023 智能雨刷系统 · 版权所有</p>
    </div>
    
    <div class="background-decoration"></div>
  </div>
</template>

<script>
import { ref } from 'vue'
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

    const handleLogin = async () => {
      try {
        // 模拟登录成功
        if (username.value === 'admin' && password.value === 'admin') {
          localStorage.setItem('user', JSON.stringify({ username: username.value }))
          router.push('/home')
          return
        }
        
        const response = await fetch('http://localhost:5000/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username.value,
            password: password.value
          })
        })

        const data = await response.json()

        if (response.ok) {
          errorMessage.value = ''
          localStorage.setItem('user', JSON.stringify(data.user))
          router.push('/home')
        } else {
          errorMessage.value = data.error || '登录失败，用户名或密码错误'
        }
      } catch (error) {
        console.error('登录错误:', error)
        errorMessage.value = '网络错误，请检查连接后重试'
      }
    }

    const handleRegister = async () => {
      if (password.value !== confirmPassword.value) {
        errorMessage.value = '两次输入的密码不一致'
        return
      }
      
      try {
        const response = await fetch('http://localhost:5000/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username.value,
            password: password.value
          })
        })

        const data = await response.json()

        if (response.ok) {
          errorMessage.value = ''
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
        errorMessage.value = '网络错误，请检查连接后重试'
      }
    }

    return {
      mode,
      username,
      password,
      confirmPassword,
      errorMessage,
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
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: var(--spacing-md);
  position: relative;
  overflow: hidden;
  
  .background-decoration {
    position: absolute;
    top: -10%;
    left: -10%;
    width: 120%;
    height: 120%;
    background: linear-gradient(135deg, rgba(245, 247, 250, 0.1) 0%, rgba(195, 207, 226, 0.1) 100%);
    /* 移除不存在的图像引用，改用纯CSS渐变背景 */
    /* background: url('/src/assets/images/pattern.svg') center/cover no-repeat; */
    opacity: 0.5;
    z-index: 0;
    pointer-events: none;
    /* 添加一些圆点作为背景装饰 */
    background-image: radial-gradient(circle, rgba(100, 100, 255, 0.1) 2px, transparent 2px);
    background-size: 30px 30px;
  }

  .login-card {
    background: white;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-xl);
    width: 100%;
    max-width: 420px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 1;
    
    .app-title {
      text-align: center;
      margin-bottom: var(--spacing-lg);
      font-size: var(--font-size-xxl);
      font-weight: 600;
      color: var(--primary-color);
    }
  }
  
  .mode-switch {
    display: flex;
    margin-bottom: var(--spacing-lg);
    border-radius: var(--border-radius-md);
    overflow: hidden;
    border: 1px solid var(--primary-color);

    .switch-btn {
      flex: 1;
      padding: var(--spacing-sm);
      background: transparent;
      border: none;
      color: var(--primary-color);
      font-size: var(--font-size-md);
      cursor: pointer;
      transition: all 0.3s;

      &.active {
        background: var(--primary-color);
        color: white;
      }

      &:hover:not(.active) {
        background: rgba(25, 118, 210, 0.1);
      }
    }
  }

  .login-form {
    .form-group {
      margin-bottom: var(--spacing-md);

      label {
        display: block;
        margin-bottom: var(--spacing-xs);
        color: #666;
        font-weight: 500;
        font-size: var(--font-size-md);
      }
      
      .input-wrapper {
        position: relative;
        
        .input-icon {
          position: absolute;
          left: var(--spacing-sm);
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          opacity: 0.6;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          
          &.user-icon {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234285f4'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'%3E%3C/path%3E%3C/svg%3E");
          }
          
          &.lock-icon {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234285f4'%3E%3Cpath d='M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'%3E%3C/path%3E%3C/svg%3E");
          }
        }

        input {
          width: 100%;
          padding: var(--spacing-md) var(--spacing-md) var(--spacing-md) calc(var(--spacing-sm) * 4);
          border: 1px solid #ddd;
          border-radius: var(--border-radius-md);
          font-size: var(--font-size-md);
          transition: all 0.3s;

          &:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
          }
        }
      }
    }

    .error-message {
      color: #f44336;
      margin-bottom: var(--spacing-md);
      font-size: var(--font-size-sm);
      padding: var(--spacing-xs);
      background-color: rgba(244, 67, 54, 0.1);
      border-radius: var(--border-radius-sm);
      text-align: center;
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
      transition: all 0.3s;
      margin-top: var(--spacing-md);

      &:hover {
        background: #3367d6;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      
      &:active {
        transform: translateY(0);
        box-shadow: none;
      }
    }
  }
  
  .footer-text {
    text-align: center;
    margin-top: var(--spacing-lg);
    font-size: var(--font-size-sm);
    color: #999;
  }

  @media screen and (max-width: 480px) {
    padding: var(--spacing-sm);

    .login-card {
      padding: var(--spacing-md);
      
      .app-title {
        font-size: var(--font-size-xl);
        margin-bottom: var(--spacing-md);
      }
    }

    .login-form {
      .form-group {
        margin-bottom: var(--spacing-sm);

        label {
          font-size: var(--font-size-sm);
        }

        .input-wrapper input {
          padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) calc(var(--spacing-sm) * 3.5);
          font-size: var(--font-size-sm);
        }
      }

      .btn-submit {
        padding: var(--spacing-sm);
        font-size: var(--font-size-md);
      }
    }
  }
}
</style>