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
          <h4>路线天气详情</h4>
          <div class="points-list">
            <div v-for="(point, index) in routePoints" :key="index" class="point-item">
              <div class="point-header">
                <span class="point-index">{{ index + 1 }}</span>
                <span class="point-name">{{ point.name || `途经点 ${index + 1}` }}</span>
              </div>
              <div class="point-weather">
                <span class="weather-icon">{{ point.weather?.icon || '🌈' }}</span>
                <div class="weather-details">
                  <div class="weather-main">{{ point.weather?.weather || '未知天气' }} {{ point.weather?.temperature || '--' }}°C</div>
                  <div class="weather-extra">
                    <span v-if="point.weather?.winddirection">{{ point.weather.winddirection }}风 {{ point.weather.windpower }}级</span>
                    <span v-if="point.weather?.humidity">湿度: {{ point.weather.humidity }}%</span>
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
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    retry() {
      this.$emit('retry');
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
        h4 {
          margin: 0 0 var(--spacing-md);
          font-size: var(--font-size-md);
          border-bottom: 1px solid #eee;
          padding-bottom: var(--spacing-xs);
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
