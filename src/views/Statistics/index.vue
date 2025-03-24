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
  padding: var(--spacing-lg) var(--spacing-md);
  
  h1 {
    text-align: center;
    margin-bottom: var(--spacing-lg);
    font-size: var(--font-size-xxl);
  }
  
  .chart-container {
    background-color: #f5f5f5;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg);
    margin-bottom: var(--spacing-lg);
  }
  
  /* 添加时间选择器样式 */
  .time-selector {
    display: flex;
    justify-content: space-between;
    margin: 0 auto;
    max-width: min(90%, 800px);
    gap: var(--spacing-sm);
    
    .time-btn {
      flex: 1;
      background-color: #f5f5f5;
      border: none;
      color: #666;
      padding: var(--spacing-sm) 0;
      font-size: var(--font-size-md);
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      
      &.active {
        background-color: var(--primary-color);
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
      min-height: 45vh;
      padding: var(--spacing-md);
    }
    
    .time-selector .time-btn {
      font-size: var(--font-size-sm);
      padding: calc(var(--spacing-sm) * 0.8) 0;
    }
  }
  
  @media screen and (min-width: 768px) {
    padding: var(--spacing-md);
    
    .chart-container {
      min-height: 40vh;
      padding: var(--spacing-md);
    }
    
    .time-selector {
      max-width: 500px;
      
      .time-btn {
        font-size: calc(var(--font-size-md) * 0.9);
        padding: var(--spacing-sm) 0;
      }
    }
  }
}
</style>