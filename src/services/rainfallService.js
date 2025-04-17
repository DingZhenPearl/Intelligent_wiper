// src/services/rainfallService.js
import { ref } from 'vue';

// 创建一个单例服务，用于在不同组件之间共享雨量数据
const rainfallService = {
  // 当前雨量值 (mm/h)
  currentRainfall: ref(0),

  // 雨量级别信息
  rainfallLevel: ref({ level: 'none', text: '无降雨' }),

  // 雨量百分比
  rainfallPercentage: ref(0),

  // 最后更新时间
  lastUpdateTime: ref(new Date()),

  // 更新次数
  updateCount: ref(0),

  // 全局定时器状态
  pollingActive: ref(false),

  // 上次更新时间戳，用于检测数据是否在更新
  lastUpdateTimestamp: ref(0),

  // 更新雨量数据的方法
  updateRainfallData(rainfallValue, level, percentage) {
    this.currentRainfall.value = rainfallValue;
    this.rainfallLevel.value = level;
    this.rainfallPercentage.value = percentage;

    const now = new Date();
    this.lastUpdateTime.value = now;
    this.lastUpdateTimestamp.value = now.getTime();
    this.updateCount.value++;

    console.log(`[雨量服务] 更新雨量数据 #${this.updateCount.value}: ${rainfallValue} mm/h (${level.text}, ${percentage}%) (时间: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()})`);
  },

  // 获取雨量数据的方法
  getRainfallData() {
    return {
      value: this.currentRainfall.value,
      level: this.rainfallLevel.value,
      percentage: this.rainfallPercentage.value,
      lastUpdateTime: this.lastUpdateTime.value,
      updateCount: this.updateCount.value
    };
  }
};

export default rainfallService;
