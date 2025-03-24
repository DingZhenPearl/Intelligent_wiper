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
  padding: var(--spacing-lg) var(--spacing-md);

  h1 {
    text-align: center;
    margin-bottom: var(--spacing-lg);
    color: #333;
    font-size: var(--font-size-xxl);
  }

  .settings-container {
    max-width: min(90%, 840px);
    margin: 0 auto;
    background: white;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    box-shadow: 0 2px var(--spacing-sm) rgba(0, 0, 0, 0.08);
  }

  .setting-item {
    padding: var(--spacing-lg) 0;
    border-bottom: 2px solid #eee;

    &:last-child {
      border-bottom: none;
    }

    h3 {
      margin-bottom: var(--spacing-xs);
      color: #666;
      font-size: var(--font-size-lg);
    }

    .status-text {
      color: #4caf50;
      font-weight: 500;
      font-size: var(--font-size-md);
    }

    .select-input {
      width: 100%;
      padding: var(--spacing-sm);
      border: 2px solid #ddd;
      border-radius: var(--border-radius-sm);
      font-size: var(--font-size-md);
      color: #333;
      height: calc(var(--font-size-md) * 3);
    }

    .range-input {
      width: 80%;
      margin-right: var(--spacing-sm);
      height: calc(var(--spacing-xs) * 1.5);
      cursor: pointer;
    }

    .value-text {
      color: #666;
      font-weight: 500;
      font-size: var(--font-size-md);
      display: inline-block;
      min-width: calc(var(--font-size-md) * 1.5);
      text-align: center;
    }
  }
  
  /* 添加响应式设计 */
  @media screen and (max-width: 320px) {
    .settings-container {
      padding: var(--spacing-md);
    }
    
    .setting-item {
      padding: var(--spacing-md) 0;
      
      h3 {
        font-size: var(--font-size-md);
      }
      
      .status-text, .value-text {
        font-size: var(--font-size-sm);
      }
    }
  }
  
  @media screen and (min-width: 768px) {
    padding: var(--spacing-md);
    
    .settings-container {
      padding: var(--spacing-md);
      max-width: 500px;
    }
    
    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-md) 0;
      
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