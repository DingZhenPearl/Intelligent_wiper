<template>
  <div ref="chartRef" :style="{height: height, width: width}" class="chart-container"></div>
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
    },
    autoResize: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      default: ''
    }
  },
  setup(props, { emit }) {
    const chartRef = ref(null)
    let chart = null
    let resizeObserver = null
    let resizeTimeout = null

    const initChart = () => {
      if (chart) {
        chart.dispose()
      }
      
      // 根据是否提供主题来初始化图表
      chart = props.theme 
        ? echarts.init(chartRef.value, props.theme)
        : echarts.init(chartRef.value);
      
      chart.setOption(props.option)
      
      // 设置图表点击事件
      chart.on('click', (params) => {
        emit('chartClick', params)
      })
    }
    
    const handleResize = () => {
      if (!chart) return;
      
      // 使用防抖处理resize，避免频繁resize导致性能问题
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      resizeTimeout = setTimeout(() => {
        if (chart && chartRef.value) {
          chart.resize();
          console.log('Chart resized');
        }
      }, 100);
    }

    onMounted(() => {
      // 延迟初始化以确保DOM已完全渲染
      setTimeout(() => {
        initChart();
        
        if (props.autoResize) {
          // 使用更现代的ResizeObserver API来监听容器大小变化
          if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(handleResize);
            resizeObserver.observe(chartRef.value);
            
            // 也监听窗口方向变化
            window.addEventListener('orientationchange', handleResize);
          } else {
            // 降级方案：使用窗口大小变化事件
            window.addEventListener('resize', handleResize);
          }
        }
      }, 50);
    })

    watch(() => props.option, (newVal) => {
      if (chart) {
        chart.setOption(newVal, true)
      }
    }, { deep: true })
    
    watch(() => props.theme, () => {
      initChart()
    })

    onUnmounted(() => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      if (chart) {
        chart.dispose()
        chart = null
      }
      
      if (resizeObserver) {
        resizeObserver.disconnect();
        window.removeEventListener('orientationchange', handleResize);
      } else if (props.autoResize) {
        window.removeEventListener('resize', handleResize)
      }
    })

    return {
      chartRef
    }
  }
}
</script>

<style scoped>
.chart-container {
  transition: all 0.3s ease;
  width: 100%;
  height: 100%;
}

@media (hover: hover) and (pointer: fine) {
  .chart-container {
    border-radius: 4px;
  }
}

@media screen and (orientation: landscape) {
  .chart-container {
    min-height: 200px;
  }
}
</style>