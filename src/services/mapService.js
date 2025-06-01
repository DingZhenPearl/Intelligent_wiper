// src/services/mapService.js
import { ref } from 'vue';
import * as locationService from '../utils/locationService';
import IPLocation from '../utils/ipLocation';

// 地图状态
const mapStatus = ref({
  isLoading: false,
  error: null,
  map: null,
  position: null
});

// 高德地图API密钥和安全密钥
const AMAP_SECURITY_CODE = '8a5a7b681de99d4799c0042c6a3837fe';

/**
 * 地图服务
 */
const mapService = {
  // 状态
  status: mapStatus,

  /**
   * 获取当前位置
   * @param {Object} options - 定位选项
   * @returns {Promise<Object>} - 位置信息
   */
  async getCurrentPosition(options = {}) {
    try {
      console.log('[地图服务] 开始获取当前位置');

      // 使用locationService获取当前位置，与其他页面保持一致
      const positionResult = await locationService.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        ...options
      });

      console.log('[地图服务] locationService返回结果:', positionResult);

      // 检查返回结果格式
      if (!positionResult) {
        throw new Error('定位服务返回空结果');
      }

      let position;
      if (positionResult.success) {
        // locationService返回的格式
        position = {
          coords: {
            latitude: positionResult.coords.latitude,
            longitude: positionResult.coords.longitude,
            accuracy: positionResult.coords.accuracy,
            altitude: positionResult.coords.altitude,
            heading: positionResult.coords.heading,
            speed: positionResult.coords.speed
          },
          timestamp: positionResult.timestamp,
          source: positionResult.source || 'unknown'
        };
      } else {
        // 如果定位失败，抛出错误
        throw new Error(positionResult.error || '定位失败');
      }

      console.log('[地图服务] 格式化后的位置信息:', position);

      // 保存位置信息
      this.status.value.position = position;

      return position;
    } catch (error) {
      console.error('[地图服务] 获取当前位置失败:', error);
      this.status.value.error = `获取位置失败: ${error.message}`;
      throw error;
    }
  },

  /**
   * 初始化地图
   * @param {string} containerId - 地图容器ID
   * @param {Object} options - 地图选项
   * @returns {Promise<Object>} - 地图实例
   */
  async initMap(containerId, options = {}) {
    try {
      console.log('[地图服务] 开始初始化地图');
      this.status.value.isLoading = true;
      this.status.value.error = null;

      // 确保AMap已加载
      if (!window.AMap) {
        throw new Error('高德地图API未加载');
      }

      // 设置安全密钥
      window._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_CODE
      };

      // 默认选项
      const defaultOptions = {
        zoom: 15,
        viewMode: '3D',
        pitch: 0,
        resizeEnable: true
      };

      // 合并选项
      const mapOptions = { ...defaultOptions, ...options };

      // 创建地图实例
      const map = new window.AMap.Map(containerId, mapOptions);
      console.log('[地图服务] 地图初始化成功');

      // 保存地图实例
      this.status.value.map = map;
      this.status.value.isLoading = false;

      return map;
    } catch (error) {
      console.error('[地图服务] 初始化地图失败:', error);
      this.status.value.error = `初始化地图失败: ${error.message}`;
      this.status.value.isLoading = false;
      throw error;
    }
  },

  /**
   * 获取当前位置并在地图上标记
   * @param {Object} map - 地图实例
   * @returns {Promise<Object>} - 位置信息
   */
  async locateAndMark(map) {
    try {
      console.log('[地图服务] 开始获取当前位置');

      // 获取当前位置
      let position;

      try {
        // 尝试使用设备定位
        position = await locationService.getCurrentPosition();
        console.log('[地图服务] 设备定位成功:', position);
      } catch (error) {
        console.warn('[地图服务] 设备定位失败，尝试使用IP定位:', error);

        // 尝试使用IP定位
        position = await IPLocation.getIPLocation();
        console.log('[地图服务] IP定位成功:', position);
      }

      if (!position || !position.coords) {
        throw new Error('无法获取位置信息');
      }

      // 保存位置信息
      this.status.value.position = position;

      // 创建标记
      const marker = new window.AMap.Marker({
        position: [position.coords.longitude, position.coords.latitude],
        title: '我的位置'
      });

      // 将标记添加到地图
      map.add(marker);

      // 设置地图中心点
      map.setCenter([position.coords.longitude, position.coords.latitude]);

      console.log('[地图服务] 位置标记成功');

      return position;
    } catch (error) {
      console.error('[地图服务] 获取位置失败:', error);
      this.status.value.error = `获取位置失败: ${error.message}`;
      throw error;
    }
  },

  /**
   * 使用高德地图API进行定位（已弃用）
   * @deprecated 使用getCurrentPosition方法替代，该方法使用统一的定位服务
   * @param {Object} map - 地图实例（已弃用，不再使用）
   * @returns {Promise<Object>} - 位置信息
   */
  // eslint-disable-next-line no-unused-vars
  getPositionByAMap(map) {
    console.warn('[地图服务] getPositionByAMap方法已弃用，请使用getCurrentPosition方法');
    return this.getCurrentPosition();
  }
};

export default mapService;
