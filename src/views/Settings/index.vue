<template>
  <div class="settings">
    <h2>设置界面</h2>

    <!-- 个人信息 -->
    <div class="section">
      <h3>个人信息</h3>
      <div class="user-info">
        <img :src="userAvatar" alt="用户头像" class="avatar">
        <div class="info-item">
          <label>用户名:</label>
          <span>{{ username }}</span>
        </div>
      </div>
    </div>

    <!-- 状态信息 -->
    <div class="section">
      <h3>状态信息</h3>
      <div class="status-list">
        <div class="status-item">
          <i class="icon-sensor"></i>
          <label>传感器状态:</label>
          <span class="status-normal">正常</span>
        </div>
        <div class="status-item">
          <i class="icon-motor"></i>
          <label>电机工作状态:</label>
          <span class="status-normal">正常</span>
        </div>
        <div class="status-item">
          <i class="icon-battery"></i>
          <label>电池电量:</label>
          <span class="status-normal">80%</span>
        </div>
        <div class="status-item">
          <i class="icon-network"></i>
          <label>网络连接状态:</label>
          <span class="status-normal">已连接</span>
        </div>
      </div>
    </div>

    <!-- 远程数据上传频率设置 -->
    <div class="section">
      <h3>远程数据上传频率设置</h3>
      <select v-model="uploadFrequency" class="frequency-select">
        <option value="1">每小时</option>
        <option value="2">每2小时</option>
        <option value="4">每4小时</option>
        <option value="6">每6小时</option>
        <option value="12">每12小时</option>
        <option value="24">每24小时</option>
      </select>
    </div>

    <!-- 服务器地址设置 (仅在安卓环境中显示) -->
    <div class="section" v-if="isAndroid">
      <h3>服务器地址设置</h3>
      <div class="server-address">
        <input
          type="text"
          v-model="serverAddress"
          placeholder="请输入服务器地址 (例如: http://192.168.1.100:3000)"
          class="server-input"
        />
        <div class="server-hint">
          请输入完整的服务器地址，包括协议(http://)和端口号
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="button-group">
      <button class="btn-save" @click="saveSettings">保存设置</button>
      <button class="btn-logout" @click="logout">退出登录</button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { post } from '@/services/api'  // 导入API服务
import authService from '@/services/authService'  // 导入认证服务
import { isAndroid as checkIsAndroid } from '@/utils/platform'  // 导入平台检测工具，重命名避免冲突

export default {
  name: 'SettingsPage',
  setup() {
    const router = useRouter()
    const uploadFrequency = ref('1')
    const userAvatar = ref('/src/assets/images/default-avatar.png')
    const username = ref('未登录')
    const serverAddress = ref('')
    const isAndroid = ref(false)

    // 在组件挂载时获取用户信息和检测平台
    onMounted(async () => {
      // 获取用户信息
      const currentUser = authService.getCurrentUser()
      if (currentUser && currentUser.username) {
        username.value = currentUser.username
      }

      // 检测是否为安卓平台
      isAndroid.value = checkIsAndroid()
      console.log(`[设置] 当前平台是否为安卓: ${isAndroid.value}`)

      // 如果是安卓平台，获取保存的服务器地址
      if (isAndroid.value) {
        const savedServerUrl = localStorage.getItem('serverUrl')
        if (savedServerUrl) {
          serverAddress.value = savedServerUrl
          console.log(`[设置] 已加载保存的服务器地址: ${serverAddress.value}`)
        }
      }
    })

    const saveSettings = () => {
      // 保存上传频率设置
      localStorage.setItem('uploadFrequency', uploadFrequency.value)

      // 如果是安卓平台，保存服务器地址
      if (isAndroid.value && serverAddress.value) {
        // 验证服务器地址格式
        if (!serverAddress.value.startsWith('http://') && !serverAddress.value.startsWith('https://')) {
          alert('服务器地址必须以http://或https://开头')
          return
        }

        // 保存服务器地址
        localStorage.setItem('serverUrl', serverAddress.value)
        console.log(`[设置] 已保存服务器地址: ${serverAddress.value}`)
      }

      alert('设置已保存')
    }

    const logout = async () => {
      try {
        // 1. 调用服务器登出API
        await post('/api/auth/logout')

        // 2. 只清除本地存储中的用户会话信息
        localStorage.removeItem('user')

        // 注意：不再清除saved_credentials，保留记住的密码
        console.log('用户已登出，但保留了记住的登录凭据')

        // 3. 导航到登录页面
        router.push('/login')
      } catch (error) {
        console.error('登出过程中出错:', error)
        // 即使出错也清除本地用户信息并重定向
        localStorage.removeItem('user')
        router.push('/login')
      }
    }

    return {
      uploadFrequency,
      userAvatar,
      username,
      serverAddress,
      isAndroid,
      saveSettings,
      logout
    }
  }
}
</script>

<style lang="scss" scoped>
.settings {
  padding: var(--spacing-md);
  background: #f5f5f5;
  min-height: 100vh;

  h2 {
    text-align: center;
    margin-bottom: var(--spacing-lg);
    font-size: var(--font-size-xxl);
    font-weight: 600;
  }

  .section {
    background: white;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);

    h3 {
      margin-bottom: var(--spacing-lg);
      font-size: var(--font-size-xl);
      font-weight: 500;
      color: #333;
    }
  }

  .user-info {
    .avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      margin-bottom: var(--spacing-md);
    }

    .info-item {
      margin: var(--spacing-sm) 0;
      font-size: var(--font-size-lg);

      label {
        color: #666;
        margin-right: var(--spacing-sm);
        font-weight: 500;
      }

      span {
        color: #333;
      }
    }
  }

  .status-list {
    .status-item {
      display: flex;
      align-items: center;
      margin: var(--spacing-md) 0;
      font-size: var(--font-size-lg);

      i {
        margin-right: var(--spacing-sm);
        font-size: var(--font-size-xl);
      }

      label {
        color: #666;
        margin-right: var(--spacing-sm);
        font-weight: 500;
      }

      .status-normal {
        color: #4CAF50;
        font-weight: 500;
      }
    }
  }

  .frequency-select {
    width: 100%;
    padding: var(--spacing-md);
    border: 1px solid #ddd;
    border-radius: var(--border-radius-md);
    font-size: var(--font-size-lg);
    color: #333;
  }

  .server-address {
    .server-input {
      width: 100%;
      padding: var(--spacing-md);
      border: 1px solid #ddd;
      border-radius: var(--border-radius-md);
      font-size: var(--font-size-lg);
      color: #333;
      margin-bottom: var(--spacing-sm);
    }

    .server-hint {
      font-size: var(--font-size-sm);
      color: #666;
      font-style: italic;
    }
  }

  .button-group {
    margin-top: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);

    button {
      width: 100%;
      padding: var(--spacing-md);
      border: none;
      border-radius: var(--border-radius-md);
      font-size: var(--font-size-lg);
      font-weight: 500;
      cursor: pointer;

      &.btn-save {
        background: #1976D2;
        color: white;

        &:hover {
          background: #1565C0;
        }
      }

      &.btn-logout {
        background: #f44336;
        color: white;

        &:hover {
          background: #d32f2f;
        }
      }
    }
  }
}
</style>