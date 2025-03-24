<template>
  <div class="control-panel">
    <h1>主控制界面</h1>
    
    <!-- 雨量百分比图 -->
    <div class="rainfall-chart">
      <div class="pie-chart">
        <div class="pie" :style="{ background: `conic-gradient(#4285f4 ${rainfall}%, #e8f0fe ${rainfall}% 100%)` }"></div>
        <div class="percentage">{{ rainfall }}%</div>
      </div>
      <div class="label">实时雨量</div>
    </div>

    <!-- 工作状态列表 -->
    <div class="work-status">
      <h2>当前雨刷工作状态</h2>
      <ul class="status-list">
        <li :class="{ active: currentStatus === 'off' }">关闭</li>
        <li :class="{ active: currentStatus === 'interval' }">间歇</li>
        <li :class="{ active: currentStatus === 'low' }">低速</li>
        <li :class="{ active: currentStatus === 'high' }">高速</li>
        <li :class="{ active: currentStatus === 'smart' }">智能</li>
      </ul>
    </div>

    <!-- 控制按钮 -->
    <button class="control-btn" @click="toggleWiper">
      <span class="icon">⏻</span>
      立即关闭
    </button>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'ControlPanel',
  setup() {
    const rainfall = ref(40) // 实时雨量百分比
    const currentStatus = ref('low') // 当前工作状态

    const toggleWiper = () => {
      currentStatus.value = 'off'
      // 这里可以添加实际的控制逻辑
    }

    return {
      rainfall,
      currentStatus,
      toggleWiper
    }
  }
}
</script>

<style lang="scss" scoped>
.control-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;

  h1 {
    margin-bottom: 20px;
    color: #333;
  }

  .rainfall-chart {
    text-align: center;
    
    .pie-chart {
      position: relative;
      width: 200px;
      height: 200px;
      margin: 0 auto 10px;
      
      .pie {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        transform: rotate(-90deg);
      }
      
      .percentage {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 24px;
        font-weight: bold;
        color: #4285f4;
      }
    }
    
    .label {
      font-size: 16px;
      color: #666;
    }
  }

  .work-status {
    width: 100%;
    max-width: 400px;
    
    h2 {
      margin-bottom: 15px;
      color: #333;
      font-size: 18px;
    }
    
    .status-list {
      list-style: none;
      padding: 0;
      margin: 0;
      
      li {
        padding: 12px 20px;
        margin-bottom: 10px;
        border-radius: 6px;
        background-color: #f5f5f5;
        color: #666;
        cursor: pointer;
        transition: all 0.3s ease;
        
        &.active {
          background-color: #4285f4;
          color: white;
        }
      }
    }
  }

  .control-btn {
    background-color: #4285f4;
    color: white;
    border: none;
    border-radius: 24px;
    padding: 12px 32px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background-color 0.3s ease;
    
    &:hover {
      background-color: #3367d6;
    }
    
    .icon {
      font-size: 20px;
    }
  }
}
</style>