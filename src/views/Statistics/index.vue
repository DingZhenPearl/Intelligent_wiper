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
        <span class="time-btn-icon">{{ getTimeIcon(index) }}</span>
        <span class="time-btn-label">{{ period.label }}</span>
      </button>
    </div>

    <!-- 添加本小时雨量显示，只在小时视图中显示 -->
    <div v-if="activePeriod === 1" class="hour-rainfall">
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
      // 打印当前视图和数据长度
      console.log(`当前视图: ${activePeriod.value}, 数据长度: ${chartData.value.length}`);

      // 如果是全部视图，打印第一个数据点进行调试
      if (activePeriod.value === 3 && chartData.value.length > 0) {
        console.log('全部视图第一个数据点:', chartData.value[0]);
        console.log('全部视图第一个数据点的value:', chartData.value[0].value);
      }

      // 如果是10分钟视图，使用调整后的时间戳
      if (activePeriod.value === 0 && chartData.value.length > 0) {
        console.log('使用调整后的时间戳显示10分钟视图数据');

        // 检查数据中是否有adjustedDate字段
        const hasAdjustedDate = Object.prototype.hasOwnProperty.call(chartData.value[0], 'adjustedDate');
        if (hasAdjustedDate) {
          console.log('检测到adjustedDate字段，使用调整后的时间戳');
        }
      }

      // 处理数据并更新图表
      if (activePeriod.value === 3) { // 全部视图需要特殊处理
        // 确保日期格式正确
        const processedData = chartData.value.map(item => {
          // 尝试将日期字符串转换为日期对象
          try {
            // 如果是字符串，尝试解析
            if (typeof item.value[0] === 'string') {
              const parts = item.value[0].split('/');
              if (parts.length === 2) {
                const month = parseInt(parts[0]);
                const day = parseInt(parts[1]);
                const date = new Date();
                date.setMonth(month - 1);
                date.setDate(day);
                date.setHours(0, 0, 0, 0);

                // 创建新的数据点
                return {
                  ...item,
                  value: [date, item.value[1]]
                };
              }
            }
            return item;
          } catch (e) {
            console.error('处理日期出错:', e);
            return item;
          }
        });

        console.log('处理后的全部视图数据:', processedData);
        chartOption.value.series[0].data = processedData;
      } else {
        // 其他视图直接使用原始数据
        chartOption.value.series[0].data = chartData.value;
      }
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
          // 使用更紧凑的格式，但保留完整信息便于处理
          labels.push(`${h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`);
        }

        console.log(`生成了10分钟视图的 ${labels.length} 个时间标签`);

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
            interval: function(index, value) {
              // 获取当前标签的分钟值
              const parts = value.split(':');
              const currentMinute = parts[1];

              // 如果是第一个标签，显示
              if (index === 0) return true;

              // 获取前一个标签的分钟值
              const prevValue = labels[index - 1];
              const prevParts = prevValue.split(':');
              const prevMinute = prevParts[1];

              // 如果当前分钟与前一个不同，则显示标签
              return currentMinute !== prevMinute;
            },
            formatter: function(value) {
              // 只显示小时和分钟
              const parts = value.split(':');
              return `${parts[0]}:${parts[1]}`;
            },
            showMinLabel: true,
            showMaxLabel: true,
            // 增加标签间距，避免重叠
            margin: 8
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
          type: 'time',  // 使用时间类型
          boundaryGap: false,
          min: startTime.getTime(),
          max: today.getTime(),
          splitLine: {
            show: true,
            lineStyle: {
              color: '#ddd',
              type: 'dashed'
            }
          },
          axisLabel: {
            formatter: function(value) {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            },
            interval: 2, // 每3天显示一个标签
            showMinLabel: true,
            showMaxLabel: true
          },
          axisPointer: {
            label: {
              formatter: function (params) {
                const date = new Date(params.value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
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
                xAxis: today.getTime(),
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
            // 总数据视图 - 使用时间戳
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            markLineData = [{
              xAxis: today.getTime(),
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
            // 10分钟内视图 - 使用更清晰的格式
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const seconds = date.getSeconds();
            const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
            const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;

            return `${hours}:${formattedMinutes}:${formattedSeconds} - 雨量: ${params.value[1]} ${unit}`;
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

    // 获取时间图标
    const getTimeIcon = (index) => {
      switch (index) {
        case 0: return '⏱️'; // 10分钟内
        case 1: return '🕐'; // 一小时内
        case 2: return '📅'; // 一天内
        case 3: return '📊'; // 总数据
        default: return '⏱️';
      }
    };

    return {
      chartOption,
      timePeriods,
      activePeriod,
      changePeriod,
      currentHourTotal,
      currentHourDisplay,
      chart: chartRef,
      getTimeIcon
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
    margin: 0 auto var(--spacing-lg) auto; /* 增加下方间距 */
    width: 100%;
    max-width: 800px;
    gap: var(--spacing-md); /* 按钮间距 */
    padding: var(--spacing-sm); /* 添加内边距 */
    background-color: rgba(0, 0, 0, 0.03); /* 轻微背景色 */
    border-radius: var(--border-radius-lg); /* 圆角 */

    .time-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-md) var(--spacing-sm); /* 内边距 */
      min-height: 90px; /* 固定最小高度 */
      background-color: white; /* 白色背景 */
      border: 2px solid var(--color-border); /* 边框 */
      border-radius: var(--border-radius-lg); /* 更大的圆角 */
      font-size: var(--font-size-lg); /* 更大字体 */
      font-weight: 600; /* 更粗字体 */
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* 更明显的阴影 */
      position: relative; /* 用于添加指示器 */
      overflow: hidden; /* 确保指示器不超出按钮 */
      color: var(--color-text); /* 文本颜色 */

      /* 按钮图标 */
      .time-btn-icon {
        font-size: 2rem; /* 更大的图标 */
        margin-bottom: var(--spacing-sm); /* 增加间距 */
      }

      /* 按钮文本 */
      .time-btn-label {
        text-align: center;
        font-weight: 600; /* 加粗文本 */
      }

      /* 悬停效果 */
      &:hover {
        background-color: var(--color-primary-light);
        transform: translateY(-3px); /* 更明显的上浮效果 */
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2); /* 更强的阴影 */
        border-color: var(--color-primary); /* 边框颜色变化 */
      }

      /* 活跃状态 */
      &.active {
        background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark)); /* 渐变背景 */
        color: white;
        border-color: var(--color-primary-dark); /* 深色边框 */
        box-shadow: 0 6px 12px rgba(var(--color-primary-rgb), 0.4); /* 更强的彩色阴影 */
        transform: translateY(-2px); /* 轻微上浮 */

        /* 底部指示器 */
        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 5px; /* 更粗的指示器 */
          background-color: var(--color-primary-dark);
        }

        /* 添加顶部标记 */
        &::before {
          content: '✓';
          position: absolute;
          top: 5px;
          right: 5px;
          font-size: 14px;
          background-color: white;
          color: var(--color-primary-dark);
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      }
    }
  }

  /* 本小时雨量显示 */
  .hour-rainfall {
    margin-bottom: var(--spacing-md);

    .rainfall-card {
      background: linear-gradient(135deg, var(--color-bg-secondary), white); /* 渐变背景 */
      border-radius: var(--border-radius-lg); /* 更大的圆角 */
      padding: var(--spacing-md); /* 增加内边距 */
      text-align: center;
      max-width: 250px; /* 增加宽度 */
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* 增强阴影 */
      border: 1px solid rgba(0, 0, 0, 0.05); /* 添加边框 */
      position: relative; /* 用于添加装饰元素 */
      overflow: hidden; /* 防止装饰元素溢出 */

      /* 装饰元素 - 左上角水滴图标 */
      &::before {
        content: '💧'; /* 水滴emoji */
        position: absolute;
        top: 5px;
        left: 5px;
        font-size: 18px;
        opacity: 0.5;
      }

      h3 {
        margin: 0 0 var(--spacing-sm); /* 增加间距 */
        font-size: var(--font-size-md);
        color: var(--color-text-secondary);
        font-weight: 600; /* 加粗 */
      }

      .rainfall-value {
        font-size: 2.2rem; /* 更大的字体 */
        font-weight: bold;
        color: var(--color-primary);
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1); /* 添加文本阴影 */
        display: flex;
        align-items: baseline;
        justify-content: center;

        span {
          font-size: var(--font-size-md);
          font-weight: normal;
          color: var(--color-text-secondary);
          margin-left: 5px; /* 添加间距 */
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
      gap: var(--spacing-sm); /* 减小间距 */
      padding: var(--spacing-xs); /* 减小内边距 */

      .time-btn {
        min-width: calc(50% - var(--spacing-sm)); /* 确保每行最多两个按钮 */
        margin-bottom: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-xs);
        min-height: 70px; /* 减小高度 */

        .time-btn-icon {
          font-size: 1.5rem; /* 缩小图标，但保持可见 */
          margin-bottom: var(--spacing-xs);
        }

        .time-btn-label {
          font-size: var(--font-size-sm);
        }

        /* 移动端上的活跃状态 */
        &.active::before {
          width: 16px; /* 缩小标记 */
          height: 16px;
          font-size: 10px;
          top: 3px;
          right: 3px;
        }
      }
    }

    /* 移动端上的本小时雨量显示 */
    .hour-rainfall .rainfall-card {
      max-width: 180px;
      padding: var(--spacing-xs);

      h3 {
        font-size: var(--font-size-sm);
      }

      .rainfall-value {
        font-size: var(--font-size-lg);
      }
    }

    .chart-container {
      min-height: 250px;
    }
  }
}
</style>
