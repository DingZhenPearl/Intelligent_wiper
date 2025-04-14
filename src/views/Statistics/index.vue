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
import rainfallService from '@/services/rainfallService'

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
    const globalMockData = ref([]); // 存储全局模拟数据

    // 上一次生成数据的时间和值
    let lastDataTime = new Date();
    let lastValue = Math.random() * 20; // 初始值较小，更合理

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

    // 生成随机数据 - 修正为更合理的变化
    const randomData = () => {
      const currentDate = new Date();

      // 计算与上次数据的时间差（秒）
      const timeDiff = (currentDate - lastDataTime) / 1000;

      // 根据时间差生成合理的变化量（时间差越大，变化可能越大）
      // 但总体保持在较小范围内波动
      const change = (Math.random() * 4 - 2) * Math.min(timeDiff / 60, 1);

      // 确保值在合理范围内 (0-33 mm/h)
      lastValue = Math.max(0, Math.min(33, lastValue + change));
      lastDataTime = currentDate;

      // 计算雨量值，保留一位小数
      const rainfallValue = Math.round(lastValue * 10) / 10;

      // 计算雨量级别
      let rainfallLevel = { level: 'none', text: '无降雨' };
      let rainfallPercentage = 0;

      if (rainfallValue < 0.3) {
        // 无降雨 (<0.3mm/h)
        rainfallLevel = { level: 'none', text: '无降雨' };
        rainfallPercentage = 0;
      } else if (rainfallValue >= 0.3 && rainfallValue <= 2.2) {
        // 小雨 (0.3-2.2mm/h)
        rainfallLevel = { level: 'light', text: '小雨' };
        // 将范围 0.3-2.2 映射到 1-25
        rainfallPercentage = Math.round(1 + (rainfallValue - 0.3) * (25 - 1) / (2.2 - 0.3));
      } else if (rainfallValue > 2.2 && rainfallValue <= 4.0) {
        // 中雨 (2.2-4.0mm/h)
        rainfallLevel = { level: 'medium', text: '中雨' };
        // 将范围 2.2-4.0 映射到 26-50
        rainfallPercentage = Math.round(26 + (rainfallValue - 2.2) * (50 - 26) / (4.0 - 2.2));
      } else {
        // 大雨 (4.0-33mm/h)
        rainfallLevel = { level: 'heavy', text: '大雨' };
        // 将范围 4.0-33 映射到 51-100
        rainfallPercentage = Math.round(51 + (rainfallValue - 4.0) * (100 - 51) / (33 - 4.0));
      }

      // 更新共享服务中的雨量数据
      rainfallService.updateRainfallData(rainfallValue, rainfallLevel, rainfallPercentage);

      // 格式化时间为小时:分钟:秒格式
      const hours = currentDate.getHours();
      const minutes = currentDate.getMinutes();
      const seconds = currentDate.getSeconds();
      const formattedTime = `${hours}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;

      // 创建不同时间粒度的标识
      const timeKey = {
        second: formattedTime, // 秒级别，如 "10:05:30"
        minute: `${hours}:${minutes < 10 ? '0' + minutes : minutes}`, // 分钟级别，如 "10:05"
        tenMinute: `${hours}:${Math.floor(minutes / 10) * 10 < 10 ? '0' + Math.floor(minutes / 10) * 10 : Math.floor(minutes / 10) * 10}`, // 10分钟级别，如 "10:00"
        hour: `${hours}:00`, // 小时级别，如 "10:00"
        day: `${currentDate.getMonth() + 1}/${currentDate.getDate()}` // 天级别，如 "6/15"
      };

      return {
        value: [
          formattedTime,
          rainfallValue // 保留一位小数
        ],
        originalDate: currentDate,
        timeKey: timeKey,
        rainfallValue: rainfallValue // 单独存储雨量值便于计算平均值
      };
    };

    // 初始化模拟数据
    const initMockData = (period) => {
      // 清空当前图表数据
      chartData.value = [];

      // 如果全局数据为空，则初始化全局数据
      if (globalMockData.value.length === 0) {
        // 重置随机数据生成器的状态
        lastDataTime = new Date();
        lastDataTime.setDate(lastDataTime.getDate() - 30); // 从30天前开始
        lastValue = Math.random() * 20;

        // 生成历史数据，控制数据量
        const maxDays = 30; // 最多30天的数据
        const now = new Date();

        // 生成天级别的数据（每小时一个数据点）
        for (let d = maxDays; d >= 0; d--) {
          for (let h = 0; h < 24; h++) {
            // 创建日期对象
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - d);
            pastDate.setHours(h, 0, 0, 0);

            // 确保时间是递增的
            if (pastDate > lastDataTime) {
              lastDataTime = pastDate;

              // 生成合理的随机变化
              const change = Math.random() * 4 - 2;
              lastValue = Math.max(0, Math.min(50, lastValue + change));

              // 格式化时间
              const hours = pastDate.getHours();
              const minutes = pastDate.getMinutes();
              const formattedTime = `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;

              // 创建不同时间粒度的标识
              const timeKey = {
                minute: formattedTime, // 分钟级别，如 "10:05"
                tenMinute: `${hours}:${Math.floor(minutes / 10) * 10 < 10 ? '0' + Math.floor(minutes / 10) * 10 : Math.floor(minutes / 10) * 10}`, // 10分钟级别，如 "10:00"
                hour: `${hours}:00`, // 小时级别，如 "10:00"
                day: `${pastDate.getMonth() + 1}/${pastDate.getDate()}` // 天级别，如 "6/15"
              };

              globalMockData.value.push({
                value: [
                  formattedTime,
                  Math.round(lastValue * 10) / 10 // 保留一位小数
                ],
                originalDate: pastDate, // 保存原始日期以便于筛选
                timeKey: timeKey,
                rainfallValue: Math.round(lastValue * 10) / 10 // 单独存储雨量值便于计算平均值
              });
            }
          }
        }

        // 生成当前小时的数据（每5秒一个数据点）
        const currentHour = new Date();
        currentHour.setMinutes(0, 0, 0);

        const currentMinutes = now.getMinutes();
        const currentSeconds = now.getSeconds();

        // 生成当前小时内每5秒的数据点
        for (let m = 0; m <= currentMinutes; m++) {
          for (let s = 0; s < 60; s += 5) { // 每5秒一个数据点
            // 如果是当前分钟，只生成到当前秒数
            if (m === currentMinutes && s > currentSeconds) {
              break;
            }

            const secondDate = new Date(currentHour);
            secondDate.setMinutes(m, s, 0);

            // 生成合理的随机变化
            const change = Math.random() * 2 - 1; // 小时内变化更小
            lastValue = Math.max(0, Math.min(50, lastValue + change));

            // 格式化时间
            const hours = secondDate.getHours();
            const minutes = secondDate.getMinutes();
            const seconds = secondDate.getSeconds();
            const formattedTime = `${hours}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;

            // 创建不同时间粒度的标识
            const timeKey = {
              second: formattedTime, // 秒级别，如 "10:05:30"
              minute: `${hours}:${minutes < 10 ? '0' + minutes : minutes}`, // 分钟级别，如 "10:05"
              tenMinute: `${hours}:${Math.floor(minutes / 10) * 10 < 10 ? '0' + Math.floor(minutes / 10) * 10 : Math.floor(minutes / 10) * 10}`, // 10分钟级别，如 "10:00"
              hour: `${hours}:00`, // 小时级别，如 "10:00"
              day: `${secondDate.getMonth() + 1}/${secondDate.getDate()}` // 天级别，如 "6/15"
            };

            globalMockData.value.push({
              value: [
                formattedTime,
                Math.round(lastValue * 10) / 10
              ],
              originalDate: secondDate,
              timeKey: timeKey,
              rainfallValue: Math.round(lastValue * 10) / 10
            });
          }
        }

        console.log(`初始化全局模拟数据: ${globalMockData.value.length}个数据点`);
      }

      // 根据选择的时间段筛选和聚合数据
      const filterDate = new Date();

      if (period.all) {
        // 总数据（一个月），按天聚合，单位为 mm/天
        filterDate.setDate(filterDate.getDate() - 30);
        filterDate.setHours(0, 0, 0, 0);

        // 首先按小时聚合数据
        const hourlyData = new Map();

        // 筛选过去30天的数据
        const filteredData = globalMockData.value.filter(item => {
          return item.originalDate >= filterDate;
        });

        // 按小时聚合数据
        filteredData.forEach(item => {
          const hourKey = item.timeKey.hour;
          const dayKey = item.timeKey.day;
          const hourDayKey = `${dayKey}-${hourKey}`; // 创建包含天和小时的唯一键

          if (!hourlyData.has(hourDayKey)) {
            hourlyData.set(hourDayKey, {
              values: [],
              dayKey: dayKey,
              hourKey: hourKey,
              originalDate: new Date(item.originalDate)
            });
          }
          hourlyData.get(hourDayKey).values.push(item.rainfallValue);
        });

        // 计算每小时的平均值
        const hourlyAverages = new Map();
        hourlyData.forEach((data) => {
          const avgValue = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;

          if (!hourlyAverages.has(data.dayKey)) {
            hourlyAverages.set(data.dayKey, {
              values: [],
              dayKey: data.dayKey,
              originalDate: new Date(data.originalDate)
            });
          }
          hourlyAverages.get(data.dayKey).values.push(avgValue);
        });

        // 计算每天的总和（小时平均值的相加），单位为 mm/天
        hourlyAverages.forEach((data, key) => {
          // 将每天的所有小时平均值相加
          const totalValue = data.values.reduce((sum, val) => sum + val, 0);
          chartData.value.push({
            value: [key, Math.round(totalValue * 10) / 10],
            originalDate: data.originalDate,
            unit: 'mm/天' // 添加单位信息
          });
        });
      } else if (period.days > 0) {
        // 一天内的数据，按小时聚合，单位为 mm/h
        filterDate.setDate(filterDate.getDate() - period.days);
        filterDate.setHours(0, 0, 0, 0);

        // 首先按分钟聚合数据
        const minuteData = new Map();

        // 筛选过去一天的数据
        const filteredData = globalMockData.value.filter(item => {
          return item.originalDate >= filterDate;
        });

        // 按分钟聚合数据
        filteredData.forEach(item => {
          const hourKey = item.timeKey.hour;
          const minuteKey = item.timeKey.minute || (item.timeKey.second ? item.timeKey.second.split(':').slice(0, 2).join(':') : hourKey);

          if (!minuteData.has(minuteKey)) {
            minuteData.set(minuteKey, {
              values: [],
              hourKey: hourKey,
              originalDate: new Date(item.originalDate)
            });
          }
          minuteData.get(minuteKey).values.push(item.rainfallValue);
        });

        // 计算每分钟的平均值，然后按小时聚合
        const hourlyAverages = new Map();
        minuteData.forEach((data) => {
          const avgValue = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;

          if (!hourlyAverages.has(data.hourKey)) {
            hourlyAverages.set(data.hourKey, {
              values: [],
              hourKey: data.hourKey,
              originalDate: new Date(data.originalDate)
            });
          }
          hourlyAverages.get(data.hourKey).values.push(avgValue);
        });

        // 计算每小时的平均值，单位为 mm/h
        hourlyAverages.forEach((data, key) => {
          const avgValue = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;
          chartData.value.push({
            value: [key, Math.round(avgValue * 10) / 10],
            originalDate: data.originalDate,
            unit: 'mm/h' // 添加单位信息
          });
        });
      } else if (period.hours > 0) {
        // 一小时内的数据，按分钟聚合，然后每10分钟取平均，单位为 mm/h
        filterDate.setHours(filterDate.getHours() - period.hours);
        filterDate.setMinutes(0, 0, 0);

        // 首先按分钟聚合数据
        const minuteData = new Map();

        // 筛选过去一小时的数据
        const filteredData = globalMockData.value.filter(item => {
          return item.originalDate >= filterDate;
        });

        // 按分钟聚合数据
        filteredData.forEach(item => {
          // 如果有秒级别的数据，提取分钟部分
          const minuteKey = item.timeKey.minute || (item.timeKey.second ? item.timeKey.second.split(':').slice(0, 2).join(':') : item.timeKey.tenMinute);
          const tenMinKey = item.timeKey.tenMinute;

          if (!minuteData.has(minuteKey)) {
            minuteData.set(minuteKey, {
              values: [],
              tenMinKey: tenMinKey,
              originalDate: new Date(item.originalDate)
            });
          }
          minuteData.get(minuteKey).values.push(item.rainfallValue);
        });

        // 计算每分钟的平均值，然后意10分钟聚合
        const tenMinAverages = new Map();
        minuteData.forEach((data) => {
          const avgValue = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;

          if (!tenMinAverages.has(data.tenMinKey)) {
            tenMinAverages.set(data.tenMinKey, {
              values: [],
              tenMinKey: data.tenMinKey,
              originalDate: new Date(data.originalDate)
            });
          }
          tenMinAverages.get(data.tenMinKey).values.push(avgValue);
        });

        // 计算每10分钟的平均值，单位为 mm/h
        tenMinAverages.forEach((data, key) => {
          const avgValue = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;
          chartData.value.push({
            value: [key, Math.round(avgValue * 10) / 10],
            originalDate: data.originalDate,
            unit: 'mm/h' // 添加单位信息
          });
        });
      } else if (period.minutes > 0) {
        // 10分钟内的数据，直接显示每5秒的原始数据
        filterDate.setMinutes(filterDate.getMinutes() - period.minutes);
        filterDate.setSeconds(0, 0);

        // 清空当前图表数据
        chartData.value = [];

        // 生成过去10分钟内每5秒的模拟数据
        const now = new Date();
        const startTime = new Date(now);
        startTime.setMinutes(now.getMinutes() - period.minutes, 0, 0);

        // 重置随机数据生成器的状态
        let tempLastDataTime = new Date(startTime);
        let tempLastValue = Math.random() * 20; // 初始值

        // 生成从过去10分钟到现在的每5秒的数据点
        for (let t = startTime.getTime(); t <= now.getTime(); t += 5000) { // 每5秒一个数据点
          const currentDate = new Date(t);

          // 计算与上次数据的时间差（秒）
          const timeDiff = (currentDate - tempLastDataTime) / 1000;

          // 根据时间差生成合理的变化量
          const change = (Math.random() * 4 - 2) * Math.min(timeDiff / 60, 1);

          // 确保值在合理范围内 (0-50)
          tempLastValue = Math.max(0, Math.min(50, tempLastValue + change));
          tempLastDataTime = currentDate;

          // 格式化时间
          const hours = currentDate.getHours();
          const minutes = currentDate.getMinutes();
          const seconds = currentDate.getSeconds();
          const formattedTime = `${hours}:${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;

          chartData.value.push({
            value: [
              formattedTime,
              Math.round(tempLastValue * 10) / 10 // 保留一位小数
            ],
            originalDate: currentDate,
            unit: 'mm/h' // 保持单位一致性
          });
        }
      }

      // 对数据进行排序，确保时间顺序正确
      chartData.value.sort((a, b) => {
        return a.originalDate - b.originalDate;
      });

      console.log(`筛选和聚合模拟数据: ${chartData.value.length}个数据点`);
      updateChartData();

      // 更新x轴配置，根据时间段调整
      updateXAxisConfig(period);
    };

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

        // 生成每10分钟的标签
        const labels = [];
        for (let i = 0; i < 60; i += 10) {
          labels.push(`${currentHour}:${i < 10 ? '0' + i : i}`);
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
                xAxis: `${currentHour}:${Math.floor(now.getMinutes() / 10) * 10 < 10 ? '0' + Math.floor(now.getMinutes() / 10) * 10 : Math.floor(now.getMinutes() / 10) * 10}`,
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
        chartOption.value.xAxis = {
          type: 'category',
          data: Array.from({length: 24}, (_, i) => `${i}:00`),
          boundaryGap: false,
          splitLine: {
            show: true,
            lineStyle: {
              color: '#ddd',
              type: 'dashed'
            }
          },
          axisLabel: {
            interval: 1, // 每小时显示一个标签
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
                xAxis: `${now.getHours()}:00`,
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
        const labels = [];

        // 生成过去30天的日期标签
        for (let i = 30; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
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
            markLineData = [{
              xAxis: `${currentHour}:${currentMinute < 10 ? '0' + currentMinute : currentMinute}`,
              label: {
                formatter: '当前时间',
                position: 'start'
              }
            }];

            // 每分钟更新一次标签，确保始终显示最新的10分钟
            if (now.getSeconds() === 0) {
              // 重新生成过去10分钟的标签
              const labels = [];
              for (let i = 0; i <= period.minutes; i++) {
                const m = currentMinute - period.minutes + i;
                if (m >= 0) {
                  labels.push(`${currentHour}:${m < 10 ? '0' + m : m}`);
                } else {
                  // 处理跨小时的情况
                  const prevHour = currentHour === 0 ? 23 : currentHour - 1;
                  labels.push(`${prevHour}:${60 + m < 10 ? '0' + (60 + m) : (60 + m)}`);
                }
              }

              echartsInstance.setOption({
                xAxis: {
                  data: labels
                }
              });
            }
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

      const period = timePeriods[index];
      initMockData(period);

      // 更新图表标题和单位
      const unit = index === 3 ? 'mm/天' : 'mm/h';
      chartOption.value.title.text = `雨量显示 (${unit}) - ${timePeriods[index].label}`;

      // 更新Y轴名称
      chartOption.value.yAxis.name = index === 3 ? '雨量 (mm/天)' : '雨量 (mm/h)';
    };

    // 启动定时数据更新
    const startDataPolling = () => {
      console.log('启动定时数据更新，每5秒一次');

      // 清除可能存在的旧计时器
      if (intervalId.value) {
        clearInterval(intervalId.value);
        console.log('清除旧的定时器');
      }

      // 立即生成一次数据，确保初始显示
      const initialData = randomData();
      console.log('初始化数据:', initialData.value[1] + 'mm');
      globalMockData.value.push(initialData);

      // 重新初始化当前时间段的数据
      const initialPeriod = timePeriods[activePeriod.value];
      initMockData(initialPeriod);

      // 设置定时器，每5秒更新一次
      intervalId.value = setInterval(() => {
        const now = new Date();
        console.log(`定时器触发，当前时间: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`);

        // 添加新的模拟数据
        const newData = randomData(); // 已经包含了timeKey和rainfallValue
        console.log('添加新的模拟数据:', newData.value[1] + 'mm');

        // 同时更新全局数据
        globalMockData.value.push(newData);

        // 限制全局数据量，防止内存占用过大
        if (globalMockData.value.length > 10000) { // 限制数据点数量
          globalMockData.value.shift();
        }

        // 重新初始化当前时间段的数据
        const period = timePeriods[activePeriod.value];
        initMockData(period);

      }, 5000); // 5秒更新一次

      console.log('定时器已启动，ID:', intervalId.value);
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
      // 初始化模拟数据
      const period = timePeriods[activePeriod.value];
      initMockData(period);

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

  /* 本小时雨量卡片样式 */
  .hour-rainfall {
    display: flex;
    justify-content: center;
    margin-bottom: var(--spacing-md);

    .rainfall-card {
      background-color: var(--primary-color);
      color: white;
      border-radius: var(--border-radius-md);
      padding: var(--spacing-md);
      text-align: center;
      min-width: 200px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);

      h3 {
        margin: 0 0 var(--spacing-sm) 0;
        font-size: var(--font-size-md);
      }

      .rainfall-value {
        font-size: 2rem;
        font-weight: bold;

        span {
          font-size: 1rem;
          opacity: 0.8;
        }
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

    .hour-rainfall .rainfall-card {
      min-width: 150px;
      padding: var(--spacing-sm);

      .rainfall-value {
        font-size: 1.5rem;
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
