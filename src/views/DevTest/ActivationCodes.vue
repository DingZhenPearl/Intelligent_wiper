<template>
  <div class="activation-codes-test">
    <h2>设备激活码测试页面</h2>
    <p class="warning">⚠️ 此页面仅用于开发测试，生产环境中应该移除</p>
    
    <div class="section">
      <h3>可用激活码</h3>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="codes.length === 0" class="no-codes">暂无可用激活码</div>
      <div v-else class="codes-list">
        <div v-for="code in codes" :key="code.code" class="code-item">
          <div class="code-header">
            <span class="code">{{ code.code }}</span>
            <button @click="copyCode(code.code)" class="copy-btn">复制</button>
          </div>
          <div class="code-details">
            <div class="detail">
              <label>设备型号:</label>
              <span>{{ code.deviceModel }}</span>
            </div>
            <div class="detail">
              <label>序列号:</label>
              <span>{{ code.serialNumber }}</span>
            </div>
            <div class="detail">
              <label>固件版本:</label>
              <span>{{ code.firmwareVersion }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>使用说明</h3>
      <ol>
        <li>复制上面的任意一个激活码</li>
        <li>前往设置页面</li>
        <li>在设备激活区域输入激活码</li>
        <li>点击"激活设备"按钮</li>
        <li>激活成功后，该激活码将不再可用</li>
      </ol>
    </div>

    <div class="actions">
      <button @click="refreshCodes" class="refresh-btn">刷新列表</button>
      <button @click="goToSettings" class="settings-btn">前往设置页面</button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { get } from '@/services/api'

export default {
  name: 'ActivationCodesTest',
  setup() {
    const router = useRouter()
    const codes = ref([])
    const loading = ref(false)
    const error = ref(null)

    const loadCodes = async () => {
      loading.value = true
      error.value = null
      
      try {
        const response = await get('/api/device/activation/codes')
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            codes.value = data.availableCodes
          } else {
            error.value = data.error
          }
        } else {
          error.value = '获取激活码失败'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    const copyCode = async (code) => {
      try {
        await navigator.clipboard.writeText(code)
        alert(`激活码 ${code} 已复制到剪贴板`)
      } catch (err) {
        // 如果剪贴板API不可用，使用传统方法
        const textArea = document.createElement('textarea')
        textArea.value = code
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        alert(`激活码 ${code} 已复制到剪贴板`)
      }
    }

    const refreshCodes = () => {
      loadCodes()
    }

    const goToSettings = () => {
      router.push('/settings')
    }

    onMounted(() => {
      loadCodes()
    })

    return {
      codes,
      loading,
      error,
      copyCode,
      refreshCodes,
      goToSettings
    }
  }
}
</script>

<style lang="scss" scoped>
.activation-codes-test {
  padding: var(--spacing-md);
  background: #f5f5f5;
  min-height: 100vh;

  h2 {
    text-align: center;
    margin-bottom: var(--spacing-md);
    color: #333;
  }

  .warning {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    color: #856404;
    padding: var(--spacing-md);
    border-radius: var(--border-radius-md);
    margin-bottom: var(--spacing-lg);
    text-align: center;
    font-weight: 600;
  }

  .section {
    background: white;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);

    h3 {
      margin-bottom: var(--spacing-lg);
      color: #333;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: var(--spacing-sm);
    }
  }

  .loading, .error, .no-codes {
    text-align: center;
    padding: var(--spacing-xl);
    color: #666;
  }

  .error {
    color: #d32f2f;
  }

  .codes-list {
    .code-item {
      border: 1px solid #e0e0e0;
      border-radius: var(--border-radius-md);
      margin-bottom: var(--spacing-md);
      overflow: hidden;

      .code-header {
        background: #f8f9fa;
        padding: var(--spacing-md);
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e0e0e0;

        .code {
          font-family: monospace;
          font-size: var(--font-size-lg);
          font-weight: 600;
          color: #1976D2;
        }

        .copy-btn {
          background: #4CAF50;
          color: white;
          border: none;
          padding: var(--spacing-xs) var(--spacing-md);
          border-radius: var(--border-radius-sm);
          cursor: pointer;
          font-size: var(--font-size-sm);

          &:hover {
            background: #45a049;
          }
        }
      }

      .code-details {
        padding: var(--spacing-md);

        .detail {
          display: flex;
          justify-content: space-between;
          margin: var(--spacing-xs) 0;

          label {
            font-weight: 600;
            color: #666;
          }

          span {
            color: #333;
            font-family: monospace;
          }
        }
      }
    }
  }

  ol {
    padding-left: var(--spacing-lg);

    li {
      margin: var(--spacing-sm) 0;
      color: #666;
    }
  }

  .actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;

    button {
      padding: var(--spacing-md) var(--spacing-lg);
      border: none;
      border-radius: var(--border-radius-md);
      font-size: var(--font-size-lg);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;

      &.refresh-btn {
        background: #2196F3;
        color: white;

        &:hover {
          background: #1976D2;
        }
      }

      &.settings-btn {
        background: #FF9800;
        color: white;

        &:hover {
          background: #F57C00;
        }
      }
    }
  }
}
</style>
