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
  padding: 24px 20px; /* 从12px 10px增大到24px 20px */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px; /* 从12px增大到24px */
  height: 100%;
  overflow-y: auto;

  h1 {
    margin-bottom: 32px; /* 从16px增大到32px */
    color: #333;
    font-size: 44px; /* 从22px增大到44px */
  }

  .rainfall-chart {
    text-align: center;
    
    .pie-chart {
      position: relative;
      width: min(520px, 80vw); /* 从260px, 70vw增大到520px, 80vw */
      height: min(520px, 80vw); /* 从260px, 70vw增大到520px, 80vw */
      margin: 0 auto 32px; /* 从16px增大到32px */
      
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
        font-size: 64px; /* 从32px增大到64px */
        font-weight: bold;
        color: #4285f4;
      }
    }
    
    .label {
      font-size: 40px; /* 从20px增大到40px */
      color: #666;
    }
  }

  .work-status {
    width: 100%;
    max-width: min(840px, 95vw); /* 从420px, 92vw增大到840px, 95vw */
    
    h2 {
      margin-bottom: 24px; /* 从12px增大到24px */
      color: #333;
      font-size: 40px; /* 从20px增大到40px */
    }
    
    .status-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 16px; /* 从8px增大到16px */
      
      li {
        flex: 1 0 calc(50% - 8px); /* 考虑更大的间距 */
        padding: 24px 32px; /* 从12px 16px增大到24px 32px */
        margin-bottom: 0;
        border-radius: 12px; /* 从6px增大到12px */
        font-size: 30px; /* 从15px增大到30px */
        background-color: #f5f5f5;
        color: #666;
        cursor: pointer;
        transition: all 0.3s ease;
        text-align: center;
        
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
    border-radius: 44px; /* 从22px增大到44px */
    padding: 24px 60px; /* 从12px 30px增大到24px 60px */
    font-size: 32px; /* 从16px增大到32px */
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px; /* 从6px增大到12px */
    transition: background-color 0.3s ease;
    margin-top: 20px; /* 从10px增大到20px */
    
    &:hover {
      background-color: #3367d6;
    }
    
    .icon {
      font-size: 36px; /* 从18px增大到36px */
    }
  }
  
  /* 添加额外的响应式样式 */
  @media screen and (max-width: 360px) {
    .rainfall-chart {
      .pie-chart {
        width: min(440px, 90vw); /* 从220px, 80vw增大到440px, 90vw */
        height: min(440px, 90vw); /* 从220px, 80vw增大到440px, 90vw */
        
        .percentage {
          font-size: 56px; /* 从28px增大到56px */
        }
      }
      
      .label {
        font-size: 36px; /* 从18px增大到36px */
      }
    }
    
    .work-status {
      .status-list li {
        flex: 1 0 100%; /* 在小屏幕上改为单列 */
        padding: 10px 14px;
      }
    }
  }
  
  @media screen and (min-width: 768px) {
    padding: 16px;
    gap: 20px;
    
    .work-status .status-list {
      display: grid;
      grid-template-columns: repeat(5, 1fr); /* 在大屏幕上使用网格布局 */
      gap: 10px;
      
      li {
        padding: 14px 10px;
      }
    }
  }
}
</style>