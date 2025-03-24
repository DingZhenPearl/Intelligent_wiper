<template>
  <div class="statistics">
    <h1>数据统计</h1>
    <div class="chart-container">
      <!-- 这里可以放置实际的统计图表 -->
      <p>雨量数据统计图表将在此显示</p>
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
  padding: 20px;
  
  h1 {
    text-align: center;
    margin-bottom: 20px;
  }
  
  .chart-container {
    background-color: #f5f5f5;
    border-radius: 8px;
    padding: 20px;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>