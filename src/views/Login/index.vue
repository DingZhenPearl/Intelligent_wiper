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
  background: #f5f5f5; // 安卓风格的浅灰背景
  padding: 16px;
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
    // Material Design风格的点阵背景
    background-image: radial-gradient(circle, rgba(98, 0, 238, 0.1) 2px, transparent 2px);
    background-size: 24px 24px;
  }

  .login-card {
    background: white;
    border-radius: 8px;
    padding: 30px; // 增加内边距从24px到30px
    width: 100%;
    max-width: 520px; // 大幅增加最大宽度从420px到520px
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23); // 增强阴影效果
    position: relative;
    z-index: 1;
    
    .app-title {
      text-align: center;
      margin-bottom: 28px; // 增加间距
      font-size: 28px; // 增大标题字体
      font-weight: 500; // Material Design标题字重
      color: #6200ee; // 安卓主色调
    }
  }
  
  .mode-switch {
    display: flex;
    margin-bottom: 24px;
    border-radius: 4px;
    overflow: hidden;
    background-color: #f5f5f5; // 安卓常用的轻灰色背景
    padding: 2px;

    .switch-btn {
      flex: 1;
      padding: 12px; // 增大按钮内边距
      background: transparent;
      border: none;
      color: #6200ee; // 安卓主色
      font-size: 18px; // 增大按钮字体
      cursor: pointer;
      transition: all 0.2s ease; // 更快的过渡效果
      border-radius: 4px;

      &.active {
        background: #6200ee; // 安卓主色
        color: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24); // Material Design按钮阴影
      }

      &:hover:not(.active) {
        background: rgba(98, 0, 238, 0.08); // 微弱的悬停效果，符合Material Design
      }
    }
  }

  .login-form {
    .form-group {
      margin-bottom: 24px; // 增加表单项间距
      position: relative; // 为下划线定位做准备

      label {
        display: block;
        margin-bottom: 10px; // 增加标签下方间距
        color: #757575; // Material Design的次要文本颜色
        font-weight: 400;
        font-size: 16px; // 增大标签字体
      }
      
      .input-wrapper {
        position: relative;
        
        .input-icon {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 26px; // 增大图标尺寸
          height: 26px;
          opacity: 0.6;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          color: #6200ee; // 安卓主色
          
          &.user-icon {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236200ee'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'%3E%3C/path%3E%3C/svg%3E");
          }
          
          &.lock-icon {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236200ee'%3E%3Cpath d='M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'%3E%3C/path%3E%3C/svg%3E");
          }
        }

        input {
          width: 100%;
          padding: 14px 14px 10px 36px; // 增大输入框内边距
          border: none; // 移除边框
          border-bottom: 1px solid #e0e0e0; // 只保留底部边框，符合Material Design
          font-size: 18px; // 增大输入框字体
          transition: all 0.2s;
          background-color: transparent; // 透明背景
          border-radius: 0; // 移除圆角，Material Design输入框通常是平的

          &:focus {
            outline: none;
            border-bottom: 2px solid #6200ee; // 聚焦时加粗下划线
            padding-bottom: 9px; // 调整聚焦时下方内边距
          }
          
          // 添加输入动画
          &:not(:placeholder-shown) {
            border-bottom-color: #6200ee;
          }
        }

        // 添加下划线动画效果
        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 2px;
          background-color: #6200ee;
          transition: width 0.3s ease;
        }
        
        input:focus + &::after {
          width: 100%;
        }
      }
    }

    .error-message {
      color: #b00020; // Material Design错误色
      margin-bottom: 16px;
      font-size: 14px;
      padding: 8px;
      background-color: rgba(176, 0, 32, 0.08); // 淡化的错误背景
      border-radius: 4px;
      text-align: center;
    }

    .btn-submit {
      width: 100%;
      padding: 14px; // 增大按钮高度
      background: #6200ee; // 安卓主色
      color: white;
      border: none;
      border-radius: 4px; // Material Design按钮圆角
      font-size: 18px; // 增大按钮字体
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s; // 更快的过渡
      margin-top: 28px; // 增大按钮上方间距
      text-transform: uppercase; // Material Design按钮通常使用大写
      letter-spacing: 0.5px; // 字间距
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24); // Material Design阴影

      &:hover {
        background: #7928f5; // 稍亮的色调
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23); // 更强的阴影
      }
      
      &:active {
        background: #5000d1; // 稍暗的色调
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12); // 按下时减弱阴影
        transform: translateY(1px); // 轻微下沉效果
      }
    }
  }
  
  .footer-text {
    text-align: center;
    margin-top: 28px; // 增大底部间距
    font-size: 14px; // 增大版权信息字体
    color: #757575; // Material Design次要文字颜色
  }

  @media screen and (max-width: 480px) {
    padding: 16px; // 增大外边距

    .login-card {
      padding: 24px; // 增大内边距
      width: 94%; // 略微增加宽度占比
      max-width: none; // 在小屏幕上移除最大宽度限制
      
      .app-title {
        font-size: 24px;
        margin-bottom: 20px;
      }
    }

    .login-form {
      .form-group {
        margin-bottom: 16px;

        .input-wrapper input {
          font-size: 16px; // 保持16px确保移动设备不会自动缩放
        }
      }

      .btn-submit {
        padding: 10px;
      }
    }
  }

  // 添加大屏幕适配
  @media screen and (min-width: 768px) {
    .login-card {
      max-width: 600px; // 在大屏幕上大幅增加登录框宽度
      padding: 36px; // 大屏幕上进一步增大内边距
    }
  }
}
</style>