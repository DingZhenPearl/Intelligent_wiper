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

    <!-- 设备激活 -->
    <div class="section">
      <h3>设备激活</h3>
      <div class="device-activation">
        <div class="activation-status">
          <div class="status-item">
            <i class="icon-device"></i>
            <label>设备状态:</label>
            <span :class="deviceStatus.class">{{ deviceStatus.text }}</span>
          </div>
          <div class="status-item" v-if="deviceInfo.deviceName">
            <i class="icon-name"></i>
            <label>设备名称:</label>
            <span class="device-name">{{ deviceInfo.deviceName }}</span>
          </div>
          <div class="status-item" v-if="deviceInfo.deviceId">
            <i class="icon-id"></i>
            <label>设备ID:</label>
            <span class="device-id">{{ deviceInfo.deviceId }}</span>
          </div>
          <div class="status-item" v-if="deviceInfo.activatedAt">
            <i class="icon-time"></i>
            <label>激活时间:</label>
            <span class="activation-time">{{ formatDate(deviceInfo.activatedAt) }}</span>
          </div>
        </div>

        <!-- 激活码输入区域 -->
        <div class="activation-input" v-if="!deviceInfo.isActivated">
          <div class="input-group">
            <label for="activationCode">激活码:</label>
            <input
              id="activationCode"
              type="text"
              v-model="activationCode"
              placeholder="请输入设备激活码"
              class="activation-code-input"
              :disabled="activationLoading"
            />
          </div>
          <div class="activation-hint">
            <p>💡 激活码说明：</p>
            <ul>
              <li>激活码由硬件厂商提供，通常印在设备包装上</li>
              <li>每个激活码只能使用一次</li>
              <li>激活后设备将与您的账号绑定</li>
              <li>激活码格式：XXXX-XXXX-XXXX-XXXX</li>
            </ul>
          </div>
          <button
            class="btn-activate"
            @click="activateDevice"
            :disabled="!activationCode.trim() || activationLoading"
          >
            <span v-if="activationLoading">激活中...</span>
            <span v-else>激活设备</span>
          </button>
        </div>

        <!-- 已激活设备信息 -->
        <div class="activated-info" v-if="deviceInfo.isActivated">
          <div class="success-message">
            <i class="icon-success">✅</i>
            <span>设备已成功激活并绑定到您的账号</span>
          </div>
          <div class="device-details">
            <div class="detail-item">
              <label>硬件序列号:</label>
              <span>{{ deviceInfo.serialNumber || '未知' }}</span>
            </div>
            <div class="detail-item">
              <label>设备型号:</label>
              <span>{{ deviceInfo.deviceModel || '智能雨刷控制器' }}</span>
            </div>
            <div class="detail-item">
              <label>固件版本:</label>
              <span>{{ deviceInfo.firmwareVersion || 'v1.0.0' }}</span>
            </div>
          </div>
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
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { post, get } from '@/services/api'  // 导入API服务
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

    // 设备激活相关状态
    const activationCode = ref('')
    const activationLoading = ref(false)
    const deviceInfo = ref({
      isActivated: false,
      deviceId: null,
      deviceName: null,
      serialNumber: null,
      deviceModel: null,
      firmwareVersion: null,
      activatedAt: null
    })

    // 计算设备状态显示
    const deviceStatus = computed(() => {
      if (deviceInfo.value.isActivated) {
        return {
          text: '已激活',
          class: 'status-activated'
        }
      } else {
        return {
          text: '未激活',
          class: 'status-not-activated'
        }
      }
    })

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // 获取设备激活状态
    const loadDeviceInfo = async () => {
      try {
        console.log(`[设置] 获取用户 ${username.value} 的设备激活状态`)
        const response = await get(`/api/device/activation/status?username=${encodeURIComponent(username.value)}`)

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            deviceInfo.value = {
              isActivated: data.isActivated || false,
              deviceId: data.deviceId || null,
              deviceName: data.deviceName || null,
              serialNumber: data.serialNumber || null,
              deviceModel: data.deviceModel || null,
              firmwareVersion: data.firmwareVersion || null,
              activatedAt: data.activatedAt || null
            }
            console.log('[设置] 设备信息加载成功:', deviceInfo.value)
          } else {
            console.warn('[设置] 获取设备状态失败:', data.error)
          }
        }
      } catch (error) {
        console.error('[设置] 获取设备状态错误:', error)
      }
    }

    // 激活设备
    const activateDevice = async () => {
      if (!activationCode.value.trim()) {
        alert('请输入激活码')
        return
      }

      // 验证激活码格式（XXXX-XXXX-XXXX-XXXX）
      const codePattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
      if (!codePattern.test(activationCode.value.toUpperCase())) {
        alert('激活码格式不正确，请输入格式为 XXXX-XXXX-XXXX-XXXX 的激活码')
        return
      }

      activationLoading.value = true

      try {
        console.log(`[设置] 开始激活设备，用户: ${username.value}, 激活码: ${activationCode.value}`)
        console.log('🔥 [设置] 调用真实的OneNET设备激活API')

        const response = await post('/api/device/activation/activate', {
          username: username.value,
          activationCode: activationCode.value.toUpperCase()
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            // 激活成功，更新设备信息
            deviceInfo.value = {
              isActivated: true,
              deviceId: data.deviceId,
              deviceName: data.deviceName,
              serialNumber: data.serialNumber,
              deviceModel: data.deviceModel || '智能雨刷控制器',
              firmwareVersion: data.firmwareVersion || 'v1.0.0',
              activatedAt: data.activatedAt || new Date().toISOString()
            }

            // 清空激活码
            activationCode.value = ''

            alert(`🎉 设备激活成功！\n设备名称: ${data.deviceName}\n设备ID: ${data.deviceId}\n设备已在OneNET平台创建并与您的账号绑定。`)
            console.log('[设置] 设备激活成功:', deviceInfo.value)
          } else {
            let errorMessage = data.error || '未知错误'
            if (data.details) {
              errorMessage += `\n详细信息: ${data.details}`
            }
            alert(`激活失败：${errorMessage}`)
            console.error('[设置] 设备激活失败:', data)
          }
        } else {
          const errorData = await response.json()
          let errorMessage = errorData.error || '网络错误'
          if (errorData.details) {
            errorMessage += `\n详细信息: ${errorData.details}`
          }
          alert(`激活失败：${errorMessage}`)
          console.error('[设置] 设备激活请求失败:', errorData)
        }
      } catch (error) {
        console.error('[设置] 设备激活错误:', error)
        alert(`激活失败：${error.message}`)
      } finally {
        activationLoading.value = false
      }
    }

    // 在组件挂载时获取用户信息和检测平台
    onMounted(async () => {
      // 获取用户信息
      const currentUser = authService.getCurrentUser()
      if (currentUser && currentUser.username) {
        username.value = currentUser.username
        // 加载设备激活状态
        await loadDeviceInfo()
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
      // 设备激活相关
      activationCode,
      activationLoading,
      deviceInfo,
      deviceStatus,
      formatDate,
      activateDevice,
      // 原有方法
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

  // 设备激活样式
  .device-activation {
    .activation-status {
      margin-bottom: var(--spacing-lg);

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
          min-width: 100px;
        }

        .status-activated {
          color: #4CAF50;
          font-weight: 600;
        }

        .status-not-activated {
          color: #ff9800;
          font-weight: 600;
        }

        .device-id {
          font-family: monospace;
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: var(--font-size-sm);
        }

        .activation-time {
          color: #666;
          font-size: var(--font-size-sm);
        }
      }
    }

    .activation-input {
      border: 2px dashed #ddd;
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-lg);
      margin: var(--spacing-lg) 0;
      background: #fafafa;

      .input-group {
        margin-bottom: var(--spacing-lg);

        label {
          display: block;
          margin-bottom: var(--spacing-sm);
          font-weight: 600;
          color: #333;
        }

        .activation-code-input {
          width: 100%;
          padding: var(--spacing-md);
          border: 2px solid #ddd;
          border-radius: var(--border-radius-md);
          font-size: var(--font-size-lg);
          font-family: monospace;
          text-transform: uppercase;
          letter-spacing: 2px;
          text-align: center;

          &:focus {
            outline: none;
            border-color: #1976D2;
            box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
          }

          &:disabled {
            background: #f5f5f5;
            cursor: not-allowed;
          }
        }
      }

      .activation-hint {
        background: #e3f2fd;
        border: 1px solid #bbdefb;
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-lg);

        p {
          margin: 0 0 var(--spacing-sm) 0;
          font-weight: 600;
          color: #1976D2;
        }

        ul {
          margin: 0;
          padding-left: var(--spacing-lg);

          li {
            margin: var(--spacing-xs) 0;
            color: #666;
            font-size: var(--font-size-sm);
          }
        }
      }

      .btn-activate {
        width: 100%;
        padding: var(--spacing-md);
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: var(--border-radius-md);
        font-size: var(--font-size-lg);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover:not(:disabled) {
          background: #45a049;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
        }

        &:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      }
    }

    .activated-info {
      border: 2px solid #4CAF50;
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-lg);
      background: #f1f8e9;

      .success-message {
        display: flex;
        align-items: center;
        margin-bottom: var(--spacing-lg);
        padding: var(--spacing-md);
        background: #4CAF50;
        color: white;
        border-radius: var(--border-radius-md);

        .icon-success {
          margin-right: var(--spacing-sm);
          font-size: var(--font-size-xl);
        }

        span {
          font-weight: 600;
        }
      }

      .device-details {
        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: var(--spacing-sm) 0;
          padding: var(--spacing-sm) 0;
          border-bottom: 1px solid #e0e0e0;

          &:last-child {
            border-bottom: none;
          }

          label {
            font-weight: 600;
            color: #333;
          }

          span {
            color: #666;
            font-family: monospace;
          }
        }
      }
    }
  }
}
</style>