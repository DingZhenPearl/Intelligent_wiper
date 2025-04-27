<template>
  <div class="weather-container">
    <h1>天气预报</h1>

    <!-- 城市选择 -->
    <div class="city-selector">
      <div class="search-container">
        <div class="input-group">
          <span class="location-icon material-icons">location_on</span>
          <input
            type="text"
            id="city"
            v-model="cityName"
            placeholder="输入城市名称或点击定位"
            @keyup.enter="getWeatherData"
          />
          <button
            class="clear-btn"
            @click="cityName = ''"
            v-if="cityName && !isLoading"
          >
            <span class="material-icons">close</span>
          </button>
        </div>
        <button
          class="location-btn"
          @click="getLocationWeather"
          :disabled="isLoading"
          :title="'使用当前位置'"
        >
          <span class="icon material-icons">my_location</span>
        </button>
        <button
          class="search-btn"
          @click="getWeatherData"
          :disabled="isLoading"
        >
          <span class="icon material-icons">{{ isLoading ? 'hourglass_top' : 'search' }}</span>
          <span class="btn-text">{{ isLoading ? '加载中...' : '查询天气' }}</span>
        </button>
      </div>
      <div class="popular-cities" v-if="!isLoading && !hasError">
        <span class="popular-city-label">热门城市:</span>
        <div class="city-tags">
          <span
            v-for="city in popularCities"
            :key="city"
            class="city-tag"
            @click="selectCity(city)"
          >
            {{ city }}
          </span>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在获取天气数据...</p>
    </div>

    <!-- 错误信息 -->
    <div v-if="hasError && !isLoading" class="error-message">
      <p>{{ errorMessage }}</p>

      <!-- 地理位置权限错误的特殊处理 -->
      <div v-if="errorMessage.includes('地理位置') || errorMessage.includes('拒绝')" class="permission-help">
        <p>浏览器没有显示地理位置权限请求或权限被拒绝：</p>

        <div class="permission-steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>尝试点击下面的按钮触发权限请求</h4>
              <button @click="requestLocationPermission" class="permission-btn">
                <span class="icon material-icons">location_searching</span>
                请求地理位置权限
              </button>
            </div>
          </div>

          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>如果没有看到权限请求对话框，请手动检查浏览器设置</h4>
              <ol>
                <li>点击地址栏左侧的锁图标或信息图标</li>
                <li>在弹出的菜单中找到“位置”权限</li>
                <li>将其设置为“允许”</li>
                <li>刷新页面并再次尝试</li>
              </ol>
            </div>
          </div>

          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>如果您使用的是本地开发环境</h4>
              <p>浏览器可能会限制非HTTPS环境下的地理位置功能。请尝试：</p>
              <ul>
                <li>在Chrome中访问 <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code></li>
                <li>添加您的本地开发URL并启用该选项</li>
                <li>重启浏览器后再次尝试</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="buttons-container">
        <button @click="getWeatherData" class="retry-btn">
          <span class="icon material-icons">refresh</span>
          重试
        </button>

        <button @click="cityName = '绵阳'; getWeatherData(false)" class="default-city-btn">
          <span class="icon material-icons">location_city</span>
          使用默认城市
        </button>
      </div>
    </div>

    <!-- 天气数据 -->
    <div v-if="hasWeatherData && !isLoading && !hasError" class="weather-data">
      <!-- 当前天气 -->
      <div class="current-weather">
        <h2>{{ cityInfo.name }} {{ cityInfo.adm2 ? `(${cityInfo.adm2})` : '' }} 当前天气</h2>
        <div class="weather-info">
          <WeatherIcon :iconCode="nowWeather.now.icon" size="large" class="current-weather-icon" />
          <div class="weather-details">
            <p class="temperature">{{ nowWeather.now.temp }}°C</p>
            <p class="weather-desc">{{ nowWeather.now.text }}</p>
            <p class="weather-feel">体感温度: {{ nowWeather.now.feelsLike }}°C</p>
          </div>
        </div>
        <div class="weather-meta">
          <div class="meta-item">
            <span class="label">风向:</span>
            <span class="value">{{ nowWeather.now.windDir }}</span>
          </div>
          <div class="meta-item">
            <span class="label">风力:</span>
            <span class="value">{{ nowWeather.now.windScale }}级</span>
          </div>
          <div class="meta-item">
            <span class="label">风速:</span>
            <span class="value">{{ nowWeather.now.windSpeed }} km/h</span>
          </div>
          <div class="meta-item">
            <span class="label">湿度:</span>
            <span class="value">{{ nowWeather.now.humidity }}%</span>
          </div>
          <div class="meta-item">
            <span class="label">气压:</span>
            <span class="value">{{ nowWeather.now.pressure }} hPa</span>
          </div>
          <div class="meta-item">
            <span class="label">能见度:</span>
            <span class="value">{{ nowWeather.now.vis }} km</span>
          </div>
        </div>
      </div>

      <!-- 分钟级降水预报 -->
      <div class="minutely" v-if="minutelyWeather && minutelyWeather.minutely && minutelyWeather.minutely.length > 0">
        <!-- 如果有降水数据才显示 -->
        <template v-if="hasRainData">
        <h2>未来两小时降水预报</h2>
        <div class="minutely-summary" v-if="minutelyWeather.summary">
          <p>{{ minutelyWeather.summary }}</p>
        </div>
        <div class="minutely-chart">
          <div class="chart-container">
            <svg class="rain-line-chart" viewBox="0 0 100 30" preserveAspectRatio="none">
              <!-- 渐变定义 -->
              <defs>
                <linearGradient id="rain-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#03a9f4" stop-opacity="0.8" />
                  <stop offset="100%" stop-color="#03a9f4" stop-opacity="0.1" />
                </linearGradient>
              </defs>
              <!-- 背景网格线 -->
              <g class="grid-lines">
                <line x1="0" y1="0" x2="100" y2="0" class="grid-line"></line>
                <line x1="0" y1="10" x2="100" y2="10" class="grid-line"></line>
                <line x1="0" y1="20" x2="100" y2="20" class="grid-line"></line>
                <line x1="0" y1="30" x2="100" y2="30" class="grid-line"></line>
              </g>

              <!-- 降水量折线 -->
              <polyline
                :points="getLinePoints()"
                class="rain-line"
                fill="none"
              ></polyline>

              <!-- 降水量填充区域 -->
              <path
                :d="getAreaPath()"
                class="rain-area"
              ></path>

              <!-- 数据点 -->
              <g class="data-points">
                <circle
                  v-for="(point, index) in getDataPoints()"
                  :key="index"
                  :cx="point.x"
                  :cy="point.y"
                  r="0.5"
                  class="data-point"
                  :class="{ 'has-rain': parseFloat(point.precip) > 0 }"
                  :title="`${formatMinuteTime(point.time)}: ${point.precip}mm`"
                ></circle>
              </g>
            </svg>

            <!-- 降水量刻度 -->
            <div class="rain-scale">
              <span>5mm</span>
              <span>2.5mm</span>
              <span>0mm</span>
            </div>
          </div>

          <!-- 时间刻度 -->
          <div class="time-labels">
            <span>{{ formatMinuteTime(minutelyWeather.minutely[0].fxTime) }}</span>
            <span>{{ formatMinuteTime(minutelyWeather.minutely[Math.floor(minutelyWeather.minutely.length / 4)].fxTime) }}</span>
            <span>{{ formatMinuteTime(minutelyWeather.minutely[Math.floor(minutelyWeather.minutely.length / 2)].fxTime) }}</span>
            <span>{{ formatMinuteTime(minutelyWeather.minutely[Math.floor(minutelyWeather.minutely.length * 3 / 4)].fxTime) }}</span>
            <span>{{ formatMinuteTime(minutelyWeather.minutely[minutelyWeather.minutely.length - 1].fxTime) }}</span>
          </div>
        </div>
        </template>
        <template v-else>
          <div class="no-rain-message">
            <p>未来两小时内无降水预报</p>
          </div>
        </template>
      </div>

      <!-- 天气预报信息 -->
      <div class="forecast" v-if="forecastWeather && forecastWeather.daily">
        <h2>未来三天天气预报</h2>
        <div class="forecast-list">
          <div
            v-for="(day, index) in forecastWeather.daily"
            :key="index"
            class="forecast-item"
          >
            <div class="forecast-date">{{ formatDate(day.fxDate) }}</div>
            <WeatherIcon :iconCode="day.iconDay" size="small" class="forecast-weather-icon" />
            <div class="forecast-temp">{{ day.tempMin }}°C ~ {{ day.tempMax }}°C</div>
            <div class="forecast-desc">{{ day.textDay }}</div>
            <div class="forecast-wind">{{ day.windDirDay }} {{ day.windScaleDay }}级</div>
          </div>
        </div>
      </div>

      <!-- 更新时间 -->
      <div class="update-time" v-if="lastUpdateTime">
        最后更新: {{ formatUpdateTime(lastUpdateTime) }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import weatherService from '@/services/weatherService';
import WeatherIcon from '@/components/WeatherIcon.vue';
import { isNative } from '@/utils/platform';
import * as locationService from '@/utils/locationService';

export default {
  name: 'WeatherView',
  components: {
    WeatherIcon
  },
  setup() {
    // 响应式状态
    const cityName = ref('');
    const isLoading = ref(false);
    const errorMessage = ref(null);
    const lastUpdateTime = ref(null);
    const isUsingLocation = ref(false);

    // 热门城市列表
    const popularCities = [
      '北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '南京', '武汉', '西安'
    ];

    // 从服务中获取数据
    const cityInfo = computed(() => weatherService.cityInfo.value);
    const nowWeather = computed(() => weatherService.nowWeather.value);
    const forecastWeather = computed(() => weatherService.forecastWeather.value);
    const minutelyWeather = computed(() => weatherService.minutelyWeather.value);

    // 计算属性
    const hasWeatherData = computed(() => {
      return cityInfo.value && nowWeather.value && nowWeather.value.now;
    });

    const hasError = computed(() => {
      return errorMessage.value !== null;
    });

    // 检查是否有降水数据
    const hasRainData = computed(() => {
      if (!minutelyWeather.value || !minutelyWeather.value.minutely || minutelyWeather.value.minutely.length === 0) {
        return false;
      }

      // 检查是否有任何分钟的降水量大于0
      return minutelyWeather.value.minutely.some(minute => parseFloat(minute.precip) > 0);
    });

    // 请求地理位置权限
    const requestLocationPermission = async () => {
      try {
        console.log('手动触发地理位置权限请求...');

        if (isNative()) {
          // 在原生环境中使用Capacitor Geolocation插件
          console.log('在原生环境中请求定位权限');

          // 请求权限
          const permissionResult = await locationService.requestLocationPermission();
          console.log('定位权限请求结果:', permissionResult);

          if (permissionResult.granted) {
            console.log('成功获取地理位置权限！');
            // 权限获取成功后获取天气数据
            getLocationWeather();
          } else {
            console.error('权限请求失败:', permissionResult.status);
            errorMessage.value = `地理位置权限请求失败: ${
              permissionResult.status === 'denied'
                ? '用户拒绝了权限请求，请在设备设置中允许应用使用位置信息'
                : '无法获取位置权限'
            }`;
          }
        } else {
          // 在Web环境中使用浏览器地理位置API
          if (navigator.geolocation) {
            console.log('在Web环境中请求定位权限');

            // 使用locationService中的方法
            const permissionResult = await locationService.requestLocationPermission();

            if (permissionResult.granted) {
              console.log('成功获取地理位置权限！');
              // 权限获取成功后获取天气数据
              getLocationWeather();
            } else {
              console.error('权限请求失败:', permissionResult.status);
              errorMessage.value = `地理位置权限请求失败: ${
                permissionResult.status === 'denied'
                  ? '用户拒绝了权限请求，请在浏览器设置中允许使用地理位置'
                  : '无法获取位置权限'
              }`;
            }
          } else {
            errorMessage.value = '您的浏览器不支持地理位置功能';
          }
        }
      } catch (error) {
        console.error('请求地理位置权限时发生错误:', error);
        errorMessage.value = `地理位置权限请求失败: ${error.message}`;
      }
    };

    // 获取当前位置天气
    const getLocationWeather = async () => {
      isLoading.value = true;
      errorMessage.value = null;
      isUsingLocation.value = true;
      cityName.value = ''; // 清空城市名称输入

      try {
        console.log('开始获取当前位置天气...');
        const result = await weatherService.fetchWeatherByLocation();

        if (!result.success) {
          console.error('获取天气数据失败:', result.error);
          errorMessage.value = result.error || '获取天气数据失败';
          // 如果定位失败，默认使用绵阳
          if (!cityName.value) {
            console.log('使用默认城市（绵阳）');
            cityName.value = '绵阳';
            await getWeatherData(false);
          }
        } else {
          console.log('成功获取天气数据');
          // 更新最后更新时间
          lastUpdateTime.value = new Date();
          // 如果成功获取到城市信息，更新城市名称显示
          if (cityInfo.value && cityInfo.value.name) {
            cityName.value = cityInfo.value.name;
          }
        }
      } catch (err) {
        console.error('获取当前位置天气错误:', err);
        errorMessage.value = err.message || '网络错误';
        // 如果定位失败，默认使用绵阳
        console.log('出现错误，使用默认城市（绵阳）');
        cityName.value = '绵阳';
        await getWeatherData(false);
      } finally {
        isLoading.value = false;
      }
    };

    // 选择热门城市
    const selectCity = (city) => {
      cityName.value = city;
      getWeatherData();
    };

    // 获取天气数据
    const getWeatherData = async (updateLocation = true) => {
      if (!cityName.value && updateLocation) {
        // 如果没有城市名称，尝试使用定位
        await getLocationWeather();
        return;
      } else if (!cityName.value) {
        errorMessage.value = '请输入城市名称';
        return;
      }

      isLoading.value = true;
      errorMessage.value = null;
      isUsingLocation.value = false;

      try {
        const result = await weatherService.fetchAllWeatherData(cityName.value);

        if (!result.success) {
          errorMessage.value = result.error || '获取天气数据失败';
        } else {
          // 更新最后更新时间
          lastUpdateTime.value = new Date();
        }
      } catch (err) {
        console.error('获取天气数据错误:', err);
        errorMessage.value = err.message || '网络错误';
      } finally {
        isLoading.value = false;
      }
    };



    // 生成折线图的点坐标
    const getLinePoints = () => {
      if (!minutelyWeather.value || !minutelyWeather.value.minutely || minutelyWeather.value.minutely.length === 0) {
        return '';
      }

      // 定义最大降水量，用于缩放
      const maxPrecip = 5; // 5mm

      // 生成折线图的点坐标
      return minutelyWeather.value.minutely.map((minute, index) => {
        const x = (index / (minutelyWeather.value.minutely.length - 1)) * 100;
        // 将降水量映射到 0-30 的范围，并反转（因为SVG的y轴向下）
        const y = 30 - (Math.min(parseFloat(minute.precip), maxPrecip) / maxPrecip) * 30;
        return `${x},${y}`;
      }).join(' ');
    };

    // 生成填充区域的路径
    const getAreaPath = () => {
      if (!minutelyWeather.value || !minutelyWeather.value.minutely || minutelyWeather.value.minutely.length === 0) {
        return '';
      }

      // 定义最大降水量，用于缩放
      const maxPrecip = 5; // 5mm

      // 生成折线图的点坐标
      const points = minutelyWeather.value.minutely.map((minute, index) => {
        const x = (index / (minutelyWeather.value.minutely.length - 1)) * 100;
        // 将降水量映射到 0-30 的范围，并反转（因为SVG的y轴向下）
        const y = 30 - (Math.min(parseFloat(minute.precip), maxPrecip) / maxPrecip) * 30;
        return { x, y };
      });

      // 创建路径：从左下角开始，经过所有点，到右下角结束
      let path = `M0,30 `; // 起点：左下角

      // 添加所有点
      points.forEach(point => {
        path += `L${point.x},${point.y} `;
      });

      path += `L100,30 Z`; // 结束点：右下角，并关闭路径

      return path;
    };

    // 获取所有数据点
    const getDataPoints = () => {
      if (!minutelyWeather.value || !minutelyWeather.value.minutely || minutelyWeather.value.minutely.length === 0) {
        return [];
      }

      // 定义最大降水量，用于缩放
      const maxPrecip = 5; // 5mm

      // 生成数据点
      return minutelyWeather.value.minutely.map((minute, index) => {
        const x = (index / (minutelyWeather.value.minutely.length - 1)) * 100;
        // 将降水量映射到 0-30 的范围，并反转（因为SVG的y轴向下）
        const y = 30 - (Math.min(parseFloat(minute.precip), maxPrecip) / maxPrecip) * 30;
        return { x, y, precip: minute.precip, time: minute.fxTime };
      });
    };

    // 根据降水量获取颜色
    const getRainColor = (precip) => {
      if (precip === 0) return '#e0e0e0';
      if (precip < 0.5) return '#b3e5fc';
      if (precip < 2) return '#4fc3f7';
      if (precip < 5) return '#03a9f4';
      if (precip < 10) return '#0288d1';
      return '#01579b';
    };

    // 格式化分钟级降水时间
    const formatMinuteTime = (timeStr) => {
      if (!timeStr) return '';

      const date = new Date(timeStr);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');

      return `${hours}:${minutes}`;
    };

    // 格式化日期
    const formatDate = (dateStr) => {
      if (!dateStr) return '';

      const date = new Date(dateStr);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const weekday = weekdays[date.getDay()];

      return `${month}月${day}日 ${weekday}`;
    };

    // 格式化更新时间
    const formatUpdateTime = (date) => {
      if (!date) return '';

      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');

      return `${hours}:${minutes}:${seconds}`;
    };

    // 组件挂载时获取数据
    onMounted(async () => {
      console.log('[Weather] 组件挂载，准备获取位置信息');

      // 如果是原生环境，先主动请求位置权限
      if (isNative()) {
        console.log('[Weather] 原生环境，主动请求位置权限');
        try {
          // 先检查权限状态
          const permissionStatus = await locationService.checkLocationPermission();
          console.log('[Weather] 当前位置权限状态:', permissionStatus);

          // 如果没有权限，主动请求权限
          if (permissionStatus.status !== 'granted') {
            console.log('[Weather] 没有位置权限，主动请求');
            await requestLocationPermission();
          } else {
            console.log('[Weather] 已有位置权限，直接获取位置天气');
            // 已有权限，直接获取位置天气
            getLocationWeather();
          }
        } catch (error) {
          console.error('[Weather] 检查或请求权限时出错:', error);
          // 出错时，尝试获取天气数据（会回退到IP定位）
          getLocationWeather();
        }
      } else {
        // Web环境，直接尝试获取位置天气（会触发浏览器的权限请求）
        console.log('[Weather] Web环境，尝试获取位置天气');
        getLocationWeather();
      }
    });

    return {
      cityName,
      isLoading,
      errorMessage,
      hasError,
      cityInfo,
      nowWeather,
      forecastWeather,
      minutelyWeather,
      hasWeatherData,
      hasRainData,
      popularCities,
      lastUpdateTime,
      getWeatherData,
      getLocationWeather,
      requestLocationPermission,
      selectCity,

      getRainColor,
      getLinePoints,
      getAreaPath,
      getDataPoints,
      formatDate,
      formatMinuteTime,
      formatUpdateTime
    };
  }
};
</script>

<style lang="scss" scoped>
.weather-container {
  padding: var(--spacing-lg) var(--spacing-md);
  max-width: 800px;
  margin: 0 auto;

  h1 {
    text-align: center;
    margin-bottom: var(--spacing-lg);
    color: #333;
    font-size: var(--font-size-xxl);
  }

  .city-selector {
    margin-bottom: var(--spacing-lg);

    .search-container {
      display: flex;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-md);
      justify-content: center;

      .input-group {
        position: relative;
        flex: 1;
        max-width: 400px;
        display: flex;
        align-items: center;

        .location-icon {
          position: absolute;
          left: 10px;
          color: #666;
          font-size: 20px;
        }

        input {
          flex: 1;
          padding: 12px 12px 12px 40px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: var(--font-size-md);
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

          &:focus {
            border-color: var(--color-primary);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            outline: none;
          }
        }

        .clear-btn {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;

          &:hover {
            color: #666;
          }

          .material-icons {
            font-size: 18px;
          }
        }
      }

      .location-btn {
        height: 48px;
        width: 48px;
        background-color: #039be5; /* 浅蓝色 */
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
        margin-right: var(--spacing-xs);

        &:hover:not(:disabled) {
          background-color: #0288d1;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
          transform: translateY(-1px);
        }

        &:active:not(:disabled) {
          background-color: #0277bd;
          transform: translateY(1px);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        &:disabled {
          background-color: #78909c;
          cursor: not-allowed;
          box-shadow: none;
        }

        .icon {
          font-size: 20px;
        }
      }

      .search-btn {
        padding: 0 20px;
        height: 48px;
        background-color: #0277bd; /* 更深的蓝色 */
        color: white;
        border: none;
        border-radius: 8px;
        font-size: var(--font-size-md);
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        transition: all 0.3s ease;
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);

        &:hover:not(:disabled) {
          background-color: #01579b; /* 悬停时更深 */
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
          transform: translateY(-1px);
        }

        &:active:not(:disabled) {
          background-color: #015285; /* 点击时更深 */
          transform: translateY(1px);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        &:disabled {
          background-color: #78909c; /* 灰蓝色，而不是纯灰色 */
          cursor: not-allowed;
          box-shadow: none;
        }

        .icon {
          font-size: 20px;
        }

        .btn-text {
          font-weight: 600; /* 增加字重 */
        }
      }
    }

    .popular-cities {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-sm);

      .popular-city-label {
        color: #666;
        font-size: var(--font-size-sm);
      }

      .city-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .city-tag {
          padding: 6px 14px;
          background-color: #e3f2fd; /* 浅蓝色背景 */
          border: 1px solid #bbdefb;
          border-radius: 16px;
          font-size: var(--font-size-sm);
          color: #0277bd; /* 蓝色文字，与按钮颜色匹配 */
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

          &:hover {
            background-color: #bbdefb; /* 悬停时的深蓝色 */
            color: #01579b;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }

          &:active {
            background-color: #90caf9; /* 点击时的更深蓝色 */
            transform: translateY(1px);
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
          }
        }
      }
    }
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl) 0;

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: var(--color-primary);
      animation: spin 1s ease-in-out infinite;
      margin-bottom: var(--spacing-md);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    p {
      color: #666;
      font-size: var(--font-size-md);
    }
  }

  .error-message {
    background-color: #fff5f5;
    border: 1px solid #ffebeb;
    border-radius: 8px;
    padding: var(--spacing-md);
    margin: var(--spacing-lg) 0;
    text-align: center;

    p {
      color: #e53e3e;
      margin-bottom: var(--spacing-md);
      font-weight: 500;
    }

    .permission-help {
      background-color: #f8f9fa;
      border-radius: 6px;
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-md);
      text-align: left;

      p {
        color: #333;
        font-weight: 500;
        margin-bottom: var(--spacing-sm);
      }

      .permission-steps {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);

        .step {
          display: flex;
          gap: var(--spacing-md);
          align-items: flex-start;

          .step-number {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            background-color: #0277bd;
            color: white;
            border-radius: 50%;
            font-weight: bold;
            flex-shrink: 0;
          }

          .step-content {
            flex: 1;

            h4 {
              margin: 0 0 var(--spacing-xs) 0;
              color: #333;
              font-size: var(--font-size-md);
            }

            p {
              margin: 0 0 var(--spacing-xs) 0;
            }

            ol, ul {
              margin: var(--spacing-xs) 0;
              padding-left: var(--spacing-lg);

              li {
                color: #555;
                margin-bottom: var(--spacing-xs);
                line-height: 1.5;
              }
            }

            code {
              background-color: #e0e0e0;
              padding: 2px 4px;
              border-radius: 3px;
              font-family: monospace;
              font-size: 90%;
              word-break: break-all;
            }
          }
        }
      }

      .permission-btn {
        background-color: #0288d1;
        color: white;
        border: none;
        border-radius: 6px;
        padding: var(--spacing-sm) var(--spacing-md);
        font-size: var(--font-size-md);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        margin: var(--spacing-sm) 0;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

        &:hover {
          background-color: #0277bd;
          transform: translateY(-1px);
          box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
        }

        &:active {
          transform: translateY(1px);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .icon {
          font-size: var(--font-size-lg);
        }
      }
    }

    .buttons-container {
      display: flex;
      justify-content: center;
      gap: var(--spacing-md);
      flex-wrap: wrap;
    }

    .retry-btn, .default-city-btn {
      color: white;
      border: none;
      border-radius: 6px;
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: var(--font-size-md);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
      }

      &:active {
        transform: translateY(1px);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .icon {
        font-size: var(--font-size-lg);
      }
    }

    .retry-btn {
      background-color: #e53e3e;

      &:hover {
        background-color: #c53030;
      }
    }

    .default-city-btn {
      background-color: #4299e1;

      &:hover {
        background-color: #3182ce;
      }
    }
  }

  .weather-data {
    .current-weather {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: var(--spacing-lg);
      margin-bottom: var(--spacing-lg);

      h2 {
        margin-bottom: var(--spacing-md);
        color: #333;
        font-size: var(--font-size-xl);
        text-align: center;
      }

      .weather-info {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--spacing-lg);

        .current-weather-icon {
          margin-right: var(--spacing-lg);
        }

        .weather-details {
          margin-left: var(--spacing-lg);

          .temperature {
            font-size: 48px;
            font-weight: bold;
            color: #333;
            margin: 0;
          }

          .weather-desc {
            font-size: var(--font-size-lg);
            color: #666;
            margin: var(--spacing-xs) 0;
          }

          .weather-feel {
            font-size: var(--font-size-md);
            color: #888;
          }
        }
      }

      .weather-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: var(--spacing-md);

        .meta-item {
          display: flex;
          flex-direction: column;
          align-items: center;

          .label {
            font-size: var(--font-size-sm);
            color: #888;
            margin-bottom: var(--spacing-xs);
          }

          .value {
            font-size: var(--font-size-md);
            color: #333;
            font-weight: 500;

            &.air-excellent {
              color: #10b981;
            }

            &.air-good {
              color: #22c55e;
            }

            &.air-moderate {
              color: #f59e0b;
            }

            &.air-poor {
              color: #f97316;
            }

            &.air-very-poor {
              color: #ef4444;
            }

            &.air-hazardous {
              color: #7f1d1d;
            }
          }
        }
      }
    }

    .minutely {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: var(--spacing-lg);
      margin-bottom: var(--spacing-lg);

      h2 {
        margin-bottom: var(--spacing-md);
        color: #333;
        font-size: var(--font-size-xl);
        text-align: center;
      }

      .minutely-summary {
        text-align: center;
        margin-bottom: var(--spacing-md);
        font-size: var(--font-size-md);
        color: #666;
        padding: 0 var(--spacing-md);
      }

      .no-rain-message {
        text-align: center;
        padding: var(--spacing-lg);
        color: #666;
        font-size: var(--font-size-md);
        background-color: #f8f9fa;
        border-radius: 8px;
        margin: var(--spacing-md) 0;
      }

      .minutely-chart {
        height: 250px;
        margin: var(--spacing-md) 0;

        .chart-container {
          position: relative;
          height: 200px;
          width: 100%;
          background-color: #f8f9fa;
          border-radius: 4px;
          padding: var(--spacing-xs);
          display: flex;

          .rain-line-chart {
            width: 100%;
            height: 100%;

            .grid-line {
              stroke: #e0e0e0;
              stroke-width: 0.2;
            }

            .rain-line {
              stroke: #03a9f4;
              stroke-width: 0.5;
              stroke-linejoin: round;
            }

            .rain-area {
              fill: url(#rain-gradient);
              fill-opacity: 0.5;
            }

            .data-point {
              fill: #03a9f4;

              &.has-rain {
                fill: #0288d1;
              }
            }
          }

          .rain-scale {
            position: absolute;
            right: var(--spacing-xs);
            top: 0;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            color: #888;
            font-size: var(--font-size-xs);
            padding: var(--spacing-xs) 0;
          }
        }

        .time-labels {
          display: flex;
          justify-content: space-between;
          margin-top: var(--spacing-xs);
          color: #888;
          font-size: var(--font-size-xs);
        }
      }
    }

    .forecast {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: var(--spacing-lg);
      margin-bottom: var(--spacing-lg);

      h2 {
        margin-bottom: var(--spacing-md);
        color: #333;
        font-size: var(--font-size-xl);
        text-align: center;
      }

      .forecast-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: var(--spacing-md);

        .forecast-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-md);
          border-radius: 8px;
          background-color: #f8f9fa;

          .forecast-date {
            font-size: var(--font-size-sm);
            color: #666;
            margin-bottom: var(--spacing-sm);
            text-align: center;
          }

          .forecast-weather-icon {
            margin: var(--spacing-xs) 0;
          }

          .forecast-temp {
            font-size: var(--font-size-md);
            font-weight: 500;
            color: #333;
            margin: var(--spacing-sm) 0;
          }

          .forecast-desc {
            font-size: var(--font-size-sm);
            color: #666;
            margin-bottom: var(--spacing-xs);
            text-align: center;
          }

          .forecast-wind {
            font-size: var(--font-size-xs);
            color: #888;
            text-align: center;
          }
        }
      }
    }

    .update-time {
      text-align: center;
      color: #888;
      font-size: var(--font-size-sm);
      margin-top: var(--spacing-md);
    }
  }
}

@media (max-width: 600px) {
  .error-message {
    .permission-help {
      .permission-steps {
        .step {
          flex-direction: column;

          .step-number {
            margin-bottom: var(--spacing-xs);
          }
        }
      }
    }

    .buttons-container {
      flex-direction: column;
      gap: var(--spacing-sm);

      button {
        width: 100%;
      }
    }
  }

  .weather-container {
    .city-selector {
      .search-container {
        flex-direction: column;
        align-items: stretch;

        .input-group {
          width: 100%;
          max-width: none;
        }

        .location-btn, .search-btn {
          margin-top: var(--spacing-xs);
        }

        .location-btn {
          width: 100%;
          margin-right: 0;
        }

        .search-btn {
          width: 100%;
          justify-content: center;
        }
      }

      .popular-cities {
        flex-direction: column;
        gap: var(--spacing-xs);

        .city-tags {
          justify-content: center;
        }
      }
    }

    .weather-data {
      .current-weather {
        .weather-info {
          flex-direction: column;

          .weather-details {
            margin-left: 0;
            margin-top: var(--spacing-md);
            text-align: center;
          }
        }
      }

      .forecast {
        .forecast-list {
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        }
      }
    }
  }
}
</style>
