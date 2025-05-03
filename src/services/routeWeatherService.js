// src/services/routeWeatherService.js
import weatherMapService from './weatherMapService';

/**
 * 路线天气服务
 */
const routeWeatherService = {
  /**
   * 获取路线上的采样点
   * @param {Array} path - 路线路径点数组
   * @param {number} distance - 路线距离（米）
   * @returns {Array} - 采样点数组
   */
  getSamplePoints(path, distance = 0) {
    if (!path || path.length === 0) {
      return [];
    }

    // 根据路线距离确定采样点数量
    // 基本规则：
    // - 小于5公里：3个点（起点、中点、终点）
    // - 5-20公里：5个点
    // - 20-50公里：7个点
    // - 50-100公里：9个点
    // - 100公里以上：11个点
    let sampleCount = 3; // 默认最少3个点

    if (distance >= 5000 && distance < 20000) {
      sampleCount = 5;
    } else if (distance >= 20000 && distance < 50000) {
      sampleCount = 7;
    } else if (distance >= 50000 && distance < 100000) {
      sampleCount = 9;
    } else if (distance >= 100000) {
      sampleCount = 11;
    }

    console.log(`[路线天气服务] 路线距离: ${distance}米, 采样点数量: ${sampleCount}`);

    // 如果路径点少于采样点数量，则返回所有路径点
    if (path.length <= sampleCount) {
      return path.map((point, index) => {
        if (index === 0) {
          return {
            longitude: point.lng,
            latitude: point.lat,
            name: '起点'
          };
        } else if (index === path.length - 1) {
          return {
            longitude: point.lng,
            latitude: point.lat,
            name: '终点'
          };
        } else {
          return {
            longitude: point.lng,
            latitude: point.lat,
            name: `途经点 ${index}`
          };
        }
      });
    }

    // 计算采样间隔
    const interval = Math.floor(path.length / (sampleCount - 1));

    // 获取采样点
    const samplePoints = [];

    // 起点
    samplePoints.push({
      longitude: path[0].lng,
      latitude: path[0].lat,
      name: '起点'
    });

    // 中间点
    for (let i = 1; i < sampleCount - 1; i++) {
      const index = i * interval;
      samplePoints.push({
        longitude: path[index].lng,
        latitude: path[index].lat,
        name: `途经点 ${i}`
      });
    }

    // 终点
    samplePoints.push({
      longitude: path[path.length - 1].lng,
      latitude: path[path.length - 1].lat,
      name: '终点'
    });

    return samplePoints;
  },

  /**
   * 获取路线上的天气信息
   * @param {Array} samplePoints - 采样点数组
   * @returns {Promise<Array>} - 带有天气信息的采样点数组
   */
  async getRouteWeather(samplePoints) {
    if (!samplePoints || samplePoints.length === 0) {
      return [];
    }

    console.log(`[路线天气服务] 开始获取${samplePoints.length}个采样点的天气信息`);

    // 并行获取所有采样点的天气信息
    const weatherPromises = samplePoints.map(async (point) => {
      try {
        // 获取天气信息
        const weatherData = await weatherMapService.getWeatherByLocation(
          point.longitude,
          point.latitude
        );

        // 格式化天气数据
        const formattedData = weatherMapService.formatWeatherData(weatherData);

        // 返回带有天气信息的采样点
        return {
          ...point,
          weather: formattedData.live
        };
      } catch (error) {
        console.error(`[路线天气服务] 获取采样点(${point.longitude},${point.latitude})的天气信息失败:`, error);
        return {
          ...point,
          weather: null
        };
      }
    });

    // 等待所有天气信息获取完成
    const pointsWithWeather = await Promise.all(weatherPromises);

    console.log(`[路线天气服务] 获取路线天气信息成功:`, pointsWithWeather);

    return pointsWithWeather;
  },

  /**
   * 检查路线上是否有雨
   * @param {Array} pointsWithWeather - 带有天气信息的采样点数组
   * @returns {boolean} - 是否有雨
   */
  hasRainOnRoute(pointsWithWeather) {
    if (!pointsWithWeather || pointsWithWeather.length === 0) {
      return false;
    }

    // 检查是否有任何点的天气包含雨
    return pointsWithWeather.some(point => {
      if (!point.weather || !point.weather.weather) {
        return false;
      }

      const weather = point.weather.weather;
      return weather.includes('雨') || weather.includes('阵雨') || weather.includes('雷雨');
    });
  }
};

export default routeWeatherService;
