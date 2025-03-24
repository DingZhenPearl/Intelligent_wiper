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
  padding: var(--spacing-lg) var(--spacing-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  height: 100%;
  overflow-y: auto;

  h1 {
    margin-bottom: var(--spacing-lg);
    color: #333;
    font-size: var(--font-size-xxl);
  }

  .rainfall-chart {
    text-align: center;
    
    .pie-chart {
      position: relative;
      width: min(70vw, 60vh);
      height: min(70vw, 60vh);
      margin: 0 auto var(--spacing-lg);
      
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
        font-size: calc(var(--font-size-xxl) * 1.25);
        font-weight: bold;
        color: var(--primary-color);
      }
    }
    
    .label {
      font-size: var(--font-size-xl);
      color: #666;
    }
  }

  .work-status {
    width: 100%;
    max-width: 90%;
    
    h2 {
      margin-bottom: var(--spacing-md);
      color: #333;
      font-size: var(--font-size-xl);
    }
    
    .status-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
      
      li {
        flex: 1 0 calc(50% - var(--spacing-xs));
        padding: var(--spacing-md) var(--spacing-lg);
        margin-bottom: 0;
        border-radius: var(--border-radius-md);
        font-size: var(--font-size-md);
        background-color: #f5f5f5;
        color: #666;
        cursor: pointer;
        transition: all 0.3s ease;
        text-align: center;
        
        &.active {
          background-color: var(--primary-color);
          color: white;
        }
      }
    }
  }

  .control-btn {
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-md) var(--spacing-xl);
    font-size: var(--font-size-lg);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    transition: background-color 0.3s ease;
    margin-top: var(--spacing-md);
    
    &:hover {
      background-color: #3367d6;
    }
    
    .icon {
      font-size: calc(var(--font-size-lg) * 1.2);
    }
  }
  
  /* 添加额外的响应式样式 */
  @media screen and (max-width: 360px) {
    .rainfall-chart {
      .pie-chart {
        width: min(80vw, 50vh);
        height: min(80vw, 50vh);
        
        .percentage {
          font-size: calc(var(--font-size-xl) * 1.5);
        }
      }
      
      .label {
        font-size: var(--font-size-lg);
      }
    }
    
    .work-status {
      .status-list li {
        flex: 1 0 100%;
        padding: var(--spacing-sm) var(--spacing-md);
      }
    }
  }
  
  @media screen and (min-width: 768px) {
    padding: var(--spacing-md);
    gap: var(--spacing-md);
    
    .work-status .status-list {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--spacing-xs);
      
      li {
        padding: var(--spacing-sm) var(--spacing-xs);
      }
    }
    
    .rainfall-chart {
      .pie-chart {
        width: min(40vw, 350px);
        height: min(40vw, 350px);
      }
    }
  }
  
  @media screen and (min-width: 1200px) {
    .rainfall-chart {
      .pie-chart {
        width: 400px;
        height: 400px;
      }
    }
  }
}
</style>