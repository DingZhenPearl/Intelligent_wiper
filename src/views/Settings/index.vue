<template>
  <div class="settings">
    <h1>状态与设置</h1>
    <div class="settings-container">
      <div class="setting-item">
        <h3>系统状态</h3>
        <p class="status-text">运行正常</p>
      </div>
      
      <div class="setting-item">
        <h3>雨刷模式</h3>
        <select v-model="wiperMode" class="select-input">
          <option value="auto">自动模式</option>
          <option value="manual">手动模式</option>
        </select>
      </div>
      
      <div class="setting-item">
        <h3>灵敏度调节</h3>
        <input type="range" v-model="sensitivity" min="1" max="10" class="range-input">
        <span class="value-text">{{ sensitivity }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'SettingsPage',
  setup() {
    const wiperMode = ref('auto')
    const sensitivity = ref(5)

    return {
      wiperMode,
      sensitivity
    }
  }
}
</script>

<style lang="scss" scoped>
.settings {
  padding: 24px 20px; /* 从12px 10px增大到24px 20px */

  h1 {
    text-align: center;
    margin-bottom: 32px; /* 从16px增大到32px */
    color: #333;
    font-size: 44px; /* 从22px增大到44px */
  }

  .settings-container {
    max-width: min(840px, 95vw); /* 从420px, 92vw增大到840px, 95vw */
    margin: 0 auto;
    background: white;
    border-radius: 16px; /* 从8px增大到16px */
    padding: 28px; /* 从14px增大到28px */
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08); /* 增强阴影 */
  }

  .setting-item {
    padding: 28px 0; /* 从14px增大到28px */
    border-bottom: 2px solid #eee; /* 从1px增大到2px */

    &:last-child {
      border-bottom: none;
    }

    h3 {
      margin-bottom: 12px; /* 从6px增大到12px */
      color: #666;
      font-size: 34px; /* 从17px增大到34px */
    }

    .status-text {
      color: #4caf50;
      font-weight: 500;
      font-size: 30px; /* 从15px增大到30px */
    }

    .select-input {
      width: 100%;
      padding: 16px; /* 从8px增大到16px */
      border: 2px solid #ddd; /* 从1px增大到2px */
      border-radius: 8px; /* 从4px增大到8px */
      font-size: 28px; /* 从14px增大到28px */
      color: #333;
      height: 72px; /* 从36px增大到72px */
    }

    .range-input {
      width: 80%;
      margin-right: 16px; /* 从8px增大到16px */
      height: 12px; /* 从6px增大到12px */
      cursor: pointer;
    }

    .value-text {
      color: #666;
      font-weight: 500;
      font-size: 28px; /* 从14px增大到28px */
      display: inline-block;
      min-width: 40px; /* 从20px增大到40px */
      text-align: center;
    }
  }
  
  /* 添加响应式设计 */
  @media screen and (max-width: 320px) {
    .settings-container {
      padding: 24px; /* 从12px增大到24px */
    }
    
    .setting-item {
      padding: 24px 0; /* 从12px增大到24px */
      
      h3 {
        font-size: 32px; /* 从16px增大到32px */
      }
      
      .status-text, .value-text {
        font-size: 26px; /* 从13px增大到26px */
      }
    }
  }
  
  @media screen and (min-width: 768px) {
    padding: 16px;
    
    .settings-container {
      padding: 20px;
      max-width: 500px;
    }
    
    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 0;
      
      h3 {
        margin-bottom: 0;
        flex: 1;
      }
      
      .select-input, .range-input, .status-text {
        width: 50%;
      }
    }
  }
}
</style>