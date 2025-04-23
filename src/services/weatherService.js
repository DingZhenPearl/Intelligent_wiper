// src/services/weatherService.js
import { ref } from 'vue';
import { get } from './api';

// 创建一个单例服务，用于获取和缓存天气数据
const weatherService = {
  // 实时天气数据
  nowWeather: ref(null),

  // 天气预报数据
  forecastWeather: ref(null),

  // 分钟级降水预报数据
  minutelyWeather: ref(null),

  // 城市信息
  cityInfo: ref(null),

  // 加载状态
  loading: ref({
    now: false,
    forecast: false,
    city: false,
    minutely: false
  }),

  // 错误信息
  error: ref({
    now: null,
    forecast: null,
    city: null,
    minutely: null
  }),

  // 最后更新时间
  lastUpdateTime: ref({
    now: null,
    forecast: null,
    city: null,
    minutely: null
  }),

  /**
   * 获取城市信息
   * @param {string} cityName - 城市名称，默认为"绵阳"
   * @returns {Promise<Object>} - 包含城市信息的Promise
   */
  async fetchCityInfo(cityName = '绵阳') {
    try {
      this.loading.value.city = true;
      this.error.value.city = null;

      console.log(`[天气服务] 开始获取城市信息，城市名称: ${cityName}`);

      // 构建API请求URL
      const url = `/api/weather/city?location=${encodeURIComponent(cityName)}`;

      // 发送请求
      const response = await get(url);

      if (response.ok) {
        const result = await response.json();

        if (result.success && result.data && result.data.location && result.data.location.length > 0) {
          console.log('[天气服务] 获取城市信息成功:', result.data);

          // 更新城市信息
          this.cityInfo.value = result.data.location[0];

          // 更新最后更新时间
          this.lastUpdateTime.value.city = new Date();

          return {
            success: true,
            data: result.data.location[0]
          };
        } else {
          console.error('[天气服务] 获取城市信息失败:', result.error || '未找到城市信息');
          this.error.value.city = result.error || '未找到城市信息';
          return {
            success: false,
            error: this.error.value.city
          };
        }
      } else {
        const errorData = await response.json();
        console.error('[天气服务] 获取城市信息失败:', errorData);
        this.error.value.city = errorData.error || '获取城市信息失败';
        return {
          success: false,
          error: this.error.value.city
        };
      }
    } catch (error) {
      console.error('[天气服务] 获取城市信息错误:', error);
      this.error.value.city = error.message || '网络错误';
      return {
        success: false,
        error: this.error.value.city
      };
    } finally {
      this.loading.value.city = false;
    }
  },

  /**
   * 获取实时天气数据
   * @param {string} locationId - 城市ID或坐标，默认为绵阳城市代码
   * @returns {Promise<Object>} - 包含实时天气数据的Promise
   */
  async fetchNowWeather(locationId = '101270401') {
    try {
      this.loading.value.now = true;
      this.error.value.now = null;

      console.log(`[天气服务] 开始获取实时天气数据，位置: ${locationId}`);

      // 构建API请求URL
      const url = `/api/weather/now?location=${locationId}`;

      // 发送请求
      const response = await get(url);

      if (response.ok) {
        const result = await response.json();

        if (result.success && result.data && result.data.now) {
          console.log('[天气服务] 获取实时天气数据成功:', result.data);

          // 更新天气数据
          this.nowWeather.value = result.data;

          // 更新最后更新时间
          this.lastUpdateTime.value.now = new Date();

          return {
            success: true,
            data: result.data
          };
        } else {
          console.error('[天气服务] 获取实时天气数据失败:', result.error);
          this.error.value.now = result.error || '获取实时天气数据失败';
          return {
            success: false,
            error: this.error.value.now
          };
        }
      } else {
        const errorData = await response.json();
        console.error('[天气服务] 获取实时天气数据失败:', errorData);
        this.error.value.now = errorData.error || '获取实时天气数据失败';
        return {
          success: false,
          error: this.error.value.now
        };
      }
    } catch (error) {
      console.error('[天气服务] 获取实时天气数据错误:', error);
      this.error.value.now = error.message || '网络错误';
      return {
        success: false,
        error: this.error.value.now
      };
    } finally {
      this.loading.value.now = false;
    }
  },

  /**
   * 获取天气预报数据
   * @param {string} locationId - 城市ID或坐标，默认为绵阳城市代码
   * @returns {Promise<Object>} - 包含天气预报数据的Promise
   */
  /**
   * 获取分钟级降水预报数据
   * @param {Object} options - 请求选项
   * @param {string} [options.locationId] - 城市ID，默认为绵阳城市代码
   * @param {number} [options.lon] - 经度
   * @param {number} [options.lat] - 纬度
   * @returns {Promise<Object>} - 包含分钟级降水预报数据的Promise
   */
  async fetchMinutelyWeather(options = {}) {
    try {
      this.loading.value.minutely = true;
      this.error.value.minutely = null;

      const { locationId = '101270401', lon, lat } = options;

      console.log(`[天气服务] 开始获取分钟级降水预报数据`);

      // 构建API请求URL
      let url = '/api/weather/minutely';

      // 如果提供了经纬度，优先使用
      if (lon && lat) {
        url += `?lon=${lon}&lat=${lat}`;
        console.log(`[天气服务] 使用经纬度坐标: ${lon},${lat}`);
      } else {
        url += `?location=${locationId}`;
        console.log(`[天气服务] 使用城市ID: ${locationId}`);
      }

      // 发送请求
      const response = await get(url);

      if (response.ok) {
        const result = await response.json();

        if (result.success && result.data && result.data.minutely) {
          console.log('[天气服务] 获取分钟级降水预报数据成功:', result.data);

          // 更新分钟级降水预报数据
          this.minutelyWeather.value = result.data;

          // 更新最后更新时间
          this.lastUpdateTime.value.minutely = new Date();

          return {
            success: true,
            data: result.data
          };
        } else {
          console.error('[天气服务] 获取分钟级降水预报数据失败:', result.error);
          this.error.value.minutely = result.error || '获取分钟级降水预报数据失败';
          return {
            success: false,
            error: this.error.value.minutely
          };
        }
      } else {
        const errorData = await response.json();
        console.error('[天气服务] 获取分钟级降水预报数据失败:', errorData);
        this.error.value.minutely = errorData.error || '获取分钟级降水预报数据失败';
        return {
          success: false,
          error: this.error.value.minutely
        };
      }
    } catch (error) {
      console.error('[天气服务] 获取分钟级降水预报数据错误:', error);
      this.error.value.minutely = error.message || '网络错误';
      return {
        success: false,
        error: this.error.value.minutely
      };
    } finally {
      this.loading.value.minutely = false;
    }
  },

  async fetchForecastWeather(locationId = '101270401') {
    try {
      this.loading.value.forecast = true;
      this.error.value.forecast = null;

      console.log(`[天气服务] 开始获取天气预报数据，位置: ${locationId}`);

      // 构建API请求URL
      const url = `/api/weather/forecast?location=${locationId}`;

      // 发送请求
      const response = await get(url);

      if (response.ok) {
        const result = await response.json();

        if (result.success && result.data && result.data.daily) {
          console.log('[天气服务] 获取天气预报数据成功:', result.data);

          // 更新天气预报数据
          this.forecastWeather.value = result.data;

          // 更新最后更新时间
          this.lastUpdateTime.value.forecast = new Date();

          return {
            success: true,
            data: result.data
          };
        } else {
          console.error('[天气服务] 获取天气预报数据失败:', result.error);
          this.error.value.forecast = result.error || '获取天气预报数据失败';
          return {
            success: false,
            error: this.error.value.forecast
          };
        }
      } else {
        const errorData = await response.json();
        console.error('[天气服务] 获取天气预报数据失败:', errorData);
        this.error.value.forecast = errorData.error || '获取天气预报数据失败';
        return {
          success: false,
          error: this.error.value.forecast
        };
      }
    } catch (error) {
      console.error('[天气服务] 获取天气预报数据错误:', error);
      this.error.value.forecast = error.message || '网络错误';
      return {
        success: false,
        error: this.error.value.forecast
      };
    } finally {
      this.loading.value.forecast = false;
    }
  },

  /**
   * 获取完整天气数据（城市信息、实时天气和预报）
   * @param {string} cityName - 城市名称，默认为"绵阳"
   * @returns {Promise<Object>} - 包含完整天气数据的Promise
   */
  async fetchAllWeatherData(cityName = '绵阳') {
    try {
      // 先获取城市信息
      const cityResult = await this.fetchCityInfo(cityName);

      if (!cityResult.success) {
        return cityResult; // 返回错误
      }

      const locationId = this.cityInfo.value.id;
      const lon = this.cityInfo.value.lon;
      const lat = this.cityInfo.value.lat;

      // 并行获取实时天气、预报和分钟级降水数据
      const [nowResult, forecastResult, minutelyResult] = await Promise.all([
        this.fetchNowWeather(locationId),
        this.fetchForecastWeather(locationId),
        this.fetchMinutelyWeather({ locationId, lon, lat })
      ]);

      // 检查结果
      if (!nowResult.success) {
        return nowResult; // 返回实时天气错误
      }

      if (!forecastResult.success) {
        return forecastResult; // 返回预报错误
      }

      // 分钟级降水数据失败不影响整体显示，只记录错误
      if (!minutelyResult.success) {
        console.warn('[天气服务] 获取分钟级降水数据失败:', minutelyResult.error);
      }

      // 所有数据获取成功
      return {
        success: true,
        data: {
          city: this.cityInfo.value,
          now: this.nowWeather.value,
          forecast: this.forecastWeather.value,
          minutely: this.minutelyWeather.value
        }
      };
    } catch (error) {
      console.error('[天气服务] 获取完整天气数据错误:', error);
      return {
        success: false,
        error: error.message || '获取天气数据错误'
      };
    }
  }
};

export default weatherService;
