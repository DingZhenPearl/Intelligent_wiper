<template>
  <div class="statistics">
    <h1>数据统计</h1>

    <!-- 时间选择器组件移到图表上方 -->
    <div class="time-selector">
      <button
        v-for="(period, index) in allPeriods"
        :key="index"
        class="time-btn"
        :class="{ active: activePeriod === index }"
        @click="changePeriod(index)"
      >
        <span class="time-btn-icon">{{ getTimeIcon(index) }}</span>
        <span class="time-btn-label">{{ period.label }}</span>
      </button>

      <!-- 添加手动聚合按钮 -->
      <button
        class="aggregate-btn"
        @click="triggerAggregation"
        :disabled="isAggregating"
      >
        {{ isAggregating ? '聚合中...' : '手动聚合数据' }}
      </button>
    </div>



    <!-- 显示图表 -->
    <div class="chart-container">
      <e-charts
        v-if="activePeriod !== 4"
        ref="chart"
        :option="chartOption"
        :auto-resize="true"
        style="width: 100%; height: 100%;"
      />
      <e-charts
        v-else
        ref="rawChart"
        :option="rawChartOption"
        :auto-resize="true"
        style="width: 100%; height: 100%;"
      />
    </div>
  </div>
</template>

<script>
// reactive
import { ref, onMounted, onUnmounted, computed } from 'vue'
import ECharts from '@/components/ECharts'
import rainfallDataService from '@/services/rainfallDataService'
import oneNetService from '@/services/oneNetService'

// 辅助变量和函数

export default {
  name: 'StatisticsPage',
  components: {
    ECharts
  },
  setup() {
    const chartData = ref([]);
    const rawChartData = ref([]); // 原始数据
    const intervalId = ref(null);
    const rawIntervalId = ref(null); // 原始数据更新定时器
    const chartUpdateId = ref(null); // 用于时间轴更新的定时器
    const chartRef = ref(null); // 图表引用
    const rawChartRef = ref(null); // 原始数据图表引用
    // 定义所有时间段选择器，包括原始数据
    const allPeriods = [
      { label: '10分钟内', days: 0, hours: 0, minutes: 10 },
      { label: '一小时内', days: 0, hours: 1, minutes: 0 },
      { label: '一天内', days: 1, hours: 0, minutes: 0 },
      { label: '总数据', days: 0, hours: 0, minutes: 0, all: true },
      { label: '原始数据', raw: true } // 添加原始数据选项
    ];
    const activePeriod = ref(0); // 默认选择"10分钟内"

    // 原始数据固定使用6小时时间范围
    const rawDataTimeRange = '6h';

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

      // 如果没有数据，显示空图表
      if (chartData.value.length === 0) {
        console.log('没有数据，显示空图表');
        chartOption.value.series[0].data = [];

        // 更新图表标题，根据当前视图
        const periodLabels = {
          0: '10分钟内',
          1: '一小时内',
          2: '一天内',
          3: '总数据'
        };

        // 如果标题中没有错误信息，则更新为默认标题
        if (!chartOption.value.title.subtext) {
          const unit = activePeriod.value === 3 ? 'mm/天' : 'mm/h';
          chartOption.value.title.text = `雨量显示 (${unit}) - ${periodLabels[activePeriod.value]}`;
        }

        return;
      }

      // 如果是全部视图，打印第一个数据点进行调试
      if (activePeriod.value === 3 && chartData.value.length > 0) {
        console.log('全部视图第一个数据点:', chartData.value[0]);
        console.log('全部视图第一个数据点的value:', chartData.value[0].value);

        // 检查数据格式，确保可以正确显示
        const firstPoint = chartData.value[0];
        if (firstPoint && firstPoint.value && firstPoint.value.length === 2) {
          console.log('全部视图数据格式正确，包含日期和值');
        } else {
          console.warn('全部视图数据格式可能不正确:', firstPoint);
        }
      }

      // 获取当前时间范围
      const now = new Date();
      let startTime = new Date(now);
      let endTime = new Date(now);

      // 根据当前视图设置时间范围
      if (activePeriod.value === 0) { // 10分钟内
        startTime.setMinutes(now.getMinutes() - 10, 0, 0);
      } else if (activePeriod.value === 1) { // 一小时内
        startTime.setHours(now.getHours() - 1, 0, 0, 0);
      } else if (activePeriod.value === 2) { // 一天内
        // 设置为当天的0点到23:59:59
        startTime.setHours(0, 0, 0, 0);
        endTime.setHours(23, 59, 59, 999);
        console.log(`一天内视图: 使用当天时间范围 ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);
      } else if (activePeriod.value === 3) { // 总数据
        startTime.setDate(startTime.getDate() - 30);
        startTime.setHours(0, 0, 0, 0);
        endTime.setHours(23, 59, 59, 999);
        console.log(`总数据视图: 使用30天时间范围 ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);
      }

      console.log(`当前视图时间范围: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);

      // 简化的数据处理逻辑
      const processedData = chartData.value.map(item => {
        try {
          // 确保item.value是数组且有两个元素
          if (!Array.isArray(item.value) || item.value.length !== 2) {
            console.warn('数据点格式不正确:', item);
            return null;
          }

          const dateStr = item.value[0];
          const value = item.value[1];
          let date;

          // 如果第一个元素已经是日期对象，直接使用
          if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
            date = dateStr;
          }
          // 如果是字符串，尝试解析为日期
          else if (typeof dateStr === 'string') {
            // 总数据视图特殊处理
            if (activePeriod.value === 3 && dateStr.includes('/')) {
              // 格式: "月/日"
              const parts = dateStr.split('/');
              if (parts.length === 2) {
                const month = parseInt(parts[0]) - 1; // 月份从0开始
                const day = parseInt(parts[1]);
                date = new Date();
                date.setMonth(month);
                date.setDate(day);
                date.setHours(0, 0, 0, 0);

                console.log(`总数据视图: 解析日期 ${dateStr} -> ${date.toISOString()}`);
              }
            } else {
              // 尝试使用标准日期解析
              date = new Date(dateStr);

              // 如果解析失败，尝试特殊格式
              if (isNaN(date.getTime())) {
                if (dateStr.includes('/')) {
                  // 格式: "月/日"
                  const parts = dateStr.split('/');
                  if (parts.length === 2) {
                    const month = parseInt(parts[0]) - 1; // 月份从0开始
                    const day = parseInt(parts[1]);
                    date = new Date();
                    date.setMonth(month);
                    date.setDate(day);
                    date.setHours(0, 0, 0, 0);
                  }
                } else if (dateStr.includes(':')) {
                  // 格式: "HH:MM:SS" 或 "HH:MM"
                  const parts = dateStr.split(':');
                  date = new Date();
                  date.setHours(parseInt(parts[0]));
                  date.setMinutes(parts.length > 1 ? parseInt(parts[1]) : 0);
                  date.setSeconds(parts.length > 2 ? parseInt(parts[2]) : 0);
                }
              }
            }
          }

          // 如果日期解析失败，尝试使用originalDate
          if (!date || isNaN(date.getTime())) {
            if (item.originalDate) {
              date = new Date(item.originalDate);
              if (isNaN(date.getTime())) {
                console.warn(`无法解析日期: ${item.originalDate}`);
                return null;
              }
            } else {
              console.warn(`无法解析日期: ${dateStr}`);
              return null;
            }
          }

          // 对于一天内视图，确保日期是当天
          if (activePeriod.value === 2) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 创建新的日期对象，使用今天的日期和原始的时间
            const adjustedDate = new Date(today);
            adjustedDate.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), 0);

            return {
              ...item,
              value: [adjustedDate, value]
            };
          }

          return {
            ...item,
            value: [date, value]
          };
        } catch (e) {
          console.error('处理日期出错:', e, item);
          return null;
        }
      }).filter(item => item !== null); // 过滤掉处理失败的项

      // 过滤不在时间范围内的数据点
      const filteredData = processedData.filter(item => {
        if (item.value && item.value[0] instanceof Date) {
          const pointDate = item.value[0];

          // 对于一天内视图，只检查是否是当天
          if (activePeriod.value === 2) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const pointDay = new Date(pointDate);
            pointDay.setHours(0, 0, 0, 0);
            return pointDay.getTime() === today.getTime();
          } else {
            // 其他视图使用时间范围检查
            return pointDate >= startTime && pointDate <= endTime;
          }
        }
        return false;
      });

      console.log(`过滤后的${activePeriod.value}视图数据:`, filteredData);

      // 更新图表数据
      chartOption.value.series[0].data = filteredData;

      // 更新图表标题
      const periodLabels = {
        0: '10分钟内',
        1: '一小时内',
        2: '一天内',
        3: '总数据'
      };

      // 如果标题中没有错误信息，则更新为默认标题
      if (!chartOption.value.title.subtext) {
        const unit = activePeriod.value === 3 ? 'mm/天' : 'mm/h';
        chartOption.value.title.text = `雨量显示 (${unit}) - ${periodLabels[activePeriod.value]}`;
      }
    };

    // 更新X轴配置
    const updateXAxisConfig = (period) => {
      const now = new Date();

      // 所有视图都使用时间类型的X轴
      const startTime = new Date(now);
      let endTime = new Date(now);
      let markLineData = [];

      if (period.minutes > 0) {
        // 10分钟内视图
        startTime.setMinutes(now.getMinutes() - period.minutes, 0, 0);

        // 当前时间标记线
        markLineData = [{
          xAxis: now.getTime(),
          label: {
            formatter: '当前时间',
            position: 'start'
          }
        }];
      } else if (period.hours > 0) {
        // 一小时内视图
        startTime.setHours(now.getHours() - period.hours, 0, 0, 0);

        // 当前时间标记线
        markLineData = [{
          xAxis: now.getTime(),
          label: {
            formatter: '当前时间',
            position: 'start'
          }
        }];
      } else if (period.days > 0) {
        // 一天内视图
        startTime.setDate(startTime.getDate() - period.days);
        startTime.setHours(0, 0, 0, 0);

        // 当前时间标记线
        markLineData = [{
          xAxis: now.getTime(),
          label: {
            formatter: '当前时间',
            position: 'start'
          }
        }];
      } else {
        // 总数据视图
        startTime.setDate(startTime.getDate() - 30);
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date(now);
        endTime.setHours(23, 59, 59, 999);

        // 今天标记线
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

      console.log(`时间范围: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);

      // 设置X轴配置
      chartOption.value.xAxis = {
        type: 'time',
        boundaryGap: false,
        min: startTime.getTime(),
        max: endTime.getTime(),
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

            // 根据当前视图选择不同的格式
            if (period.minutes > 0) {
              // 10分钟内视图 - 显示小时:分钟
              return `${date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}`;
            } else if (period.hours > 0) {
              // 一小时内视图 - 显示小时:分钟
              return `${date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}`;
            } else if (period.days > 0) {
              // 一天内视图 - 显示小时:00
              return `${date.getHours()}:00`;
            } else {
              // 总数据视图 - 显示月/日
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }
          },
          interval: function(index) {
            // 根据当前视图选择不同的间隔
            if (period.minutes > 0) {
              return index % 2 === 0; // 每2个标签显示1个
            } else if (period.hours > 0) {
              return index % 3 === 0; // 每3个标签显示1个
            } else if (period.days > 0) {
              return index % 4 === 0; // 每4个标签显示1个
            } else {
              return index % 3 === 0; // 每3个标签显示1个
            }
          },
          showMinLabel: true,
          showMaxLabel: true,
          // 增加标签间距，避免重叠
          margin: 8
        },
        axisPointer: {
          label: {
            formatter: function (params) {
              try {
                const date = new Date(params.value);

                // 检查日期是否有效
                if (isNaN(date.getTime())) {
                  return '时间未知';
                }

                // 根据当前视图选择不同的格式
                if (period.minutes > 0) {
                  // 10分钟内视图 - 显示小时:分钟:秒
                  return `${date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}:${date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds()}`;
                } else if (period.hours > 0) {
                  // 一小时内视图 - 显示小时:分钟
                  return `${date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}`;
                } else if (period.days > 0) {
                  // 一天内视图 - 显示小时:00
                  return `${date.getHours()}:00`;
                } else {
                  // 总数据视图 - 显示月/日
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }
              } catch (e) {
                console.error('格式化轴指针标签出错:', e);
                return '时间未知';
              }
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
          data: markLineData
        }
      };
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
          const period = allPeriods[activePeriod.value];

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

      // 如果选择的是原始数据（索引4）
      if (index === 4) {
        console.log('切换到原始数据显示');

        // 获取原始数据
        fetchRawData();

        // 清除聚合数据的定时器
        if (intervalId.value) {
          clearInterval(intervalId.value);
          intervalId.value = null;
        }

        // 设置原始数据的定时器，每5秒更新一次
        if (!rawIntervalId.value) {
          rawIntervalId.value = setInterval(() => {
            fetchRawData();
          }, 5000);
        }

        // 确保显示全部范围
        if (rawChartOption.value && rawChartOption.value.dataZoom) {
          rawChartOption.value.dataZoom[0].start = 0;
          rawChartOption.value.dataZoom[0].end = 100;
          rawChartOption.value.dataZoom[1].start = 0;
          rawChartOption.value.dataZoom[1].end = 100;
        }

        return; // 不需要执行下面的聚合数据逻辑
      }

      // 如果切换到聚合数据，清除原始数据的定时器
      if (rawIntervalId.value) {
        clearInterval(rawIntervalId.value);
        rawIntervalId.value = null;
      }

      // 获取当前时间段类型
      const periodType = getPeriodType(index);

      // 清除错误信息
      chartOption.value.title.subtext = '';

      // 更新图表标题和单位
      const unit = index === 3 ? 'mm/天' : 'mm/h';
      chartOption.value.title.text = `雨量显示 (${unit}) - ${allPeriods[index].label}`;

      // 更新Y轴名称
      chartOption.value.yAxis.name = index === 3 ? '雨量 (mm/天)' : '雨量 (mm/h)';

      // 从后端获取数据
      fetchDataFromBackend(periodType);

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
        case 4: return 'raw'; // 原始数据
        default: return '10min';
      }
    };



    // 手动触发数据聚合
    const isAggregating = ref(false);
    const triggerAggregation = async () => {
      try {
        // 设置聚合状态
        isAggregating.value = true;

        // 从 localStorage 中获取用户名
        let username = 'admin'; // 默认用户名
        const userDataStr = localStorage.getItem('user');

        if (userDataStr) {
          try {
            const userData = JSON.parse(userDataStr);
            if (userData && userData.username) {
              username = userData.username;
            }
          } catch (e) {
            console.error('[统计页面] 解析用户信息出错:', e);
          }
        }

        console.log(`[统计页面] 手动触发数据聚合，用户名: ${username}`);

        // 调用后端API触发聚合
        const response = await fetch(`/api/rainfall/aggregate?username=${encodeURIComponent(username)}`);
        const result = await response.json();

        if (result.success) {
          console.log('[统计页面] 数据聚合成功:', result);

          // 显示成功消息
          alert('数据聚合成功，将在下次数据刷新时显示');

          // 立即刷新数据
          const periodType = getPeriodType(activePeriod.value);
          fetchDataFromBackend(periodType);
        } else {
          console.error('[统计页面] 数据聚合失败:', result);
          alert(`数据聚合失败: ${result.error || '未知错误'}`);
        }
      } catch (error) {
        console.error('[统计页面] 触发数据聚合错误:', error);
        alert(`触发数据聚合错误: ${error.message || '未知错误'}`);
      } finally {
        // 重置聚合状态
        isAggregating.value = false;
      }
    };

    // 从后端获取数据
    const fetchDataFromBackend = async (periodType) => {
      try {
        console.log(`开始从后端获取${periodType}数据`);

        const result = await rainfallDataService.fetchStatisticsData(periodType);

        if (result.success) {
          console.log(`成功获取${periodType}数据:`, result.data ? result.data.length : 0, '个数据点');

          // 直接使用后端返回的数据，不进行额外过滤
          chartData.value = result.data || [];

          // 更新当前小时数据（如果有）
          if (result.currentHour) {
            // 更新当前小时累计雨量
            currentHourTotal.value = result.currentHour.total_rainfall.toFixed(1);
          }

          // 检查是否有警告信息
          if (result.warning) {
            console.warn(`获取${periodType}数据警告:`, result.warning);

            // 显示警告信息
            chartOption.value.title.text = `雨量显示 - OneNET数据`;
            chartOption.value.title.subtext = `提示: ${result.warning}`;
          } else {
            // 清除之前的警告信息
            chartOption.value.title.subtext = '';
          }

          // 更新图表
          updateChartData();

          // 更新X轴配置
          const period = allPeriods[activePeriod.value];
          updateXAxisConfig(period);
        } else {
          console.error(`获取${periodType}数据失败:`, result.error);

          // 显示错误信息
          chartOption.value.title.text = `雨量显示 - OneNET数据获取失败`;
          chartOption.value.title.subtext = `错误: ${result.error}`;

          // 清空图表数据但保持图表结构
          chartData.value = [];
          updateChartData();
        }
      } catch (error) {
        console.error(`获取${periodType}数据错误:`, error);

        // 显示错误信息
        chartOption.value.title.text = `雨量显示 - OneNET数据获取失败`;
        chartOption.value.title.subtext = `错误: ${error.message || '未知错误'}`;

        // 清空图表数据但保持图表结构
        chartData.value = [];
        updateChartData();
      }
    };

    // 图表配置
    const chartOption = ref({
      title: {
        text: '雨量显示 (mm/h) - 10分钟内',
        subtext: '',
        textStyle: {
          fontSize: 16
        },
        subtextStyle: {
          color: '#e74c3c',  // 红色错误信息
          fontSize: 14
        },
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          params = params[0];

          // 使用数据中的单位信息，如果没有则根据当前视图设置默认单位
          var unit = params.data && params.data.unit ? params.data.unit : (activePeriod.value === 3 ? 'mm/天' : 'mm/h');

          // 获取雨量值
          var rainfallValue = params.value && params.value.length > 1 ? params.value[1] : 0;

          // 尝试获取有效的日期对象
          var dateStr = '';
          var date;

          // 首先尝试从params.value[0]获取日期
          if (params.value && params.value.length > 0 && params.value[0] instanceof Date) {
            date = params.value[0];
          }
          // 然后尝试从params.name获取日期
          else if (params.name) {
            try {
              date = new Date(params.name);
              // 检查日期是否有效
              if (isNaN(date.getTime())) {
                date = null;
              }
            } catch (e) {
              date = null;
            }
          }

          // 如果有原始日期字符串，直接使用
          if (params.data && params.data.originalDate) {
            dateStr = params.data.originalDate;
          }
          // 如果有有效的日期对象，格式化它
          else if (date && !isNaN(date.getTime())) {
            // 根据当前视图调整显示格式
            if (activePeriod.value === 0) {
              // 10分钟内视图 - 使用更清晰的格式
              const hours = date.getHours();
              const minutes = date.getMinutes();
              const seconds = date.getSeconds();
              const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
              const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;
              dateStr = `${hours}:${formattedMinutes}:${formattedSeconds}`;
            } else if (activePeriod.value === 1) {
              // 一小时内视图 - 显示小时和分钟
              dateStr = date.getHours() + ':' +
                      (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes());
            } else if (activePeriod.value === 2) {
              // 一天内视图 - 显示小时
              dateStr = date.getHours() + ':00';
            } else {
              // 总数据视图 - 显示日期
              dateStr = (date.getMonth() + 1) + '月' + date.getDate() + '日';
            }
          } else {
            // 如果没有有效日期，使用默认值
            dateStr = '时间未知';
          }

          return `${dateStr} - 雨量: ${rainfallValue} ${unit}`;
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
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#3498db'
          },
          emphasis: {
            itemStyle: {
              color: '#2980b9',
              borderColor: '#fff',
              borderWidth: 2,
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.3)'
            }
          },
          areaStyle: {
            opacity: 0.3
          },
          data: []
        }
      ]
    });

    // 原始数据图表配置
    const rawChartOption = ref({
      title: {
        text: 'OneNET原始数据',
        subtext: '',
        textStyle: {
          fontSize: 16
        },
        subtextStyle: {
          color: '#e74c3c',  // 红色错误信息
          fontSize: 14
        },
        left: 'center'
      },
      tooltip: {
        trigger: 'item',  // 使用item触发，适合散点图
        formatter: function (params) {
          // 获取雨量值 - 现在直接使用value
          var rainfallValue = params.value !== undefined ? params.value : 0;

          // 获取原始时间字符串
          var timeStr = params.data && params.data.originalTime ? params.data.originalTime : '时间未知';

          // 获取序号信息
          const name = params.data && params.data.name ? params.data.name : `数据点 #${params.dataIndex + 1}`;

          return `${name}<br/>时间: ${timeStr}<br/>雨量: ${rainfallValue} mm/h`;
        },
        backgroundColor: 'rgba(50, 50, 50, 0.9)',
        borderColor: '#e74c3c',
        textStyle: {
          color: '#fff'
        },
        extraCssText: 'box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);'
      },
      xAxis: {
        type: 'category',  // 使用类别轴，使点之间间隔固定
        splitLine: {
          show: false
        },
        axisLabel: {
          formatter: function(_, index) {
            // 只显示序号，不显示时间
            return `#${index + 1}`;
          },
          interval: function(index) {
            // 控制标签显示间隔，每5个点显示一个标签
            return index % 5 === 0;
          },
          rotate: 0,
          hideOverlap: true
        },
        axisTick: {
          alignWithLabel: true
        },
        // 启用缩放功能
        scale: true
      },
      yAxis: {
        type: 'value',
        boundaryGap: [0, '100%'],
        splitLine: {
          show: true
        },
        name: '雨量 (mm/h)'
      },
      grid: {
        containLabel: true,
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '60px'
      },
      // 添加缩放功能
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
          filterMode: 'filter'
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          filterMode: 'filter'
        }
      ],
      series: [
        {
          name: '原始雨量数据',
          type: 'bar',      // 使用柱状图显示原始数据
          showBackground: true,
          backgroundStyle: {
            color: 'rgba(180, 180, 180, 0.2)'
          },
          itemStyle: {
            color: '#e74c3c',  // 红色柱子
            borderRadius: [4, 4, 0, 0]  // 圆角柱子
          },
          emphasis: {
            itemStyle: {
              color: '#c0392b',
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.3)'
            }
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            fontSize: 12,
            color: '#333'
          },
          data: []
        }
      ]
    });

    // 获取原始数据
    const fetchRawData = async () => {
      try {
        console.log(`开始获取OneNET原始数据，时间范围: ${rawDataTimeRange}`);

        // 调用OneNET服务获取原始数据
        const result = await oneNetService.fetchRawData(rawDataTimeRange);

        if (result.success) {
          console.log(`成功获取OneNET原始数据:`, result.data ? result.data.length : 0, '个数据点');

          // 更新图表数据
          rawChartData.value = result.data || [];

          // 检查原始数据格式
          if (rawChartData.value.length > 0) {
            console.log('原始数据第一个点:', rawChartData.value[0]);
          }

          // 简化的数据处理逻辑
          const processedData = rawChartData.value.map((point, index) => {
            try {
              // 确保point.value是数组且有两个元素
              if (!Array.isArray(point.value) || point.value.length !== 2) {
                console.warn('原始数据点格式不正确:', point);
                return null;
              }

              let timestamp = point.value[0];
              const value = point.value[1];

              // 尝试将时间戳转换为日期对象，用于tooltip显示
              let date;
              if (timestamp instanceof Date) {
                date = timestamp;
              } else if (typeof timestamp === 'string') {
                date = new Date(timestamp);
                if (isNaN(date.getTime())) {
                  console.warn(`无法解析原始数据时间戳: ${timestamp}`);
                  return null;
                }
              } else {
                console.warn(`不支持的时间戳类型: ${typeof timestamp}`);
                return null;
              }

              // 格式化时间戳为可读字符串，用于tooltip显示
              const formattedTime = date.toLocaleString();

              return {
                name: `数据点 #${index + 1}`,
                value: value,  // 直接使用雨量值
                originalTime: formattedTime,  // 保存原始时间用于tooltip显示
                timestamp: date  // 保存日期对象用于排序
              };
            } catch (e) {
              console.error('处理原始数据点出错:', e, point);
              return null;
            }
          }).filter(item => item !== null); // 过滤掉处理失败的项

          // 按时间排序
          processedData.sort((a, b) => {
            return a.timestamp - b.timestamp;
          });

          // 更新图表
          rawChartOption.value.series[0].data = processedData;

          // 如果有消息，显示在副标题中
          if (result.message) {
            rawChartOption.value.title.subtext = `${result.message}`;
          } else {
            rawChartOption.value.title.subtext = '';
          }

          // 更新图表标题，显示数据点数量
          rawChartOption.value.title.text = `OneNET原始数据 - ${processedData.length}个数据点`;

          // 重置缩放
          rawChartOption.value.dataZoom[0].start = 0;
          rawChartOption.value.dataZoom[0].end = 100;
          rawChartOption.value.dataZoom[1].start = 0;
          rawChartOption.value.dataZoom[1].end = 100;
        } else {
          console.error(`获取OneNET原始数据失败:`, result.error);

          // 显示错误信息
          rawChartOption.value.title.subtext = `错误: ${result.error}`;

          // 清空图表数据但保持图表结构
          rawChartData.value = [];
          rawChartOption.value.series[0].data = [];

          // 重置图表标题
          rawChartOption.value.title.text = 'OneNET原始数据 - 无数据';
        }
      } catch (error) {
        console.error(`获取OneNET原始数据错误:`, error);

        // 显示错误信息
        rawChartOption.value.title.subtext = `错误: ${error.message || '未知错误'}`;

        // 清空图表数据但保持图表结构
        rawChartData.value = [];
        rawChartOption.value.series[0].data = [];
      }
    };

    // 在onMounted中启动时间轴更新

    // 数据源始终为OneNET平台
    console.log('[Statistics] 使用OneNET平台作为数据源');

    // 生命周期钩子
    onMounted(() => {
      // 启动定时更新
      startDataPolling();

      // 启动时间轴更新
      if (chartRef.value) {
        startChartTimeUpdate();
      }
    });

    onUnmounted(() => {
      // 清除定时器防止内存泄漏
      if (intervalId.value) {
        clearInterval(intervalId.value);
        intervalId.value = null;
      }

      if (rawIntervalId.value) {
        clearInterval(rawIntervalId.value);
        rawIntervalId.value = null;
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
        case 4: return '📈'; // 原始数据
        default: return '⏱️';
      }
    };

    return {
      chartOption,
      rawChartOption,
      allPeriods,
      activePeriod,
      changePeriod,
      currentHourTotal,
      currentHourDisplay,
      chart: chartRef,
      rawChart: rawChartRef,
      getTimeIcon,
      isAggregating,
      triggerAggregation
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
    flex-wrap: wrap; /* 允许换行 */
    margin: 0 auto var(--spacing-lg) auto; /* 增加下方间距 */
    width: 100%;
    max-width: 800px;
    gap: var(--spacing-md); /* 按钮间距 */
    padding: var(--spacing-sm); /* 添加内边距 */
    background-color: rgba(0, 0, 0, 0.03); /* 轻微背景色 */
    border-radius: var(--border-radius-lg); /* 圆角 */

    /* 手动聚合按钮样式 */
    .aggregate-btn {
      margin-top: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      background-color: var(--color-secondary);
      color: white;
      border: none;
      border-radius: var(--border-radius-md);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      &:hover:not(:disabled) {
        background-color: var(--color-secondary-dark);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }

      &:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
        opacity: 0.7;
      }
    }

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
    margin-bottom: var(--spacing-lg);
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

      /* 移动端上的聚合按钮 */
      .aggregate-btn {
        width: 100%;
        margin-top: var(--spacing-sm);
        padding: var(--spacing-xs);
        font-size: var(--font-size-sm);
      }

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
