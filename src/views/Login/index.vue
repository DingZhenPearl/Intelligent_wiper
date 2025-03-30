<template>
  <div class="login-container">
    <div class="login-card">
      <h2>登录</h2>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            type="text"
            id="username"
            v-model="username"
            placeholder="请输入用户名"
            required
          />
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input
            type="password"
            id="password"
            v-model="password"
            placeholder="请输入密码"
            required
          />
        </div>
        <div class="error-message" v-if="errorMessage">
          {{ errorMessage }}
        </div>
        <button type="submit" class="btn-login">登录</button>
      </form>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'LoginPage',
  setup() {
    const router = useRouter()
    const username = ref('')
    const password = ref('')
    const errorMessage = ref('')

    const handleLogin = () => {
      // 这里添加实际的登录逻辑
      if (username.value === 'admin' && password.value === 'admin') {
        errorMessage.value = ''
        router.push('/control')
      } else {
        errorMessage.value = '用户名或密码错误'
      }
    }

    return {
      username,
      password,
      errorMessage,
      handleLogin
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
  padding: var(--spacing-md);

  .login-card {
    background: white;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-xl);
    width: 100%;
    max-width: 400px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    h2 {
      text-align: center;
      margin-bottom: var(--spacing-lg);
      font-size: var(--font-size-xxl);
      font-weight: 600;
      color: #333;
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
        font-size: var(--font-size-lg);
      }

      input {
        width: 100%;
        padding: var(--spacing-md);
        border: 1px solid #ddd;
        border-radius: var(--border-radius-md);
        font-size: var(--font-size-lg);
        transition: border-color 0.3s;

        &:focus {
          outline: none;
          border-color: #1976D2;
        }
      }
    }

    .error-message {
      color: #f44336;
      margin-bottom: var(--spacing-md);
      font-size: var(--font-size-md);
    }

    .btn-login {
      width: 100%;
      padding: var(--spacing-md);
      background: #1976D2;
      color: white;
      border: none;
      border-radius: var(--border-radius-md);
      font-size: var(--font-size-lg);
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.3s;

      &:hover {
        background: #1565C0;
      }
    }
  }

  @media screen and (max-width: 480px) {
    padding: var(--spacing-sm);

    .login-card {
      padding: var(--spacing-lg);

      h2 {
        font-size: var(--font-size-xl);
        margin-bottom: var(--spacing-md);
      }
    }

    .login-form {
      .form-group {
        margin-bottom: var(--spacing-sm);

        label {
          font-size: var(--font-size-md);
        }

        input {
          padding: var(--spacing-sm);
          font-size: var(--font-size-md);
        }
      }

      .btn-login {
        padding: var(--spacing-sm);
        font-size: var(--font-size-md);
      }
    }
  }
}
</style>