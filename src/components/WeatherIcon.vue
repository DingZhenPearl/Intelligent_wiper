<template>
  <div class="weather-icon-wrapper" :class="size" :style="{ background: getBackgroundColor }">
    <svg class="weather-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <!-- 晴天 -->
      <g v-if="isSunny" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5" fill="#FFD700" stroke="#FF8C00" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </g>

      <!-- 多云 -->
      <g v-else-if="isCloudy" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#f5f5f5" stroke="#90A4AE" />
        <circle v-if="isPartlyCloudy" cx="8" cy="9" r="3" fill="#FFD700" stroke="#FF8C00" />
      </g>

      <!-- 雨天 -->
      <g v-else-if="isRainy" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#ECEFF1" stroke="#90A4AE" />
        <line x1="8" y1="19" x2="8.01" y2="19" stroke="#2196F3" stroke-width="3" stroke-linecap="round" />
        <line x1="12" y1="19" x2="12.01" y2="19" stroke="#2196F3" stroke-width="3" stroke-linecap="round" />
        <line x1="16" y1="19" x2="16.01" y2="19" stroke="#2196F3" stroke-width="3" stroke-linecap="round" />
        <line v-if="isHeavyRain" x1="8" y1="16" x2="8.01" y2="16" stroke="#2196F3" stroke-width="3" stroke-linecap="round" />
        <line v-if="isHeavyRain" x1="12" y1="16" x2="12.01" y2="16" stroke="#2196F3" stroke-width="3" stroke-linecap="round" />
        <line v-if="isHeavyRain" x1="16" y1="16" x2="16.01" y2="16" stroke="#2196F3" stroke-width="3" stroke-linecap="round" />
      </g>

      <!-- 雪天 -->
      <g v-else-if="isSnowy" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#ECEFF1" stroke="#90A4AE" />
        <path d="M8 18.5l.5.5-.5.5-.5-.5.5-.5z" fill="#E1F5FE" stroke="#81D4FA" />
        <path d="M12 18.5l.5.5-.5.5-.5-.5.5-.5z" fill="#E1F5FE" stroke="#81D4FA" />
        <path d="M16 18.5l.5.5-.5.5-.5-.5.5-.5z" fill="#E1F5FE" stroke="#81D4FA" />
        <path v-if="isHeavySnow" d="M8 15.5l.5.5-.5.5-.5-.5.5-.5z" fill="#E1F5FE" stroke="#81D4FA" />
        <path v-if="isHeavySnow" d="M12 15.5l.5.5-.5.5-.5-.5.5-.5z" fill="#E1F5FE" stroke="#81D4FA" />
        <path v-if="isHeavySnow" d="M16 15.5l.5.5-.5.5-.5-.5.5-.5z" fill="#E1F5FE" stroke="#81D4FA" />
      </g>

      <!-- 雾霾 -->
      <g v-else-if="isFoggy" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 5h14" stroke="#B0BEC5" />
        <path d="M5 9h14" stroke="#B0BEC5" />
        <path d="M5 13h14" stroke="#B0BEC5" />
        <path d="M5 17h14" stroke="#B0BEC5" />
      </g>

      <!-- 默认/未知天气 -->
      <g v-else fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" fill="#ECEFF1" stroke="#90A4AE" />
        <path d="M12 8v4" stroke="#90A4AE" />
        <path d="M12 16h.01" stroke="#90A4AE" />
      </g>
    </svg>
  </div>
</template>

<script>
export default {
  name: 'WeatherIcon',
  props: {
    // 和风天气图标代码
    iconCode: {
      type: [String, Number],
      required: true
    },
    // 图标大小
    size: {
      type: String,
      default: 'medium' // small, medium, large
    }
  },
  computed: {
    // 解析图标代码
    parsedCode() {
      return parseInt(this.iconCode, 10);
    },

    // 判断天气类型
    isSunny() {
      return this.parsedCode === 100 || this.parsedCode === 150;
    },

    isPartlyCloudy() {
      return [101, 102, 103, 151, 152, 153].includes(this.parsedCode);
    },

    isCloudy() {
      return this.isPartlyCloudy || this.parsedCode === 104 || this.parsedCode === 154;
    },

    isRainy() {
      return [300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 350, 351, 352, 353].includes(this.parsedCode);
    },

    isHeavyRain() {
      return [304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318].includes(this.parsedCode);
    },

    isSnowy() {
      return [400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 456, 457, 499].includes(this.parsedCode);
    },

    isHeavySnow() {
      return [404, 405, 406, 407, 408, 409, 410].includes(this.parsedCode);
    },

    isFoggy() {
      return [500, 501, 502, 503, 504, 507, 508, 509, 510, 511, 512, 513, 514, 515].includes(this.parsedCode);
    },

    // 获取背景颜色
    getBackgroundColor() {
      // 晴天
      if (this.isSunny) {
        return 'linear-gradient(to bottom right, #4fc3f7, #1976d2)';
      }
      // 多云
      else if (this.isPartlyCloudy) {
        return 'linear-gradient(to bottom right, #90caf9, #5c6bc0)';
      }
      // 阴天
      else if (this.isCloudy) {
        return 'linear-gradient(to bottom right, #b0bec5, #78909c)';
      }
      // 雨天
      else if (this.isRainy) {
        return 'linear-gradient(to bottom right, #4fc3f7, #0277bd)';
      }
      // 雪天
      else if (this.isSnowy) {
        return 'linear-gradient(to bottom right, #e1f5fe, #81d4fa)';
      }
      // 雾霾
      else if (this.isFoggy) {
        return 'linear-gradient(to bottom right, #cfd8dc, #90a4ae)';
      }
      // 默认
      else {
        return 'linear-gradient(to bottom right, #bbdefb, #64b5f6)';
      }
    }
  }
};
</script>

<style scoped>
.weather-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  width: 80px;
  height: 80px;
}

.weather-icon-wrapper::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
}

.weather-icon-wrapper:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.25);
}

.weather-icon {
  width: 70%;
  height: 70%;
  z-index: 1;
  color: white;
}

/* 尺寸变体 */
.weather-icon-wrapper[class*="small"] {
  width: 60px;
  height: 60px;
}

.weather-icon-wrapper[class*="medium"] {
  width: 80px;
  height: 80px;
}

.weather-icon-wrapper[class*="large"] {
  width: 120px;
  height: 120px;
}
</style>
