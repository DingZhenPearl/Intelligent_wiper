<template>
  <div ref="chartRef" :style="{height: height, width: width}"></div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

export default {
  name: 'ECharts',
  props: {
    option: {
      type: Object,
      required: true
    },
    height: {
      type: String,
      default: '300px'
    },
    width: {
      type: String,
      default: '100%'
    }
  },
  setup(props) {
    const chartRef = ref(null)
    let chart = null

    onMounted(() => {
      chart = echarts.init(chartRef.value)
      chart.setOption(props.option)
      
      window.addEventListener('resize', function() {
        chart.resize()
      })
    })

    watch(() => props.option, (newVal) => {
      if (chart) {
        chart.setOption(newVal)
      }
    }, { deep: true })

    onUnmounted(() => {
      if (chart) {
        window.removeEventListener('resize', chart.resize)
        chart.dispose()
      }
    })

    return {
      chartRef
    }
  }
}
</script>