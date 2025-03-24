<template>
  <div class="rainfall-chart">
    <!-- 从68px增大到136px -->
    <e-charts 
      :option="chartOption"
      height="calc(100vh - 136px)"
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
        text: '雨量显示',
        textStyle: {
          fontSize: 32 // 从16增大到32
        }
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          fontSize: 24 // 从12增大到24
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 24 // 从12增大到24
        }
      },
      grid: {
        containLabel: true,
        left: 20,  // 从10增大到20
        right: 20, // 从10增大到20
        bottom: 40, // 从20增大到40
        top: 80     // 从40增大到80
      },
      series: [{
        type: 'line',
        data: []
      }],
      // 响应式调整
      media: [{
        query: {
          maxWidth: 320
        },
        option: {
          title: {
            textStyle: {
              fontSize: 28 // 从14增大到28
            }
          },
          axisLabel: {
            fontSize: 20 // 从10增大到20
          }
        }
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
  height: 100%;
  width: 100%;
  padding: 12px; /* 从6px增大到12px */
  display: flex;
  flex-direction: column;
  
  /* 添加响应式调整 */
  @media screen and (max-width: 320px) {
    padding: 8px; /* 从4px增大到8px */
  }
  
  @media screen and (min-width: 768px) {
    padding: 24px; /* 从12px增大到24px */
    max-width: 960px;
    margin: 0 auto;
  }
}
</style>