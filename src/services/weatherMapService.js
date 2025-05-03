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
      
      // 先通过经纬度获取城市信息
      const cityInfo = await this.getCityByLocation(longitude, latitude);
      if (!cityInfo || !cityInfo.adcode) {
        throw new Error('无法获取城市信息');
      }
      
      console.log(`[天气地图服务] 获取到城市信息:`, cityInfo);
      
      // 使用城市编码获取天气信息
      return await this.getWeatherByCity(cityInfo.adcode);
    } catch (error) {
      console.error('[天气地图服务] 获取天气信息失败:', error);
      throw error;
    }
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
      const url = `/api/weather/amap?city=${adcode}&extensions=${extensions}`;
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
      
      // 调用后端API获取城市信息
      const url = `/api/weather/city?location=${longitude},${latitude}`;
      const response = await get(url);
      
      console.log(`[天气地图服务] 获取到城市信息:`, response);
      
      if (!response.success) {
        throw new Error(response.error || '获取城市信息失败');
      }
      
      // 返回第一个城市信息
      if (response.data && response.data.districts && response.data.districts.length > 0) {
        return response.data.districts[0];
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
  }
};

export default weatherMapService;
