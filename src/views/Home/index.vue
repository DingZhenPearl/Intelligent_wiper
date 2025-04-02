<template>
  <div class="control-panel">
    <h1>主控制界面</h1>
    
    <div class="responsive-layout">
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
          <li :class="{ active: currentStatus === 'off' }" @click="changeStatus('off')">关闭</li>
          <li :class="{ active: currentStatus === 'interval' }" @click="changeStatus('interval')">间歇</li>
          <li :class="{ active: currentStatus === 'low' }" @click="changeStatus('low')">低速</li>
          <li :class="{ active: currentStatus === 'high' }" @click="changeStatus('high')">高速</li>
          <li :class="{ active: currentStatus === 'smart' }" @click="changeStatus('smart')">智能</li>
        </ul>
      
        <!-- 控制按钮 -->
        <button class="control-btn" @click="toggleWiper">
          <span class="icon">⏻</span>
          {{ currentStatus === 'off' ? '开启雨刷' : '立即关闭' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'ControlPanel',
  setup() {
    const rainfall = ref(40) // 实时雨量百分比
    const currentStatus = ref('low') // 当前工作状态

    const changeStatus = (status) => {
      currentStatus.value = status
      // 这里可以添加与后端通信的逻辑
      console.log(`雨刷状态切换为: ${status}`)
    }

    const toggleWiper = () => {
      if (currentStatus.value === 'off') {
        // 如果当前是关闭状态，则切换到智能模式
        changeStatus('smart')
      } else {
        // 如果当前是其他状态，则切换到关闭状态
        changeStatus('off')
      }
    }

    return {
      rainfall,
      currentStatus,
      changeStatus,
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

  .responsive-layout {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-lg);
  }

  .rainfall-chart {
    text-align: center;
    width: 100%;
    
    .pie-chart {
      position: relative;
      width: min(70vw, 60vh);
      height: min(70vw, 60vh);
      max-width: 350px; /* 限制最大尺寸 */
      max-height: 350px;
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
        
        &:hover:not(.active) {
          background-color: #e0e0e0;
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
    width: 100%;
    max-width: 400px;
    justify-content: center;
    
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
        max-width: 200px; /* 较小屏幕限制尺寸 */
        max-height: 200px;
        
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
  
  /* 手机横屏模式特别优化 - 新增 */
  @media screen and (orientation: landscape) and (max-width: 900px) {
    padding: var(--spacing-md) var(--spacing-sm);
    
    h1 {
      font-size: var(--font-size-xl);
      margin-bottom: var(--spacing-md);
    }
    
    .responsive-layout {
      flex-direction: row;
      align-items: flex-start;
      gap: var(--spacing-md);
    }
    
    .rainfall-chart {
      flex: 0 0 40%;
      
      .pie-chart {
        width: 25vh;
        height: 25vh;
        min-width: 100px;
        min-height: 100px;
        max-width: 150px;
        max-height: 150px;
      }
      
      .label {
        font-size: var(--font-size-md);
      }
    }
    
    .work-status {
      flex: 0 0 55%;
      
      h2 {
        font-size: var(--font-size-lg);
        margin-bottom: var(--spacing-sm);
      }
      
      .status-list {
        gap: var(--spacing-xs);
        
        li {
          padding: var(--spacing-sm) var(--spacing-xs);
          font-size: var(--font-size-sm);
        }
      }
      
      .control-btn {
        padding: var(--spacing-sm) var(--spacing-md);
        font-size: var(--font-size-md);
        margin-top: var(--spacing-sm);
      }
    }
  }
  
  @media screen and (min-width: 768px) and (max-width: 1023px) {
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
        width: min(40vw, 300px);
        height: min(40vw, 300px);
      }
    }
  }
  
  /* 桌面端布局优化 - 调整 */
  @media screen and (min-width: 1024px) {
    padding: var(--spacing-xl);
    
    .responsive-layout {
      flex-direction: row;
      justify-content: space-between;
      align-items: stretch;
      gap: var(--spacing-xl);
      max-width: 90%;
      margin: 0 auto;
    }

    .rainfall-chart {
      flex: 1;
      max-width: 40%;
      padding: var(--spacing-lg);
      background-color: white;
      border-radius: var(--border-radius-lg);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      justify-content: center;
      
      .pie-chart {
        width: min(30vw, 300px);
        height: min(30vw, 300px);
        max-width: 300px;
        max-height: 300px;
        margin: 0 auto var(--spacing-lg);
      }
    }

    .work-status {
      flex: 1;
      max-width: 55%;
      padding: var(--spacing-lg);
      background-color: white;
      border-radius: var(--border-radius-lg);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      
      h2 {
        margin-top: 0;
      }
      
      .status-list {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--spacing-md);
        
        li {
          padding: var(--spacing-md);
          font-size: var(--font-size-lg);
        }
      }
      
      .control-btn {
        margin-top: var(--spacing-lg);
        max-width: none;
        padding: var(--spacing-md) var(--spacing-xl);
      }
    }
  }
  
  /* 大屏幕优化 - 调整 */
  @media screen and (min-width: 1400px) {
    .responsive-layout {
      max-width: 80%;
    }
    
    .rainfall-chart {
      .pie-chart {
        width: min(25vw, 350px);
        height: min(25vw, 350px);
        max-width: 350px;
        max-height: 350px;
      }
    }
    
    .work-status {
      .status-list {
        grid-template-columns: repeat(5, 1fr);
      }
    }
  }
  
  /* 超大屏幕优化 - 新增 */
  @media screen and (min-width: 1800px) {
    .responsive-layout {
      max-width: 1600px;
    }
  }
}
</style>