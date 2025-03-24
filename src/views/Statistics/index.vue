<template>
  <div class="statistics">
    <h1>数据统计</h1>
    
    <!-- 时间选择器组件移到图表上方 -->
    <div class="time-selector">
      <button 
        v-for="(period, index) in timePeriods" 
        :key="index" 
        class="time-btn" 
        :class="{ active: activePeriod === index }"
        @click="changePeriod(index)"
      >
        {{ period.label }}
      </button>
    </div>
    
    <div class="chart-container">
      <e-charts 
        ref="chart"
        :option="chartOption" 
        :auto-resize="true"
        style="width: 100%; height: 100%;"
      />
    </div>
  </div>
</template>

<script>
// reactive
import { ref, onMounted, onUnmounted,  } from 'vue'
import ECharts from '@/components/ECharts'

// 辅助变量和函数
const oneDay = 24 * 3600 * 1000;

// 获取当前日期N天前的日期字符串
// function getNDaysAgoDate(days = 28) {
//   const date = new Date();
//   date.setDate(date.getDate() - days);
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, '0');
//   const day = String(date.getDate()).padStart(2, '0');
//   return `${year}-${month}-${day}T00:00:00`;
// }

export default {
  name: 'StatisticsPage',
  components: {
    ECharts
  },
  setup() {
    const chartData = ref([]);
    const intervalId = ref(null);
    let now = new Date();
    let value = Math.random() * 1000;
    
    // 定义时间段选择器
    const timePeriods = [
      { label: '今天', days: 1 },
      { label: '本周', days: 7 },
      { label: '本月', days: 30 },
      { label: '全部', days: 90 }
    ];
    const activePeriod = ref(2); // 默认选择"本月"
    
    // 生成随机数据
    const randomData = () => {
      now = new Date(+now + oneDay);
      value = value + Math.random() * 21 - 10;
      return {
        value: [
          now.toISOString(),
          Math.round(value)
        ]
      };
    };
    
    // 初始化模拟数据
    const initMockData = (days = 30) => {
      chartData.value = [];
      now = new Date(); // 重置为当前日期
      
      // 生成过去N天的模拟数据
      for (let i = days; i >= 0; i--) {
        const pastDate = new Date(now.getTime() - (i * oneDay));
        chartData.value.push({
          value: [
            pastDate.toISOString(),
            Math.round(Math.random() * 100) // 0-100之间的随机雨量
          ]
        });
      }
      
      console.log(`初始化${days}天模拟数据:`, chartData.value);
      updateChartData();
    };
    
    // 更新图表数据
    const updateChartData = () => {
      chartOption.value.series[0].data = chartData.value;
    };
    
    // 切换时间段
    const changePeriod = (index) => {
      activePeriod.value = index;
      initMockData(timePeriods[index].days);
      
      // 更新图表标题
      chartOption.value.title.text = `雨量显示 - ${timePeriods[index].label}`;
    };
    
    // 启动定时数据更新
    const startDataPolling = () => {
      // 清除可能存在的旧计时器
      if (intervalId.value) {
        clearInterval(intervalId.value);
      }
      
      intervalId.value = setInterval(() => {
        // 注释掉原来的API请求代码
        /*
        // 这里模拟 wx.request
        fetch('http://api.heclouds.com/devices/997978117/datapoints?' + new URLSearchParams({
          'datastream_id': 'rain_info',
          'start': getNDaysAgoDate(timePeriods[activePeriod.value].days),
          'limit': '1',
          'sort': 'DESC'
        }), {
          headers: {
            'content-type': 'application/json',
            'Authorization': 'version=2018-10-31&res=products%2F544361&et=1765738973&method=sha1&sign=C4OPW%2FNXTz%2BV%2FeCtKPNpojivlPM%3D',
          }
        })
        .then(response => response.json())
        .then(responseData => {
          console.log('定时请求返回:', responseData);
          
          // 安全地访问数据
          if (responseData && responseData.data && responseData.data.datastreams && 
              responseData.data.datastreams.length > 0 && 
              responseData.data.datastreams[0].datapoints) {
            
            const datapoints = responseData.data.datastreams[0].datapoints;
            
            for (let d = 0; d < datapoints.length; d++){
              console.log('新数据时间戳:', datapoints[d].at);
              
              if (chartData.value.length > 0) {
                console.log('最后一条数据时间戳:', chartData.value[chartData.value.length-1].value[0]);
              }
              
              let traceMark = false;
              let storageTimeStamp = datapoints[d].at;
              chartData.value.push({value: [datapoints[d].at, datapoints[d].value]});
              
              if (chartData.value.length > 0 && datapoints[d].at === chartData.value[chartData.value.length-1].value[0]) {
                traceMark = true;
              }
              
              if (chartData.value.length > timePeriods[activePeriod.value].days && traceMark === true) {
                chartData.value.shift();
              }
            }
            
            // 更新图表
            updateChartData();
          }
        })
        .catch(err => {
          console.error('定时请求失败:', err);
        });
        */

        // 添加新的模拟数据
        const newData = randomData();
        console.log('添加新的模拟数据:', newData);
        
        chartData.value.push(newData);
        
        // 保持数据量合理
        if (chartData.value.length > timePeriods[activePeriod.value].days) {
          chartData.value.shift();
        }
        
        // 更新图表
        updateChartData();
        
      }, 5000);
    };

    // 图表配置
    const chartOption = ref({
      title: {
        text: '雨量显示 - 本月',
        textStyle: {
          fontSize: 16
        },
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          params = params[0];
          var date = new Date(params.name);
          return (
            date.getDate() +
            '/' +
            (date.getMonth() + 1) +
            '/' +
            date.getFullYear() +
            ' : ' +
            params.value[1] +
            ' mm'
          );
        },
        axisPointer: {
          animation: false
        }
      },
      xAxis: {
        type: 'time',
        splitLine: {
          show: false
        }
      },
      yAxis: {
        type: 'value',
        boundaryGap: [0, '100%'],
        splitLine: {
          show: true
        },
        name: '雨量 (mm)'
      },
      grid: {
        containLabel: true,
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '60px'
      },
      series: [
        {
          name: '雨量数据',
          type: 'line',
          showSymbol: false,
          areaStyle: {
            opacity: 0.3
          },
          data: []
        }
      ]
    });

    // 生命周期钩子
    onMounted(() => {
      // 初始化模拟数据
      initMockData(timePeriods[activePeriod.value].days);
      
      // 启动定时更新
      startDataPolling();
    });

    onUnmounted(() => {
      // 清除定时器防止内存泄漏
      if (intervalId.value) {
        clearInterval(intervalId.value);
        intervalId.value = null;
      }
      console.log("组件已卸载");
    });

    return {
      chartOption,
      timePeriods,
      activePeriod,
      changePeriod
    }
  }
}
</script>

<style lang="scss" scoped>
.statistics {
  padding: var(--spacing-md) var(--spacing-sm);
  height: 100%;
  display: flex;
  flex-direction: column;
  
  h1 {
    text-align: center;
    margin-bottom: var(--spacing-md);
    font-size: var(--font-size-xl);
  }
  
  /* 时间选择器样式 - 移至图表上方 */
  .time-selector {
    display: flex;
    justify-content: center; /* 居中对齐 */
    margin: 0 auto var(--spacing-md) auto; /* 下方添加间距 */
    width: 100%;
    max-width: 800px;
    gap: var(--spacing-sm);
    
    .time-btn {
      flex: 1;
      max-width: 120px; /* 限制按钮最大宽度 */
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
  
  .chart-container {
    background-color: #f5f5f5;
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-md);
    height: 70vh;
    min-height: 400px;
    display: flex;
    flex: 1;
    width: 100%;
    margin-bottom: 0; /* 移除底部边距，因为按钮已经不在下方 */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
  
  /* 响应式调整 */
  @media screen and (max-width: 480px) {
    padding: var(--spacing-sm) var(--spacing-xs);
    
    h1 {
      font-size: var(--font-size-lg);
      margin-bottom: var(--spacing-sm);
    }
    
    .time-selector {
      margin-bottom: var(--spacing-sm);
      
      .time-btn {
        font-size: var(--font-size-sm);
        padding: calc(var(--spacing-sm) * 0.8) 0;
        max-width: none; /* 在小屏幕上取消最大宽度限制 */
      }
    }
    
    .chart-container {
      height: 60vh;
      min-height: 300px;
      padding: var(--spacing-sm);
    }
  }
  
  @media screen and (min-width: 768px) {
    padding: var(--spacing-lg) var(--spacing-xl);
    
    .time-selector {
      max-width: 600px;
      margin-bottom: var(--spacing-md);
    }
    
    .chart-container {
      height: 75vh;
      min-height: 500px;
      padding: var(--spacing-lg);
    }
  }
  
  @media screen and (min-width: 1200px) {
    .time-selector {
      max-width: 800px;
    }
    
    .chart-container {
      height: 80vh;
      min-height: 600px;
    }
  }
}
</style>