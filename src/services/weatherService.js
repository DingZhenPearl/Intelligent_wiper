// src/services/weatherService.js
import { ref } from 'vue';
import { get } from './api';
import { isNative } from '../utils/platform';
import * as locationService from '../utils/locationService';

// 地理位置状态
const locationStatus = ref({
  isLocating: false,
  error: null,
  position: null,
  ipLocation: null
});

// 创建一个单例服务，用于获取和缓存天气数据
const weatherService = {
  // 地理位置状态
  locationStatus,
  // 实时天气数据
  nowWeather: ref(null),

  // 天气预报数据
  forecastWeather: ref(null),

  // 分钟级降水预报数据
  minutelyWeather: ref(null),

  // 逐小时天气预报数据
  hourlyWeather: ref(null),

  // 城市信息
  cityInfo: ref(null),

  // 加载状态
  loading: ref({
    now: false,
    forecast: false,
    city: false,
    minutely: false,
    hourly: false
  }),

  // 错误信息
  error: ref({
    now: null,
    forecast: null,
    city: null,
    minutely: null,
    hourly: null
  }),

  // 最后更新时间
  lastUpdateTime: ref({
    now: null,
    forecast: null,
    city: null,
    minutely: null,
    hourly: null
  }),

  /**
   * 获取城市信息
   * @param {string} cityName - 城市名称，如果提供经纬度则可为空
   * @param {number} longitude - 经度，可选
   * @param {number} latitude - 纬度，可选
   * @returns {Promise<Object>} - 包含城市信息的Promise
   */
  async fetchCityInfo(cityName = '绵阳', longitude = null, latitude = null) {
    try {
      this.loading.value.city = true;
      this.error.value.city = null;

      let url;

      // 如果提供了经纬度，优先使用经纬度查询
      if (longitude !== null && latitude !== null) {
        console.log(`[天气服务] 开始获取城市信息，经度: ${longitude}, 纬度: ${latitude}`);
        url = `/api/weather/city?location=${longitude},${latitude}`;
      } else {
        console.log(`[天气服务] 开始获取城市信息，城市名称: ${cityName}`);
        url = `/api/weather/city?location=${encodeURIComponent(cityName)}`;
      }

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
   * 获取逐小时天气预报数据
   * @param {string} locationId - 城市ID或坐标，默认为绵阳城市代码
   * @returns {Promise<Object>} - 包含逐小时天气预报数据的Promise
   */
  async fetchHourlyWeather(locationId = '101270401') {
    try {
      this.loading.value.hourly = true;
      this.error.value.hourly = null;

      console.log(`[天气服务] 开始获取逐小时天气预报数据，位置: ${locationId}`);

      // 构建API请求URL
      const url = `/api/weather/hourly?location=${locationId}`;

      // 发送请求
      const response = await get(url);

      if (response.ok) {
        const result = await response.json();

        if (result.success && result.data && result.data.hourly) {
          console.log('[天气服务] 获取逐小时天气预报数据成功:', result.data);

          // 更新逐小时天气预报数据
          this.hourlyWeather.value = result.data;

          // 更新最后更新时间
          this.lastUpdateTime.value.hourly = new Date();

          return {
            success: true,
            data: result.data
          };
        } else {
          console.error('[天气服务] 获取逐小时天气预报数据失败:', result.error);
          this.error.value.hourly = result.error || '获取逐小时天气预报数据失败';
          return {
            success: false,
            error: this.error.value.hourly
          };
        }
      } else {
        const errorData = await response.json();
        console.error('[天气服务] 获取逐小时天气预报数据失败:', errorData);
        this.error.value.hourly = errorData.error || '获取逐小时天气预报数据失败';
        return {
          success: false,
          error: this.error.value.hourly
        };
      }
    } catch (error) {
      console.error('[天气服务] 获取逐小时天气预报数据错误:', error);
      this.error.value.hourly = error.message || '网络错误';
      return {
        success: false,
        error: this.error.value.hourly
      };
    } finally {
      this.loading.value.hourly = false;
    }
  },

  /**
   * 通过IP地址获取位置信息
   * @returns {Promise<Object>} - 包含IP地址位置信息的Promise
   */
  async getLocationByIp() {
    try {
      console.log('[天气服务] 开始通过IP地址获取位置信息');

      // 更新定位状态
      this.locationStatus.value.isLocating = true;
      this.locationStatus.value.error = null;

      // 调用IP定位API
      console.log('[天气服务] 发送请求到 /api/iplocation');
      const response = await get('/api/iplocation');
      console.log('[天气服务] 收到IP定位API响应:', response);

      if (response.ok) {
        console.log('[天气服务] IP定位API响应状态码:', response.status);
        const result = await response.json();
        console.log('[天气服务] IP定位API响应数据:', JSON.stringify(result));

        if (result.success && result.data) {
          console.log('[天气服务] 通过IP地址获取位置信息成功:', JSON.stringify(result.data));

          // 如果返回了经纬度信息
          if (result.data.ll && result.data.ll.length === 2) {
            const [latitude, longitude] = result.data.ll;
            console.log(`[天气服务] 解析经纬度: [${latitude}, ${longitude}]`);

            // 更新位置信息
            this.locationStatus.value.ipLocation = {
              ip: result.data.ip,
              city: result.data.city,
              region: result.data.region,
              country: result.data.country,
              latitude,
              longitude
            };

            this.locationStatus.value.isLocating = false;

            console.log(`[天气服务] IP定位成功，获取到经纬度: 经度 ${longitude}, 纬度 ${latitude}`);
            return { latitude, longitude };
          } else if (result.data.city) {
            // 如果只返回了城市信息但没有经纬度，也可以使用
            console.log(`[天气服务] 只获取到城市信息，没有经纬度: ${result.data.city}`);

            this.locationStatus.value.ipLocation = {
              ip: result.data.ip,
              city: result.data.city,
              region: result.data.region,
              country: result.data.country
            };

            this.locationStatus.value.isLocating = false;

            console.log(`[天气服务] IP定位成功，获取到城市名称: ${result.data.city}`);
            // 返回城市名称，后续可以通过城市名称查询
            return { cityName: result.data.city };
          } else {
            console.warn('[天气服务] IP定位返回的数据不完整，使用默认城市（绵阳）');
            console.log('[天气服务] 返回的数据:', JSON.stringify(result.data));
            this.locationStatus.value.isLocating = false;
            return { cityName: '绵阳' };
          }
        } else {
          console.warn('[天气服务] IP定位失败，使用默认城市（绵阳）:', result.error);
          console.log('[天气服务] 完整响应:', JSON.stringify(result));
          this.locationStatus.value.isLocating = false;
          return { cityName: '绵阳' };
        }
      } else {
        console.warn('[天气服务] IP定位请求失败，状态码:', response.status);
        let errorData;
        try {
          errorData = await response.json();
          console.warn('[天气服务] 错误响应数据:', JSON.stringify(errorData));
        } catch (e) {
          console.warn('[天气服务] 无法解析错误响应:', e);
          errorData = { error: '无法解析错误响应' };
        }

        console.warn('[天气服务] IP定位请求失败，使用默认城市（绵阳）:', errorData.error);
        this.locationStatus.value.isLocating = false;
        return { cityName: '绵阳' };
      }
    } catch (error) {
      console.error('[天气服务] 通过IP地址获取位置信息错误:', error);
      console.error('[天气服务] 错误堆栈:', error.stack);
      console.warn('[天气服务] 使用默认城市（绵阳）');
      this.locationStatus.value.error = null; // 清除错误，因为我们会使用默认城市
      this.locationStatus.value.isLocating = false;
      return { cityName: '绵阳' };
    }
  },

  /**
   * 获取当前地理位置
   * @returns {Promise<Object>} - 包含地理位置信息的Promise
   */
  async getCurrentLocation() {
    // 更新定位状态
    this.locationStatus.value.isLocating = true;
    this.locationStatus.value.error = null;

    try {
      // 在原生环境中，优先使用设备定位
      if (isNative()) {
        console.log('[天气服务] 原生环境，优先尝试使用设备定位');

        try {
          // 先检查权限
          const permissionResult = await locationService.checkLocationPermission();
          console.log('[天气服务] 定位权限状态:', permissionResult);

          // 如果已经有权限，直接获取位置
          if (permissionResult.status === 'granted') {
            console.log('[天气服务] 已有定位权限，直接获取位置');

            // 获取位置
            const positionResult = await locationService.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000
            });

            if (positionResult.success) {
              const { latitude, longitude } = positionResult.coords;
              console.log(`[天气服务] 设备定位成功: 经度 ${longitude}, 纬度 ${latitude}`);

              // 更新位置信息
              this.locationStatus.value.position = { latitude, longitude };
              this.locationStatus.value.isLocating = false;

              return { latitude, longitude };
            } else {
              console.warn('[天气服务] 设备定位失败，尝试IP定位:', positionResult.error);
            }
          } else {
            console.log('[天气服务] 没有定位权限，尝试IP定位');
          }
        } catch (deviceError) {
          console.error('[天气服务] 设备定位出错，尝试IP定位:', deviceError);
        }
      } else {
        console.log('[天气服务] Web环境，尝试浏览器定位');

        try {
          // 检查浏览器是否支持安全上下文
          if (window.isSecureContext === false) {
            console.warn('[天气服务] 当前不是安全上下文（非HTTPS），地理位置功能可能受限');
          }

          const positionResult = await locationService.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
          });

          if (positionResult.success) {
            const { latitude, longitude } = positionResult.coords;
            console.log(`[天气服务] 浏览器定位成功: 经度 ${longitude}, 纬度 ${latitude}`);

            // 更新位置信息
            this.locationStatus.value.position = { latitude, longitude };
            this.locationStatus.value.isLocating = false;

            return { latitude, longitude };
          } else {
            console.warn('[天气服务] 浏览器定位失败，尝试IP定位:', positionResult.error);
          }
        } catch (browserError) {
          console.warn('[天气服务] 浏览器定位出错，尝试IP定位:', browserError);
        }
      }

      // 如果设备定位或浏览器定位失败，尝试IP定位
      console.log('[天气服务] 尝试通过IP地址获取位置');
      const ipLocation = await this.getLocationByIp();
      console.log('[天气服务] IP定位结果:', ipLocation);

      this.locationStatus.value.isLocating = false;
      return ipLocation;
    } catch (error) {
      console.error(`[天气服务] 获取地理位置失败: ${error.message}`);
      console.warn('[天气服务] 使用默认城市（绵阳）');

      // 更新状态
      this.locationStatus.value.error = null; // 清除错误，因为我们会使用默认城市
      this.locationStatus.value.isLocating = false;

      return { cityName: '绵阳' };
    }
  },

  /**
   * 根据地理位置获取天气数据
   * @returns {Promise<Object>} - 包含天气数据的Promise
   */
  async fetchWeatherByLocation() {
    try {
      console.log('[天气服务] 开始根据地理位置获取天气数据');

      // 获取当前位置（优先使用IP定位）
      console.log('[天气服务] 调用getCurrentLocation()获取当前位置');
      const locationInfo = await this.getCurrentLocation();
      console.log('[天气服务] 获取到位置信息:', JSON.stringify(locationInfo));

      // 如果返回的是城市名称而不是经纬度（IP定位只返回了城市名称）
      if (locationInfo.cityName && !locationInfo.latitude) {
        console.log(`[天气服务] 使用IP定位获取到城市名称: ${locationInfo.cityName}，直接获取该城市的天气数据`);
        // 直接使用城市名称获取天气数据
        return await this.fetchAllWeatherData(locationInfo.cityName);
      }

      // 如果获取到了经纬度，使用经纬度获取城市信息
      const { latitude, longitude } = locationInfo;
      console.log(`[天气服务] 使用经纬度获取城市信息: 经度 ${longitude}, 纬度 ${latitude}`);

      // 先获取城市信息
      const cityResult = await this.fetchCityInfo(null, longitude, latitude);
      console.log('[天气服务] 获取城市信息结果:', JSON.stringify(cityResult));

      if (!cityResult.success) {
        console.error('[天气服务] 获取城市信息失败:', cityResult.error);
        return cityResult; // 返回错误
      }

      const locationId = this.cityInfo.value.id;
      console.log(`[天气服务] 获取到城市ID: ${locationId}`);

      // 并行获取实时天气、预报、分钟级降水数据和逐小时天气预报
      console.log('[天气服务] 开始并行获取天气数据');
      const [nowResult, forecastResult, minutelyResult, hourlyResult] = await Promise.all([
        this.fetchNowWeather(locationId),
        this.fetchForecastWeather(locationId),
        this.fetchMinutelyWeather({ locationId, lon: longitude, lat: latitude }),
        this.fetchHourlyWeather(locationId)
      ]);

      // 检查结果
      if (!nowResult.success) {
        console.error('[天气服务] 获取实时天气数据失败:', nowResult.error);
        return nowResult; // 返回实时天气错误
      }

      if (!forecastResult.success) {
        console.error('[天气服务] 获取天气预报数据失败:', forecastResult.error);
        return forecastResult; // 返回预报错误
      }

      // 分钟级降水数据失败不影响整体显示，只记录错误
      if (!minutelyResult.success) {
        console.warn('[天气服务] 获取分钟级降水数据失败:', minutelyResult.error);
      }

      // 逐小时天气预报数据失败不影响整体显示，只记录错误
      if (!hourlyResult.success) {
        console.warn('[天气服务] 获取逐小时天气预报数据失败:', hourlyResult.error);
      }

      // 所有数据获取成功
      console.log('[天气服务] 成功获取所有天气数据');
      return {
        success: true,
        data: {
          city: this.cityInfo.value,
          now: this.nowWeather.value,
          forecast: this.forecastWeather.value,
          minutely: this.minutelyWeather.value,
          hourly: this.hourlyWeather.value
        }
      };
    } catch (error) {
      console.error('[天气服务] 根据地理位置获取天气数据错误:', error);
      return {
        success: false,
        error: error.message || '获取天气数据错误'
      };
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

      // 并行获取实时天气、预报、分钟级降水数据和逐小时天气预报
      const [nowResult, forecastResult, minutelyResult, hourlyResult] = await Promise.all([
        this.fetchNowWeather(locationId),
        this.fetchForecastWeather(locationId),
        this.fetchMinutelyWeather({ locationId, lon, lat }),
        this.fetchHourlyWeather(locationId)
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

      // 逐小时天气预报数据失败不影响整体显示，只记录错误
      if (!hourlyResult.success) {
        console.warn('[天气服务] 获取逐小时天气预报数据失败:', hourlyResult.error);
      }

      // 所有数据获取成功
      return {
        success: true,
        data: {
          city: this.cityInfo.value,
          now: this.nowWeather.value,
          forecast: this.forecastWeather.value,
          minutely: this.minutelyWeather.value,
          hourly: this.hourlyWeather.value
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
