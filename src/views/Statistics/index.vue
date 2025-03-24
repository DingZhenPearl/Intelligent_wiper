<template>
  <div class="statistics">
    <h1>数据统计</h1>
    <div class="chart-container">
      <!-- 这里可以放置实际的统计图表 -->
      <p>雨量数据统计图表将在此显示</p>
    </div>
    
    <!-- 添加选择器组件 -->
    <div class="time-selector">
      <button class="time-btn active">今天</button>
      <button class="time-btn">本周</button>
      <button class="time-btn">本月</button>
      <button class="time-btn">全部</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StatisticsPage',
  setup() {
    return {}
  }
}
</script>

<style lang="scss" scoped>
.statistics {
  padding: 24px 20px; /* 从12px 10px增大到24px 20px */
  
  h1 {
    text-align: center;
    margin-bottom: 28px; /* 从14px增大到28px */
    font-size: 44px; /* 从22px增大到44px */
  }
  
  .chart-container {
    background-color: #f5f5f5;
    border-radius: 16px; /* 从8px增大到16px */
    padding: 28px; /* 从14px增大到28px */
    min-height: 440px; /* 从220px增大到440px */
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px; /* 从15px增大到30px */
    margin-bottom: 32px; /* 从16px增大到32px */
  }
  
  /* 添加时间选择器样式 */
  .time-selector {
    display: flex;
    justify-content: space-between;
    margin: 0 auto;
    max-width: min(800px, 95vw); /* 从400px, 92vw增大到800px, 95vw */
    gap: 16px; /* 从8px增大到16px */
    
    .time-btn {
      flex: 1;
      background-color: #f5f5f5;
      border: none;
      color: #666;
      padding: 16px 0; /* 从8px增大到16px */
      font-size: 28px; /* 从14px增大到28px */
      border-radius: 8px; /* 从4px增大到8px */
      cursor: pointer;
      
      &.active {
        background-color: #4285f4;
        color: white;
      }
      
      &:hover:not(.active) {
        background-color: #e0e0e0;
      }
    }
  }
  
  /* 响应式调整 */
  @media screen and (max-width: 320px) {
    .chart-container {
      min-height: 360px; /* 从180px增大到360px */
      padding: 24px; /* 从12px增大到24px */
    }
    
    .time-selector .time-btn {
      font-size: 26px; /* 从13px增大到26px */
      padding: 12px 0; /* 从6px增大到12px */
    }
  }
  
  @media screen and (min-width: 768px) {
    padding: 16px;
    
    .chart-container {
      min-height: 300px;
      padding: 20px;
    }
    
    .time-selector {
      max-width: 500px;
      
      .time-btn {
        font-size: 15px;
        padding: 10px 0;
      }
    }
  }
}
</style>