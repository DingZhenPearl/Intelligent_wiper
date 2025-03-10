<template>
  <div class="rainfall-chart">
    <e-charts 
      :option="chartOption"
      height="calc(100vh - 80px)"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import ECharts from '@/components/ECharts'

export default {
  name: 'RainfallChart',
  components: {
    ECharts
  },
  setup() {
    const chartOption = ref({
      title: {
        text: '雨量显示'
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'time'
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        type: 'line',
        data: []
      }]
    })

    return {
      chartOption
    }
  }
}
</script>

<style lang="scss" scoped>
.rainfall-chart {
  height: 100vh;
  padding-top: 80px;
}
</style>