<template>
  <div class="rainfall-chart">
    <e-charts 
      :option="chartOption"
      height="calc(100vh - var(--nav-height))"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import ECharts from '@/components/ECharts'

export default {
  name: 'RainfallChart',
  components: {
    ECharts
  },
  setup() {
    // 定义响应式图表高度
    const navHeight = ref('6rem');
    
    // 根据视窗大小调整图表选项
    const updateFontSizes = () => {
      const baseFontSize = window.innerWidth < 768 
        ? Math.max(12, Math.min(16, window.innerWidth / 30)) 
        : 16;
      
      chartOption.value.title.textStyle.fontSize = baseFontSize * 1.5;
      chartOption.value.xAxis.axisLabel.fontSize = baseFontSize;
      chartOption.value.yAxis.axisLabel.fontSize = baseFontSize;
      
      // 更新导航栏高度估算
      navHeight.value = `${Math.max(4, Math.min(8, window.innerWidth / 100))}rem`;
    };
    
    const chartOption = ref({
      title: {
        text: '雨量显示',
        textStyle: {
          fontSize: 16
        }
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          fontSize: 12
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 12
        }
      },
      grid: {
        containLabel: true,
        left: '5%',
        right: '5%',
        bottom: '10%',
        top: '15%'
      },
      series: [{
        type: 'line',
        data: []
      }]
    });

    // 监听窗口大小变化
    onMounted(() => {
      updateFontSizes();
      window.addEventListener('resize', updateFontSizes);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', updateFontSizes);
    });

    return {
      chartOption,
      navHeight
    }
  }
}
</script>

<style lang="scss" scoped>
.rainfall-chart {
  --nav-height: 6rem; /* 默认导航高度 */
  height: 100%;
  width: 100%;
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  
  /* 添加响应式调整 */
  @media screen and (max-width: 320px) {
    padding: var(--spacing-xs);
  }
  
  @media screen and (min-width: 768px) {
    padding: var(--spacing-md);
    max-width: 960px;
    margin: 0 auto;
  }
  
  @media screen and (min-width: 1200px) {
    max-width: 1140px;
  }
}
</style>