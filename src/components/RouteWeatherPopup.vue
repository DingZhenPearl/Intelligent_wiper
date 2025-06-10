<template>
  <div class="route-weather-popup" v-if="visible">
    <div class="popup-header">
      <h3>路线天气预警</h3>
      <button class="close-button" @click="close">×</button>
    </div>
    
    <div class="popup-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
        <p>正在检查路线天气...</p>
      </div>
      
      <!-- 错误提示 -->
      <div v-else-if="error" class="error-message">
        <p>{{ error }}</p>
        <button @click="retry" class="retry-button">重试</button>
      </div>
      
      <!-- 天气信息 -->
      <div v-else class="route-weather-info">
        <div v-if="hasRainWarning" class="warning-message">
          <div class="warning-icon">⚠️</div>
          <div class="warning-text">
            <p><strong>注意：</strong>您的行程路线上有降雨可能！</p>
            <p>请做好防雨准备，注意行车安全。</p>
          </div>
        </div>
        
        <div v-else class="safe-message">
          <div class="safe-icon">✓</div>
          <div class="safe-text">
            <p>您的行程路线上暂无降雨预报。</p>
            <p>祝您一路顺风！</p>
          </div>
        </div>
        
        <div class="route-points">
          <div class="points-header">
            <h4>路线天气详情</h4>
            <div class="weather-stats" v-if="weatherStats.failed > 0">
              <span class="stats-text">
                成功获取 {{ weatherStats.success }}/{{ weatherStats.total }} 个采样点天气
              </span>
              <span class="failed-count">{{ weatherStats.failed }} 个失败</span>
            </div>
          </div>
          <div class="points-list">
            <div v-for="(point, index) in routePoints" :key="index" class="point-item">
              <div class="point-header">
                <span class="point-index">{{ index + 1 }}</span>
                <span class="point-name">{{ point.name || `途经点 ${index + 1}` }}</span>
              </div>
              <div class="point-weather" :class="{ 'weather-failed': point.status === 'failed' }">
                <span class="weather-icon">{{ getWeatherIcon(point) }}</span>
                <div class="weather-details">
                  <div class="weather-main">
                    {{ getWeatherText(point) }}
                    <span v-if="point.weather?.temperature && point.weather.temperature !== '--'">{{ point.weather.temperature }}°C</span>
                    <span v-else-if="point.status !== 'failed'">--°C</span>
                  </div>
                  <div class="weather-extra" v-if="point.status !== 'failed'">
                    <span v-if="point.weather?.winddirection">{{ point.weather.winddirection }}风 {{ point.weather.windpower }}级</span>
                    <span v-if="point.weather?.humidity">湿度: {{ point.weather.humidity }}%</span>
                  </div>
                  <div class="weather-error" v-if="point.status === 'failed' && point.error">
                    <small>{{ point.error }}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RouteWeatherPopup',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    routePoints: {
      type: Array,
      default: () => []
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
  computed: {
    hasRainWarning() {
      // 检查是否有任何点的天气包含雨
      return this.routePoints.some(point => {
        const weather = point.weather?.weather || '';
        return weather.includes('雨') || weather.includes('阵雨') || weather.includes('雷雨');
      });
    },

    // 统计天气获取成功和失败的数量
    weatherStats() {
      const total = this.routePoints.length;
      const failed = this.routePoints.filter(point => point.status === 'failed').length;
      const success = total - failed;
      return { total, success, failed };
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    retry() {
      this.$emit('retry');
    },

    // 获取天气图标
    getWeatherIcon(point) {
      if (point.status === 'failed') {
        return '❌';
      }

      if (point.weather?.icon) {
        return point.weather.icon;
      }

      // 根据天气描述返回默认图标
      const weather = point.weather?.weather || '';
      if (weather.includes('晴')) return '☀️';
      if (weather.includes('云')) return '☁️';
      if (weather.includes('雨')) return '🌧️';
      if (weather.includes('雪')) return '❄️';
      if (weather.includes('雾')) return '🌫️';

      return '🌈'; // 默认图标
    },

    // 获取天气文本
    getWeatherText(point) {
      if (point.status === 'failed') {
        return '数据获取失败';
      }

      return point.weather?.weather || '未知天气';
    }
  }
};
</script>

<style lang="scss" scoped>
.route-weather-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 360px;
  max-width: 90%;
  background-color: white;
  border-radius: var(--border-radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  
  .popup-header {
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
  
  .popup-content {
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
    
    .route-weather-info {
      .warning-message, .safe-message {
        display: flex;
        align-items: flex-start;
        padding: var(--spacing-md);
        border-radius: var(--border-radius-md);
        margin-bottom: var(--spacing-md);
      }
      
      .warning-message {
        background-color: #fff3e0;
        border: 1px solid #ffcc80;
        
        .warning-icon {
          font-size: 24px;
          margin-right: var(--spacing-md);
        }
        
        .warning-text {
          flex: 1;
          
          p {
            margin: 0 0 var(--spacing-xs);
            
            &:last-child {
              margin-bottom: 0;
            }
          }
        }
      }
      
      .safe-message {
        background-color: #e8f5e9;
        border: 1px solid #a5d6a7;
        
        .safe-icon {
          font-size: 24px;
          margin-right: var(--spacing-md);
          color: #4caf50;
        }
        
        .safe-text {
          flex: 1;
          
          p {
            margin: 0 0 var(--spacing-xs);
            
            &:last-child {
              margin-bottom: 0;
            }
          }
        }
      }
      
      .route-points {
        .points-header {
          margin-bottom: var(--spacing-md);

          h4 {
            margin: 0 0 var(--spacing-xs);
            font-size: var(--font-size-md);
            border-bottom: 1px solid #eee;
            padding-bottom: var(--spacing-xs);
          }

          .weather-stats {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: var(--font-size-sm);
            color: #666;

            .stats-text {
              color: #4caf50;
            }

            .failed-count {
              color: #f44336;
              font-weight: bold;
            }
          }
        }
        
        .points-list {
          .point-item {
            padding: var(--spacing-sm);
            border: 1px solid #eee;
            border-radius: var(--border-radius-sm);
            margin-bottom: var(--spacing-sm);
            
            &:last-child {
              margin-bottom: 0;
            }
            
            .point-header {
              display: flex;
              align-items: center;
              margin-bottom: var(--spacing-xs);
              
              .point-index {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                background-color: var(--primary-color);
                color: white;
                border-radius: 50%;
                font-size: var(--font-size-sm);
                margin-right: var(--spacing-sm);
              }
              
              .point-name {
                font-weight: bold;
              }
            }
            
            .point-weather {
              display: flex;
              align-items: center;

              &.weather-failed {
                opacity: 0.7;

                .weather-details .weather-main {
                  color: #f44336;
                }
              }

              .weather-icon {
                font-size: 24px;
                margin-right: var(--spacing-md);
              }

              .weather-details {
                flex: 1;

                .weather-main {
                  font-size: var(--font-size-md);
                }

                .weather-extra {
                  display: flex;
                  justify-content: space-between;
                  font-size: var(--font-size-sm);
                  color: #666;
                  margin-top: var(--spacing-xs);
                }

                .weather-error {
                  margin-top: var(--spacing-xs);

                  small {
                    color: #f44336;
                    font-size: 12px;
                  }
                }
              }
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
  .route-weather-popup {
    width: 90%;
    max-height: 80vh;
    
    .popup-content {
      max-height: 60vh;
    }
  }
}
</style>
