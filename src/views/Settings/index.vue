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
  padding: 20px;

  h1 {
    text-align: center;
    margin-bottom: 30px;
    color: #333;
  }

  .settings-container {
    max-width: 500px;
    margin: 0 auto;
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .setting-item {
    padding: 20px 0;
    border-bottom: 1px solid #eee;

    &:last-child {
      border-bottom: none;
    }

    h3 {
      margin-bottom: 10px;
      color: #666;
    }

    .status-text {
      color: #4caf50;
      font-weight: 500;
    }

    .select-input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
      color: #333;
    }

    .range-input {
      width: 80%;
      margin-right: 10px;
    }

    .value-text {
      color: #666;
      font-weight: 500;
    }
  }
}
</style>