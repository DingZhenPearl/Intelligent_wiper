<template>
  <div class="weather-popup" v-if="visible">
    <div class="weather-popup-header">
      <h3>{{ weatherData.city }} 天气</h3>
      <button class="close-button" @click="close">×</button>
    </div>
    
    <div class="weather-popup-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <p>加载天气信息中...</p>
      </div>
      
      <!-- 错误提示 -->
      <div v-else-if="error" class="error-message">
        <p>{{ error }}</p>
        <button @click="retry" class="retry-button">重试</button>
      </div>
      
      <!-- 天气信息 -->
      <div v-else-if="weatherData" class="weather-info">
        <!-- 当前天气 -->
        <div v-if="weatherData.live" class="current-weather">
          <div class="weather-icon">{{ weatherData.live.icon }}</div>
          <div class="weather-details">
            <div class="temperature">{{ weatherData.live.temperature }}°C</div>
            <div class="weather-desc">{{ weatherData.live.weather }}</div>
            <div class="weather-extra">
              <span>湿度: {{ weatherData.live.humidity }}%</span>
              <span>{{ weatherData.live.winddirection }}风 {{ weatherData.live.windpower }}级</span>
            </div>
            <div class="report-time">更新时间: {{ formatTime(weatherData.live.reporttime) }}</div>
          </div>
        </div>
        
        <!-- 天气预报 -->
        <div v-if="weatherData.forecast && weatherData.forecast.length > 0" class="weather-forecast">
          <h4>未来天气预报</h4>
          <div class="forecast-list">
            <div v-for="(item, index) in weatherData.forecast" :key="index" class="forecast-item">
              <div class="forecast-date">{{ formatDate(item.date) }} {{ getWeekday(item.week) }}</div>
              <div class="forecast-weather">
                <div class="day-weather">
                  <span class="weather-icon">{{ item.dayicon }}</span>
                  <span>{{ item.dayweather }}</span>
                </div>
                <div class="night-weather">
                  <span class="weather-icon">{{ item.nighticon }}</span>
                  <span>{{ item.nightweather }}</span>
                </div>
              </div>
              <div class="forecast-temp">{{ item.daytemp }}°C / {{ item.nighttemp }}°C</div>
              <div class="forecast-wind">{{ item.daywind }}风 {{ item.daypower }}级</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'WeatherPopup',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    weatherData: {
      type: Object,
      default: () => ({})
    },
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: ''
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    retry() {
      this.$emit('retry');
    },
    formatTime(timeString) {
      if (!timeString) return '';
      
      try {
        const date = new Date(timeString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      } catch (e) {
        return timeString;
      }
    },
    formatDate(dateString) {
      if (!dateString) return '';
      
      try {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          return `${parts[1]}月${parts[2]}日`;
        }
        return dateString;
      } catch (e) {
        return dateString;
      }
    },
    getWeekday(week) {
      const weekMap = {
        '1': '周一',
        '2': '周二',
        '3': '周三',
        '4': '周四',
        '5': '周五',
        '6': '周六',
        '7': '周日'
      };
      
      return weekMap[week] || `周${week}`;
    }
  }
};
</script>

<style lang="scss" scoped>
.weather-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 320px;
  max-width: 90%;
  background-color: white;
  border-radius: var(--border-radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  
  .weather-popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-md);
    background-color: var(--primary-color);
    color: white;
    
    h3 {
      margin: 0;
      font-size: var(--font-size-lg);
    }
    
    .close-button {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      
      &:hover {
        opacity: 0.8;
      }
    }
  }
  
  .weather-popup-content {
    padding: var(--spacing-md);
    max-height: 60vh;
    overflow-y: auto;
    
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--spacing-lg) 0;
      
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        border-top-color: var(--primary-color);
        animation: spin 1s ease-in-out infinite;
        margin-bottom: var(--spacing-md);
      }
    }
    
    .error-message {
      text-align: center;
      color: #d32f2f;
      padding: var(--spacing-md) 0;
      
      .retry-button {
        background-color: var(--primary-color);
        color: white;
        border: none;
        padding: var(--spacing-xs) var(--spacing-md);
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        margin-top: var(--spacing-sm);
        
        &:hover {
          background-color: var(--primary-color-dark);
        }
      }
    }
    
    .weather-info {
      .current-weather {
        display: flex;
        align-items: center;
        padding: var(--spacing-md) 0;
        border-bottom: 1px solid #eee;
        
        .weather-icon {
          font-size: 48px;
          margin-right: var(--spacing-md);
        }
        
        .weather-details {
          flex: 1;
          
          .temperature {
            font-size: 32px;
            font-weight: bold;
          }
          
          .weather-desc {
            font-size: var(--font-size-md);
            margin: var(--spacing-xs) 0;
          }
          
          .weather-extra {
            display: flex;
            justify-content: space-between;
            font-size: var(--font-size-sm);
            color: #666;
          }
          
          .report-time {
            font-size: var(--font-size-xs);
            color: #999;
            margin-top: var(--spacing-xs);
          }
        }
      }
      
      .weather-forecast {
        padding-top: var(--spacing-md);
        
        h4 {
          margin: 0 0 var(--spacing-md);
          font-size: var(--font-size-md);
        }
        
        .forecast-list {
          .forecast-item {
            padding: var(--spacing-sm) 0;
            border-bottom: 1px solid #eee;
            
            &:last-child {
              border-bottom: none;
            }
            
            .forecast-date {
              font-weight: bold;
              margin-bottom: var(--spacing-xs);
            }
            
            .forecast-weather {
              display: flex;
              justify-content: space-between;
              margin-bottom: var(--spacing-xs);
              
              .day-weather, .night-weather {
                display: flex;
                align-items: center;
                
                .weather-icon {
                  font-size: var(--font-size-lg);
                  margin-right: var(--spacing-xs);
                }
              }
              
              .night-weather {
                color: #666;
              }
            }
            
            .forecast-temp {
              margin-bottom: var(--spacing-xs);
            }
            
            .forecast-wind {
              font-size: var(--font-size-sm);
              color: #666;
            }
          }
        }
      }
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 移动设备适配 */
@media screen and (max-width: 480px) {
  .weather-popup {
    width: 90%;
    max-height: 80vh;
    
    .weather-popup-content {
      max-height: 60vh;
    }
  }
}
</style>
