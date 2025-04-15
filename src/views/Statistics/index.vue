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

    <!-- 添加本小时雨量显示 -->
    <div v-if="activePeriod === 0" class="hour-rainfall">
      <div class="rainfall-card">
        <h3>{{ currentHourDisplay }}时累计雨量</h3>
        <div class="rainfall-value">{{ currentHourTotal }} <span>mm</span></div>
      </div>
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
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import ECharts from '@/components/ECharts'
import rainfallDataService from '@/services/rainfallDataService'

// 辅助变量和函数

export default {
  name: 'StatisticsPage',
  components: {
    ECharts
  },
  setup() {
    const chartData = ref([]);
    const intervalId = ref(null);
    const chartUpdateId = ref(null); // 用于时间轴更新的定时器
    const chartRef = ref(null); // 图表引用

    // 定义时间段选择器
    const timePeriods = [
      { label: '10分钟内', days: 0, hours: 0, minutes: 10 },
      { label: '一小时内', days: 0, hours: 1, minutes: 0 },
      { label: '一天内', days: 1, hours: 0, minutes: 0 },
      { label: '总数据', days: 0, hours: 0, minutes: 0, all: true }
    ];
    const activePeriod = ref(0); // 默认选择"10分钟内"

    // 计算当前小时显示
    const currentHourDisplay = computed(() => {
      const now = new Date();
      return now.getHours();
    });

    // 计算本小时的总雨量 - 修正计算方法
    const currentHourTotal = computed(() => {
      const now = new Date();
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);

      // 筛选本小时的数据
      const hourData = chartData.value.filter(item => {
        const itemDate = new Date(item.value[0]);
        return itemDate >= hourStart;
      });

      if (hourData.length === 0) return "0.0";

      // 计算平均值并乘以时间比例
      const minutesPassed = now.getMinutes() + (now.getSeconds() / 60);
      const hourRatio = minutesPassed / 60; // 小时已过去的比例

      // 计算平均雨量
      const avgRainfall = hourData.reduce((sum, item) => sum + item.value[1], 0) / hourData.length;
      // 估算累计雨量 (平均值 * 已过去的时间比例 * 60分钟)
      const total = avgRainfall * hourRatio * 60;

      return total.toFixed(1); // 保留一位小数
    });

    // 更新图表数据
    const updateChartData = () => {
      chartOption.value.series[0].data = chartData.value;
    };

    // 更新X轴配置
    const updateXAxisConfig = (period) => {
      const now = new Date();

      if (period.minutes > 0) {
        // 10分钟内视图 - 使用秒级别的时间轴
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();

        // 生成过去10分钟的标签，每5秒一个
        const labels = [];
        const startTime = new Date(now);
        startTime.setMinutes(now.getMinutes() - period.minutes, 0, 0);

        // 生成从过去10分钟到现在的每5秒的标签
        for (let t = startTime.getTime(); t <= now.getTime(); t += 5000) { // 每5秒一个标签
          const time = new Date(t);
          const h = time.getHours();
          const m = time.getMinutes();
          const s = time.getSeconds();
          labels.push(`${h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`);
        }

        chartOption.value.xAxis = {
          type: 'category',
          data: labels,
          boundaryGap: false,
          splitLine: {
            show: true,
            lineStyle: {
              color: '#ddd',
              type: 'dashed'
            }
          },
          axisLabel: {
            interval: function(_, value) {
              // 每30秒显示一个标签
              const parts = value.split(':');
              return parseInt(parts[2]) % 30 === 0;
            },
            formatter: function(value) {
              // 只显示小时和分钟
              const parts = value.split(':');
              return `${parts[0]}:${parts[1]}`;
            },
            showMinLabel: true,
            showMaxLabel: true
          },
          axisPointer: {
            label: {
              formatter: function (params) {
                return params.value;
              }
            }
          },
          // 添加当前时间的标记线
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: {
              color: '#ff0000',
              width: 2,
              type: 'solid'
            },
            data: [
              {
                xAxis: `${currentHour}:${currentMinute < 10 ? '0' + currentMinute : currentMinute}:${currentSecond < 10 ? '0' + currentSecond : currentSecond}`,
                label: {
                  formatter: '当前时间',
                  position: 'start'
                }
              }
            ]
          }
        };
      } else if (period.hours > 0) {
        // 一小时内视图 - 使用分钟级别的时间轴
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // 生成过去一小时的标签，每10分钟一个
        const labels = [];
        const startTime = new Date(now);
        startTime.setHours(now.getHours() - period.hours, 0, 0, 0);

        // 生成从过去一小时到现在的每10分钟的标签
        for (let t = startTime.getTime(); t <= now.getTime(); t += 10 * 60 * 1000) { // 每10分钟一个标签
          const time = new Date(t);
          const h = time.getHours();
          const m = time.getMinutes();
          labels.push(`${h}:${m < 10 ? '0' + m : m}`);
        }

        chartOption.value.xAxis = {
          type: 'category',
          data: labels,
          boundaryGap: false,
          splitLine: {
            show: true,
            lineStyle: {
              color: '#ddd',
              type: 'dashed'
            }
          },
          axisLabel: {
            interval: 0, // 显示所有标签
            showMinLabel: true,
            showMaxLabel: true
          },
          axisPointer: {
            label: {
              formatter: function (params) {
                return params.value;
              }
            }
          },
          // 添加当前时间的标记线
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: {
              color: '#ff0000',
              width: 2,
              type: 'solid'
            },
            data: [
              {
                xAxis: `${currentHour}:${currentMinute < 10 ? '0' + currentMinute : currentMinute}`,
                label: {
                  formatter: '当前时间',
                  position: 'start'
                }
              }
            ]
          }
        };
      } else if (period.days > 0) {
        // 一天内视图 - 使用小时级别的时间轴
        const currentHour = now.getHours();

        // 生成过去一天的标签，每小时一个
        const labels = [];
        const startTime = new Date(now);
        startTime.setDate(startTime.getDate() - period.days);
        startTime.setHours(0, 0, 0, 0);

        // 生成从过去一天到现在的每小时的标签
        for (let t = startTime.getTime(); t <= now.getTime(); t += 60 * 60 * 1000) { // 每小时一个标签
          const time = new Date(t);
          const h = time.getHours();
          labels.push(`${h}:00`);
        }

        chartOption.value.xAxis = {
          type: 'category',
          data: labels,
          boundaryGap: false,
          splitLine: {
            show: true,
            lineStyle: {
              color: '#ddd',
              type: 'dashed'
            }
          },
          axisLabel: {
            interval: 2, // 每3小时显示一个标签
            showMinLabel: true,
            showMaxLabel: true
          },
          axisPointer: {
            label: {
              formatter: function (params) {
                return params.value;
              }
            }
          },
          // 添加当前时间的标记线
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: {
              color: '#ff0000',
              width: 2,
              type: 'solid'
            },
            data: [
              {
                xAxis: `${currentHour}:00`,
                label: {
                  formatter: '当前时间',
                  position: 'start'
                }
              }
            ]
          }
        };
      } else {
        // 总数据视图 - 使用天级别的时间轴
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 生成过去30天的标签，每天一个
        const labels = [];
        const startTime = new Date(today);
        startTime.setDate(startTime.getDate() - 30);

        // 生成从过去30天到今天的每天的标签
        for (let t = startTime.getTime(); t <= today.getTime(); t += 24 * 60 * 60 * 1000) { // 每天一个标签
          const time = new Date(t);
          const m = time.getMonth() + 1;
          const d = time.getDate();
          labels.push(`${m}/${d}`);
        }

        chartOption.value.xAxis = {
          type: 'category',
          data: labels,
          boundaryGap: false,
          splitLine: {
            show: true,
            lineStyle: {
              color: '#ddd',
              type: 'dashed'
            }
          },
          axisLabel: {
            interval: 2, // 每3天显示一个标签
            showMinLabel: true,
            showMaxLabel: true
          },
          axisPointer: {
            label: {
              formatter: function (params) {
                return params.value;
              }
            }
          },
          // 添加当前时间的标记线
          markLine: {
            symbol: 'none',
            silent: true,
            lineStyle: {
              color: '#ff0000',
              width: 2,
              type: 'solid'
            },
            data: [
              {
                xAxis: `${today.getMonth() + 1}/${today.getDate()}`,
                label: {
                  formatter: '今天',
                  position: 'start'
                }
              }
            ]
          }
        };
      }
    };

    // 实时更新时间轴
    const startChartTimeUpdate = () => {
      // 清除可能存在的旧计时器
      if (chartUpdateId.value) {
        clearInterval(chartUpdateId.value);
      }

      // 每秒更新一次时间轴
      chartUpdateId.value = setInterval(() => {
        // 获取当前时间
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // 更新X轴的配置，使其与现实时间同步
        if (chartRef.value && chartRef.value.getEchartsInstance) {
          const echartsInstance = chartRef.value.getEchartsInstance();
          const period = timePeriods[activePeriod.value];

          // 根据不同的时间段设置不同的标记线
          let markLineData = [];
          if (period.minutes > 0) {
            // 10分钟内视图
            const currentSecond = now.getSeconds();
            markLineData = [{
              xAxis: `${currentHour}:${currentMinute < 10 ? '0' + currentMinute : currentMinute}:${currentSecond < 10 ? '0' + currentSecond : currentSecond}`,
              label: {
                formatter: '当前时间',
                position: 'start'
              }
            }];
          } else if (period.hours > 0) {
            // 一小时内视图
            markLineData = [{
              xAxis: `${currentHour}:${currentMinute < 10 ? '0' + currentMinute : currentMinute}`,
              label: {
                formatter: '当前时间',
                position: 'start'
              }
            }];
          } else if (period.days > 0) {
            // 一天内视图
            markLineData = [{
              xAxis: `${currentHour}:00`,
              label: {
                formatter: '当前时间',
                position: 'start'
              }
            }];
          } else {
            // 总数据视图
            markLineData = [{
              xAxis: `${now.getMonth() + 1}/${now.getDate()}`,
              label: {
                formatter: '今天',
                position: 'start'
              }
            }];
          }

          // 更新标记线
          echartsInstance.setOption({
            xAxis: {
              markLine: {
                data: markLineData
              }
            }
          });
        }
      }, 1000); // 每秒更新一次
    };

    // 切换时间段
    const changePeriod = (index) => {
      activePeriod.value = index;

      // 获取当前时间段类型
      const periodType = getPeriodType(index);

      // 从后端获取数据
      fetchDataFromBackend(periodType);

      // 更新图表标题和单位
      const unit = index === 3 ? 'mm/天' : 'mm/h';
      chartOption.value.title.text = `雨量显示 (${unit}) - ${timePeriods[index].label}`;

      // 更新Y轴名称
      chartOption.value.yAxis.name = index === 3 ? '雨量 (mm/天)' : '雨量 (mm/h)';

      // 清除并重新启动定时器
      if (intervalId.value) {
        clearInterval(intervalId.value);
      }

      // 设置定时器，每5秒更新一次
      intervalId.value = setInterval(() => {
        fetchDataFromBackend(periodType);
      }, 5000);
    };

    // 启动定时数据更新
    const startDataPolling = () => {
      console.log('启动定时数据更新，每5秒一次');

      // 清除可能存在的旧计时器
      if (intervalId.value) {
        clearInterval(intervalId.value);
        console.log('清除旧的定时器');
      }

      // 获取当前时间段的数据
      const periodType = getPeriodType(activePeriod.value);
      console.log(`从后端获取${periodType}数据`);

      // 立即获取一次数据
      fetchDataFromBackend(periodType);

      // 设置定时器，每5秒更新一次
      intervalId.value = setInterval(() => {
        const now = new Date();
        console.log(`定时器触发，当前时间: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`);

        // 从后端获取最新数据
        fetchDataFromBackend(periodType);

      }, 5000); // 5秒更新一次

      console.log('定时器已启动，ID:', intervalId.value);
    };

    // 获取时间段类型
    const getPeriodType = (periodIndex) => {
      switch (periodIndex) {
        case 0: return '10min';
        case 1: return 'hourly';
        case 2: return 'daily';
        case 3: return 'all';
        default: return '10min';
      }
    };

    // 从后端获取数据
    const fetchDataFromBackend = async (periodType) => {
      try {
        console.log(`开始从后端获取${periodType}数据`);

        const result = await rainfallDataService.fetchStatisticsData(periodType);

        if (result.success) {
          console.log(`成功获取${periodType}数据:`, result.data.length, '个数据点');

          // 更新图表数据
          chartData.value = result.data;

          // 更新当前小时数据（如果有）
          if (result.currentHour) {
            // 更新当前小时累计雨量
            currentHourTotal.value = result.currentHour.total_rainfall.toFixed(1);
          }

          // 更新图表
          updateChartData();

          // 更新X轴配置
          const period = timePeriods[activePeriod.value];
          updateXAxisConfig(period);
        } else {
          console.error(`获取${periodType}数据失败:`, result.error);
        }
      } catch (error) {
        console.error(`获取${periodType}数据错误:`, error);
      }
    };

    // 图表配置
    const chartOption = ref({
      title: {
        text: '雨量显示 (mm/h) - 10分钟内',
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
          var unit = params.data.unit || 'mm'; // 使用数据中的单位信息，如果没有则默认为 mm

          // 根据当前视图调整显示格式
          if (activePeriod.value === 0) {
            // 10分钟内视图 - 只显示时间
            return date.getHours() + ':' +
                  (date.getMinutes() < 10 ? '0' : '') + date.getMinutes() +
                  (params.name.split(':').length > 2 ? ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds() : '') +
                  ' - 雨量: ' + params.value[1] + ' ' + unit;
          } else if (activePeriod.value === 1) {
            // 一小时内视图 - 显示小时和分钟
            return date.getHours() + ':' +
                  (date.getMinutes() < 10 ? '0' : '') + date.getMinutes() +
                  ' - 雨量: ' + params.value[1] + ' ' + unit;
          } else if (activePeriod.value === 2) {
            // 一天内视图 - 显示小时
            return date.getHours() + ':00' +
                  ' - 雨量: ' + params.value[1] + ' ' + unit;
          } else {
            // 总数据视图 - 显示日期
            return (date.getMonth() + 1) + '月' + date.getDate() + '日' +
                  ' - 雨量: ' + params.value[1] + ' ' + unit;
          }
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
        name: function() {
          // 根据当前视图返回不同的单位
          if (activePeriod.value === 3) { // 总数据视图
            return '雨量 (mm/天)';
          } else { // 其他视图
            return '雨量 (mm/h)';
          }
        }()
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

    // 监听图表引用
    watch(() => chartRef.value, (newVal) => {
      if (newVal) {
        // 图表实例已创建，启动时间轴更新
        startChartTimeUpdate();
      }
    });

    // 生命周期钩子
    onMounted(() => {
      // 启动定时更新
      startDataPolling();
    });

    onUnmounted(() => {
      // 清除定时器防止内存泄漏
      if (intervalId.value) {
        clearInterval(intervalId.value);
        intervalId.value = null;
      }

      if (chartUpdateId.value) {
        clearInterval(chartUpdateId.value);
        chartUpdateId.value = null;
      }

      console.log("组件已卸载");
    });

    return {
      chartOption,
      timePeriods,
      activePeriod,
      changePeriod,
      currentHourTotal,
      currentHourDisplay,
      chart: chartRef
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
      padding: var(--spacing-sm);
      background-color: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        background-color: var(--color-primary-light);
      }

      &.active {
        background-color: var(--color-primary);
        color: white;
      }
    }
  }

  /* 本小时雨量显示 */
  .hour-rainfall {
    margin-bottom: var(--spacing-md);

    .rainfall-card {
      background-color: var(--color-bg-secondary);
      border-radius: var(--border-radius);
      padding: var(--spacing-sm);
      text-align: center;
      max-width: 200px;
      margin: 0 auto;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      h3 {
        margin: 0 0 var(--spacing-xs);
        font-size: var(--font-size-md);
        color: var(--color-text-secondary);
      }

      .rainfall-value {
        font-size: var(--font-size-xl);
        font-weight: bold;
        color: var(--color-primary);

        span {
          font-size: var(--font-size-md);
          font-weight: normal;
          color: var(--color-text-secondary);
        }
      }
    }
  }

  .chart-container {
    flex: 1;
    min-height: 300px;
    width: 100%;
    margin: 0 auto;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .statistics {
    padding: var(--spacing-sm);

    h1 {
      font-size: var(--font-size-lg);
      margin-bottom: var(--spacing-sm);
    }

    .time-selector {
      flex-wrap: wrap;

      .time-btn {
        font-size: var(--font-size-xs);
        padding: var(--spacing-xs);
      }
    }

    .chart-container {
      min-height: 250px;
    }
  }
}
</style>
