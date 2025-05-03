// src/services/weatherMapService.js
import { get } from './api';

/**
 * 天气地图服务
 */
const weatherMapService = {
  /**
   * 根据经纬度获取天气信息
   * @param {number} longitude - 经度
   * @param {number} latitude - 纬度
   * @returns {Promise<Object>} - 天气信息
   */
  async getWeatherByLocation(longitude, latitude) {
    try {
      console.log(`[天气地图服务] 开始获取位置(${longitude},${latitude})的天气信息`);

      // 先通过高德地图JavaScript API获取城市编码
      const cityInfo = await this.getCityByLocationJS(longitude, latitude);
      if (!cityInfo || !cityInfo.adcode) {
        throw new Error('无法获取城市信息');
      }

      console.log(`[天气地图服务] 获取到城市信息:`, cityInfo);

      // 使用城市编码获取天气信息
      const weatherData = await this.getWeatherByCityJS(cityInfo.city);

      // 格式化天气数据
      const formattedData = this.formatJSWeatherData(weatherData);
      console.log(`[天气地图服务] 格式化后的天气数据:`, formattedData);

      // 构造返回数据，格式与原来保持一致
      return {
        lives: [{
          city: cityInfo.city,
          adcode: cityInfo.adcode,
          province: cityInfo.province,
          weather: weatherData.live.weather,
          temperature: weatherData.live.temperature,
          winddirection: weatherData.live.windDirection,
          windpower: weatherData.live.windPower,
          humidity: weatherData.live.humidity,
          reporttime: weatherData.live.reportTime
        }],
        forecasts: [{
          city: cityInfo.city,
          adcode: cityInfo.adcode,
          province: cityInfo.province,
          reporttime: weatherData.forecast.reportTime,
          casts: weatherData.forecast.forecasts.map(item => ({
            date: item.date,
            week: item.week,
            dayweather: item.dayWeather,
            nightweather: item.nightWeather,
            daytemp: item.dayTemp,
            nighttemp: item.nightTemp,
            daywind: item.dayWindDir,
            nightwind: item.nightWindDir,
            daypower: item.dayWindPower,
            nightpower: item.nightWindPower
          }))
        }]
      };
    } catch (error) {
      console.error('[天气地图服务] 获取天气信息失败:', error);
      throw error;
    }
  },

  /**
   * 使用高德地图JavaScript API根据经纬度获取城市信息
   * @param {number} longitude - 经度
   * @param {number} latitude - 纬度
   * @returns {Promise<Object>} - 城市信息
   */
  getCityByLocationJS(longitude, latitude) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[天气地图服务] 使用JavaScript API获取位置(${longitude},${latitude})的城市信息`);

        // 确保AMap已加载
        if (!window.AMap) {
          return reject(new Error('高德地图API未加载'));
        }

        // 创建地理编码实例
        window.AMap.plugin('AMap.Geocoder', () => {
          const geocoder = new window.AMap.Geocoder({
            radius: 1000, // 搜索半径，单位：米
            extensions: 'all' // 返回完整地址信息
          });

          // 逆地理编码
          geocoder.getAddress([longitude, latitude], (status, result) => {
            console.log(`[天气地图服务] 逆地理编码返回:`, status, result);

            if (status === 'complete' && result.info === 'OK') {
              // 确保返回了正确的数据结构
              if (result.regeocode && result.regeocode.addressComponent) {
                const addressComponent = result.regeocode.addressComponent;
                console.log(`[天气地图服务] JavaScript API获取到城市信息:`, addressComponent);

                // 返回城市信息
                resolve({
                  adcode: addressComponent.adcode,
                  citycode: addressComponent.citycode,
                  city: addressComponent.city || addressComponent.district,
                  district: addressComponent.district,
                  province: addressComponent.province,
                  township: addressComponent.township,
                  name: result.regeocode.formattedAddress
                });
              } else {
                console.error('[天气地图服务] 逆地理编码返回数据结构不正确:', result);
                reject(new Error('获取城市信息失败: 返回数据结构不正确'));
              }
            } else {
              console.error('[天气地图服务] 逆地理编码失败:', status, result);
              reject(new Error(`获取城市信息失败: ${result ? result.info : status}`));
            }
          });
        });
      } catch (error) {
        console.error('[天气地图服务] 使用JavaScript API获取城市信息失败:', error);
        reject(error);
      }
    });
  },

  /**
   * 使用高德地图JavaScript API根据城市名称获取天气信息
   * @param {string} city - 城市名称
   * @returns {Promise<Object>} - 天气信息，包含实时天气和天气预报
   */
  getWeatherByCityJS(city) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[天气地图服务] 使用JavaScript API获取城市(${city})的天气信息`);

        // 确保AMap已加载
        if (!window.AMap) {
          return reject(new Error('高德地图API未加载'));
        }

        // 加载天气查询插件
        window.AMap.plugin('AMap.Weather', () => {
          // 创建天气查询实例
          const weather = new window.AMap.Weather();

          // 并行获取实时天气和天气预报
          const livePromise = new Promise((resolveLive, rejectLive) => {
            // 获取实时天气
            weather.getLive(city, (err, data) => {
              if (err) {
                console.error('[天气地图服务] 获取实时天气失败:', err);
                rejectLive(new Error(`获取实时天气失败: ${err}`));
              } else {
                console.log('[天气地图服务] 获取实时天气成功:', data);
                resolveLive(data);
              }
            });
          });

          const forecastPromise = new Promise((resolveForecast, rejectForecast) => {
            // 获取天气预报
            weather.getForecast(city, (err, data) => {
              if (err) {
                console.error('[天气地图服务] 获取天气预报失败:', err);
                rejectForecast(new Error(`获取天气预报失败: ${err}`));
              } else {
                console.log('[天气地图服务] 获取天气预报成功:', data);
                resolveForecast(data);
              }
            });
          });

          // 等待两个请求都完成
          Promise.all([livePromise, forecastPromise])
            .then(([liveData, forecastData]) => {
              resolve({
                live: liveData,
                forecast: forecastData
              });
            })
            .catch(error => {
              reject(error);
            });
        });
      } catch (error) {
        console.error('[天气地图服务] 使用JavaScript API获取天气信息失败:', error);
        reject(error);
      }
    });
  },

  /**
   * 根据城市编码获取天气信息
   * @param {string} adcode - 城市编码
   * @param {string} extensions - 气象类型，可选值：base/all，base:返回实况天气，all:返回预报天气
   * @returns {Promise<Object>} - 天气信息
   */
  async getWeatherByCity(adcode, extensions = 'all') {
    try {
      console.log(`[天气地图服务] 开始获取城市(${adcode})的天气信息，类型:${extensions}`);

      // 调用后端API获取天气信息
      const url = `/api/amap/amap?city=${adcode}&extensions=${extensions}`;
      const response = await get(url);

      console.log(`[天气地图服务] 获取到天气信息:`, response);

      if (!response.success) {
        throw new Error(response.error || '获取天气信息失败');
      }

      return response.data;
    } catch (error) {
      console.error('[天气地图服务] 获取天气信息失败:', error);
      throw error;
    }
  },

  /**
   * 根据经纬度获取城市信息
   * @param {number} longitude - 经度
   * @param {number} latitude - 纬度
   * @returns {Promise<Object>} - 城市信息
   */
  async getCityByLocation(longitude, latitude) {
    try {
      console.log(`[天气地图服务] 开始获取位置(${longitude},${latitude})的城市信息`);

      // 调用高德地图API获取城市信息
      const url = `/api/amap/amap/city?location=${longitude},${latitude}`;
      const response = await get(url);

      console.log(`[天气地图服务] 获取到城市信息:`, response);

      if (!response.success) {
        throw new Error(response.error || '获取城市信息失败');
      }

      // 从高德地图API返回的数据中提取城市信息
      if (response.data && response.data.addressComponent) {
        const addressComponent = response.data.addressComponent;
        return {
          adcode: addressComponent.adcode,
          citycode: addressComponent.citycode,
          city: addressComponent.city || addressComponent.district,
          district: addressComponent.district,
          province: addressComponent.province,
          township: addressComponent.township,
          name: response.data.formatted_address
        };
      }

      throw new Error('未找到城市信息');
    } catch (error) {
      console.error('[天气地图服务] 获取城市信息失败:', error);
      throw error;
    }
  },

  /**
   * 获取天气图标
   * @param {string} weather - 天气描述
   * @returns {string} - 天气图标
   */
  getWeatherIcon(weather) {
    // 根据天气描述返回对应的图标
    const weatherMap = {
      '晴': '☀️',
      '多云': '⛅',
      '阴': '☁️',
      '小雨': '🌧️',
      '中雨': '🌧️',
      '大雨': '🌧️',
      '暴雨': '⛈️',
      '雷阵雨': '⛈️',
      '小雪': '🌨️',
      '中雪': '🌨️',
      '大雪': '🌨️',
      '暴雪': '❄️',
      '雾': '🌫️',
      '霾': '🌫️'
    };

    // 如果天气描述包含特定关键词，返回对应图标
    for (const key in weatherMap) {
      if (weather.includes(key)) {
        return weatherMap[key];
      }
    }

    // 默认返回晴天图标
    return '☀️';
  },

  /**
   * 格式化天气信息
   * @param {Object} weatherData - 天气数据
   * @returns {Object} - 格式化后的天气信息
   */
  formatWeatherData(weatherData) {
    try {
      const result = {
        city: '',
        live: null,
        forecast: []
      };

      // 处理实况天气
      if (weatherData.lives && weatherData.lives.length > 0) {
        const live = weatherData.lives[0];
        result.city = live.city;
        result.live = {
          weather: live.weather,
          temperature: live.temperature,
          winddirection: live.winddirection,
          windpower: live.windpower,
          humidity: live.humidity,
          reporttime: live.reporttime,
          icon: this.getWeatherIcon(live.weather)
        };
      }

      // 处理预报天气
      if (weatherData.forecasts && weatherData.forecasts.length > 0) {
        const forecast = weatherData.forecasts[0];
        result.city = forecast.city;

        if (forecast.casts && forecast.casts.length > 0) {
          result.forecast = forecast.casts.map(cast => ({
            date: cast.date,
            week: cast.week,
            dayweather: cast.dayweather,
            nightweather: cast.nightweather,
            daytemp: cast.daytemp,
            nighttemp: cast.nighttemp,
            daywind: cast.daywind,
            nightwind: cast.nightwind,
            daypower: cast.daypower,
            nightpower: cast.nightpower,
            dayicon: this.getWeatherIcon(cast.dayweather),
            nighticon: this.getWeatherIcon(cast.nightweather)
          }));
        }
      }

      return result;
    } catch (error) {
      console.error('[天气地图服务] 格式化天气数据失败:', error);
      throw error;
    }
  },

  /**
   * 格式化高德地图JavaScript API返回的天气信息
   * @param {Object} weatherData - 天气数据，包含live和forecast两部分
   * @returns {Object} - 格式化后的天气信息
   */
  formatJSWeatherData(weatherData) {
    try {
      const result = {
        city: '',
        live: null,
        forecast: []
      };

      // 处理实时天气
      if (weatherData.live) {
        const live = weatherData.live;
        result.city = live.city;
        result.live = {
          weather: live.weather,
          temperature: live.temperature,
          winddirection: live.windDirection,
          windpower: live.windPower,
          humidity: live.humidity,
          reporttime: live.reportTime,
          icon: this.getWeatherIcon(live.weather)
        };
      }

      // 处理天气预报
      if (weatherData.forecast && weatherData.forecast.forecasts) {
        result.city = weatherData.forecast.city || result.city;

        result.forecast = weatherData.forecast.forecasts.map(cast => ({
          date: cast.date,
          week: cast.week,
          dayweather: cast.dayWeather,
          nightweather: cast.nightWeather,
          daytemp: cast.dayTemp,
          nighttemp: cast.nightTemp,
          daywind: cast.dayWindDir,
          nightwind: cast.nightWindDir,
          daypower: cast.dayWindPower,
          nightpower: cast.nightWindPower,
          dayicon: this.getWeatherIcon(cast.dayWeather),
          nighticon: this.getWeatherIcon(cast.nightWeather)
        }));
      }

      return result;
    } catch (error) {
      console.error('[天气地图服务] 格式化JavaScript API天气数据失败:', error);
      throw error;
    }
  }
};

export default weatherMapService;
