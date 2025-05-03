<template>
  <div class="map-container">
    <h1>地图</h1>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>地图加载中...</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="hasError" class="error-message">
      <p>{{ errorMessage }}</p>
      <button @click="initializeMap" class="retry-button">重试</button>
    </div>

    <!-- 地图容器 -->
    <div id="map-container" class="map-view" ref="mapContainer"></div>

    <!-- 功能按钮 -->
    <div class="map-controls">
      <button @click="locateMe" class="control-button">
        <span class="material-icons">my_location</span>
        定位
      </button>
      <button @click="toggleWeatherMode" class="control-button" :class="{ 'active': weatherModeActive }">
        <span class="material-icons">wb_sunny</span>
        天气查询
      </button>
    </div>

    <!-- 天气信息弹窗 -->
    <WeatherPopup
      :visible="showWeatherPopup"
      :weatherData="weatherData"
      :loading="isWeatherLoading"
      :error="weatherError"
      @close="closeWeatherPopup"
      @retry="retryWeatherFetch"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import mapService from '@/services/mapService';
import weatherMapService from '@/services/weatherMapService';
import WeatherPopup from '@/components/WeatherPopup.vue';

export default {
  name: 'MapView',
  components: {
    WeatherPopup
  },
  setup() {
    // 状态变量
    const mapContainer = ref(null);
    const map = ref(null);
    const isLoading = ref(false);
    const errorMessage = ref('');
    const hasError = computed(() => errorMessage.value !== '');

    // 天气相关状态
    const weatherModeActive = ref(false);
    const showWeatherPopup = ref(false);
    const isWeatherLoading = ref(false);
    const weatherError = ref('');
    const weatherData = ref({});
    const clickListener = ref(null);
    const clickMarker = ref(null);

    // 初始化地图
    const initializeMap = async () => {
      try {
        isLoading.value = true;
        errorMessage.value = '';

        console.log('[地图] 开始初始化地图');

        // 等待DOM元素渲染完成
        await new Promise(resolve => setTimeout(resolve, 100));

        // 初始化地图
        map.value = await mapService.initMap('map-container', {
          zoom: 15,
          viewMode: '3D'
        });

        console.log('[地图] 地图初始化成功');

        // 自动定位
        await locateMe();

        isLoading.value = false;
      } catch (error) {
        console.error('[地图] 初始化地图失败:', error);
        errorMessage.value = `初始化地图失败: ${error.message}`;
        isLoading.value = false;
      }
    };

    // 定位功能
    const locateMe = async () => {
      try {
        if (!map.value) {
          console.warn('[地图] 地图未初始化，无法定位');
          return;
        }

        isLoading.value = true;
        console.log('[地图] 开始定位');

        // 使用高德地图API定位
        await mapService.getPositionByAMap(map.value);

        isLoading.value = false;
      } catch (error) {
        console.error('[地图] 定位失败:', error);
        errorMessage.value = `定位失败: ${error.message}`;
        isLoading.value = false;
      }
    };

    // 组件挂载时初始化地图
    onMounted(() => {
      console.log('[地图] 组件已挂载');
      initializeMap();
    });

    // 切换天气模式
    const toggleWeatherMode = () => {
      weatherModeActive.value = !weatherModeActive.value;
      console.log(`[地图] 天气模式 ${weatherModeActive.value ? '开启' : '关闭'}`);

      // 如果关闭天气模式，移除点击监听器和标记
      if (!weatherModeActive.value) {
        removeMapClickListener();
        removeClickMarker();
        return;
      }

      // 添加点击监听器
      addMapClickListener();
    };

    // 添加地图点击监听器
    const addMapClickListener = () => {
      if (!map.value) return;

      // 移除现有的监听器
      removeMapClickListener();

      // 添加新的监听器
      clickListener.value = map.value.on('click', handleMapClick);
      console.log('[地图] 已添加地图点击监听器');
    };

    // 移除地图点击监听器
    const removeMapClickListener = () => {
      if (clickListener.value) {
        map.value.off('click', clickListener.value);
        clickListener.value = null;
        console.log('[地图] 已移除地图点击监听器');
      }
    };

    // 处理地图点击事件
    const handleMapClick = async (e) => {
      try {
        console.log('[地图] 地图点击事件:', e);

        // 获取点击位置的经纬度
        const lnglat = e.lnglat;
        const longitude = lnglat.getLng();
        const latitude = lnglat.getLat();

        console.log(`[地图] 点击位置: 经度=${longitude}, 纬度=${latitude}`);

        // 添加标记
        addClickMarker(longitude, latitude);

        // 获取天气信息
        await fetchWeatherByLocation(longitude, latitude);
      } catch (error) {
        console.error('[地图] 处理地图点击事件失败:', error);
        weatherError.value = `获取天气信息失败: ${error.message}`;
      }
    };

    // 添加点击位置标记
    const addClickMarker = (longitude, latitude) => {
      // 移除现有的标记
      removeClickMarker();

      // 创建新的标记
      // @ts-ignore
      clickMarker.value = new window.AMap.Marker({
        position: [longitude, latitude],
        title: '点击位置',
        icon: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png'
      });

      // 将标记添加到地图
      map.value.add(clickMarker.value);
      console.log('[地图] 已添加点击位置标记');
    };

    // 移除点击位置标记
    const removeClickMarker = () => {
      if (clickMarker.value) {
        map.value.remove(clickMarker.value);
        clickMarker.value = null;
        console.log('[地图] 已移除点击位置标记');
      }
    };

    // 根据经纬度获取天气信息
    const fetchWeatherByLocation = async (longitude, latitude) => {
      try {
        // 显示加载状态
        isWeatherLoading.value = true;
        weatherError.value = '';
        showWeatherPopup.value = true;

        console.log(`[地图] 开始获取位置(${longitude},${latitude})的天气信息`);

        // 获取天气信息
        const result = await weatherMapService.getWeatherByLocation(longitude, latitude);
        console.log('[地图] 获取天气信息成功:', result);

        // 格式化天气数据
        weatherData.value = weatherMapService.formatWeatherData(result);
        console.log('[地图] 格式化后的天气数据:', weatherData.value);

        // 清除加载状态
        isWeatherLoading.value = false;
      } catch (error) {
        console.error('[地图] 获取天气信息失败:', error);
        weatherError.value = `获取天气信息失败: ${error.message}`;
        isWeatherLoading.value = false;
      }
    };

    // 关闭天气弹窗
    const closeWeatherPopup = () => {
      showWeatherPopup.value = false;
      console.log('[地图] 关闭天气弹窗');
    };

    // 重试获取天气信息
    const retryWeatherFetch = () => {
      if (!clickMarker.value) return;

      const position = clickMarker.value.getPosition();
      const longitude = position.getLng();
      const latitude = position.getLat();

      console.log(`[地图] 重试获取位置(${longitude},${latitude})的天气信息`);
      fetchWeatherByLocation(longitude, latitude);
    };

    // 组件卸载时清理资源
    onUnmounted(() => {
      console.log('[地图] 组件已卸载');

      // 移除点击监听器和标记
      removeMapClickListener();
      removeClickMarker();

      // 销毁地图
      if (map.value) {
        map.value.destroy();
        map.value = null;
      }
    });

    return {
      mapContainer,
      isLoading,
      errorMessage,
      hasError,
      initializeMap,
      locateMe,

      // 天气相关
      weatherModeActive,
      showWeatherPopup,
      isWeatherLoading,
      weatherError,
      weatherData,
      toggleWeatherMode,
      closeWeatherPopup,
      retryWeatherFetch
    };
  }
};
</script>

<style lang="scss" scoped>
.map-container {
  padding: var(--spacing-lg) var(--spacing-md);
  display: flex;
  flex-direction: column;
  height: 100%;

  h1 {
    text-align: center;
    margin-bottom: var(--spacing-lg);
    color: #333;
    font-size: var(--font-size-xxl);
  }

  .map-view {
    flex: 1;
    min-height: 400px;
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: var(--spacing-lg);
  }

  .loading-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 10;
    background-color: rgba(255, 255, 255, 0.8);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-md);

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: var(--primary-color);
      animation: spin 1s ease-in-out infinite;
      margin-bottom: var(--spacing-md);
    }

    p {
      color: #333;
      font-size: var(--font-size-md);
    }
  }

  .error-message {
    background-color: #ffebee;
    color: #d32f2f;
    padding: var(--spacing-md);
    border-radius: var(--border-radius-md);
    margin-bottom: var(--spacing-lg);
    text-align: center;

    p {
      margin-bottom: var(--spacing-sm);
    }

    .retry-button {
      background-color: #d32f2f;
      color: white;
      border: none;
      padding: var(--spacing-xs) var(--spacing-md);
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      font-size: var(--font-size-sm);

      &:hover {
        background-color: #b71c1c;
      }
    }
  }

  .map-controls {
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);

    .control-button {
      display: flex;
      align-items: center;
      background-color: var(--primary-color);
      color: white;
      border: none;
      padding: var(--spacing-sm) var(--spacing-lg);
      border-radius: var(--border-radius-md);
      cursor: pointer;
      font-size: var(--font-size-md);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

      .material-icons {
        margin-right: var(--spacing-xs);
      }

      &:hover {
        background-color: var(--primary-color-dark);
      }

      &.active {
        background-color: #2c8a00;

        &:hover {
          background-color: #236e00;
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

/* 适配移动设备 */
@media screen and (max-width: 768px) {
  .map-container {
    padding: var(--spacing-md) var(--spacing-sm);

    h1 {
      font-size: var(--font-size-xl);
      margin-bottom: var(--spacing-md);
    }

    .map-view {
      min-height: 300px;
    }
  }
}
</style>
