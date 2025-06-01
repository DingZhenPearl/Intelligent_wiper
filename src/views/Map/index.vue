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

    <!-- 搜索框 -->
    <div class="search-box-container">
      <SearchBox
        v-if="map"
        :map="map"
        @select="handleSearchSelect"
        @clear="handleSearchClear"
      />
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
      <button @click="toggleNavigationMode" class="control-button" :class="{ 'active': navigationModeActive }">
        <span class="material-icons">directions</span>
        导航
      </button>
    </div>

    <!-- 导航面板 -->
    <div v-if="navigationModeActive" class="navigation-panel">
      <div class="panel-header">
        <h3>路线规划</h3>
        <button class="close-button" @click="toggleNavigationMode">×</button>
      </div>
      <div class="panel-content">
        <!-- 起点搜索框 -->
        <div class="input-group">
          <span class="material-icons">location_on</span>
          <div class="search-input-wrapper">
            <input
              type="text"
              v-model="startSearchText"
              placeholder="起点"
              @input="handleStartSearch"
              @focus="startSearchFocused = true"
              @blur="handleStartBlur"
            />
            <div class="search-results" v-if="startSearchFocused && startSearchResults.length > 0">
              <div
                v-for="(item, index) in startSearchResults"
                :key="`start-${index}`"
                class="search-result-item"
                @click="selectStartSearchResult(item)"
              >
                <span class="material-icons">place</span>
                <div class="result-info">
                  <div class="result-name">{{ item.name }}</div>
                  <div class="result-address">{{ item.address }}</div>
                </div>
              </div>
            </div>
          </div>
          <button class="action-button" @click="useCurrentLocationAsStart" title="使用当前位置">
            <span class="material-icons">my_location</span>
          </button>
        </div>

        <!-- 终点搜索框 -->
        <div class="input-group">
          <span class="material-icons">flag</span>
          <div class="search-input-wrapper">
            <input
              type="text"
              v-model="endSearchText"
              placeholder="终点"
              @input="handleEndSearch"
              @focus="endSearchFocused = true"
              @blur="handleEndBlur"
            />
            <div class="search-results" v-if="endSearchFocused && endSearchResults.length > 0">
              <div
                v-for="(item, index) in endSearchResults"
                :key="`end-${index}`"
                class="search-result-item"
                @click="selectEndSearchResult(item)"
              >
                <span class="material-icons">place</span>
                <div class="result-info">
                  <div class="result-name">{{ item.name }}</div>
                  <div class="result-address">{{ item.address }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 按钮组 -->
        <div class="button-group">
          <button
            class="plan-button"
            @click="planRoute"
            :disabled="!canPlanRoute"
          >
            <span class="material-icons">directions</span>
            规划路线
          </button>
          <button class="clear-button" @click="clearRoute">
            <span class="material-icons">clear</span>
            清除
          </button>
        </div>

        <!-- 路线信息 -->
        <div class="route-info" v-if="routeInfo">
          <div class="info-item">
            <span class="material-icons">schedule</span>
            <span>{{ routeInfo.time }}</span>
          </div>
          <div class="info-item">
            <span class="material-icons">straighten</span>
            <span>{{ routeInfo.distance }}</span>
          </div>
          <button class="check-weather-button" @click="checkRouteWeather">
            <span class="material-icons">cloud</span>
            检查路线天气
          </button>
        </div>
      </div>
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

    <!-- 路线天气弹窗 -->
    <RouteWeatherPopup
      :visible="showRouteWeatherPopup"
      :routePoints="routeWeatherPoints"
      :loading="isRouteWeatherLoading"
      :error="routeWeatherError"
      @close="closeRouteWeatherPopup"
      @retry="checkRouteWeather"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import mapService from '@/services/mapService';
import weatherMapService from '@/services/weatherMapService';
import routeWeatherService from '@/services/routeWeatherService';
import WeatherPopup from '@/components/WeatherPopup.vue';
import RouteWeatherPopup from '@/components/RouteWeatherPopup.vue';
import SearchBox from '@/components/SearchBox.vue';

export default {
  name: 'MapView',
  components: {
    WeatherPopup,
    RouteWeatherPopup,
    SearchBox
  },
  setup() {
    // 状态变量
    const mapContainer = ref(null);
    const map = ref(null);
    const isLoading = ref(false);
    const errorMessage = ref('');
    const hasError = computed(() => errorMessage.value !== '');
    const currentLocationMarker = ref(null); // 当前位置标记

    // 天气相关状态
    const weatherModeActive = ref(false);
    const showWeatherPopup = ref(false);
    const isWeatherLoading = ref(false);
    const weatherError = ref('');
    const weatherData = ref({});
    const clickListener = ref(null);
    const clickMarker = ref(null);

    // 导航相关状态
    const navigationModeActive = ref(false);
    const startPoint = ref({ name: '', location: null });
    const endPoint = ref({ name: '', location: null });
    const selectingPoint = ref(''); // 'start' 或 'end'
    const drivingInstance = ref(null);
    const routePath = ref([]);
    const routeInfo = ref(null);

    // 起点搜索相关状态
    const startSearchText = ref('');
    const startSearchResults = ref([]);
    const startSearchFocused = ref(false);
    const autoCompleteStart = ref(null);

    // 终点搜索相关状态
    const endSearchText = ref('');
    const endSearchResults = ref([]);
    const endSearchFocused = ref(false);
    const autoCompleteEnd = ref(null);

    // 路线天气相关状态
    const showRouteWeatherPopup = ref(false);
    const isRouteWeatherLoading = ref(false);
    const routeWeatherError = ref('');
    const routeWeatherPoints = ref([]);

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

        // 不再自动定位，让用户手动触发定位
        // 这样可以避免权限问题，并与其他页面的行为保持一致
        console.log('[地图] 地图初始化完成，等待用户手动定位');

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
        errorMessage.value = ''; // 清除之前的错误信息
        console.log('[地图] 开始定位');

        // 使用统一的定位服务，与其他页面保持一致
        const position = await mapService.getCurrentPosition();
        console.log('[地图] 定位成功:', position);

        // 确保位置信息存在
        if (!position || !position.coords) {
          throw new Error('无法获取位置信息');
        }

        // 移除之前的当前位置标记
        if (currentLocationMarker.value) {
          map.value.remove(currentLocationMarker.value);
          currentLocationMarker.value = null;
        }

        // 在地图上标记当前位置
        const longitude = position.coords.longitude;
        const latitude = position.coords.latitude;

        // 创建标记
        currentLocationMarker.value = new window.AMap.Marker({
          position: [longitude, latitude],
          title: `我的位置 (精度: ${position.coords.accuracy ? Math.round(position.coords.accuracy) + 'm' : '未知'})`,
          icon: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
          animation: 'AMAP_ANIMATION_DROP'
        });

        // 将标记添加到地图
        map.value.add(currentLocationMarker.value);

        // 设置地图中心点并调整缩放级别
        map.value.setCenter([longitude, latitude]);
        map.value.setZoom(16); // 设置合适的缩放级别

        console.log('[地图] 定位和标记成功');
        console.log(`[地图] 位置信息: 经度=${longitude}, 纬度=${latitude}, 精度=${position.coords.accuracy}m, 来源=${position.source}`);

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

      // 初始化自动完成插件
      setTimeout(() => {
        initAutoComplete();
      }, 1000); // 延迟初始化，确保地图API已加载
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

    // 处理搜索结果选择
    const handleSearchSelect = (item) => {
      console.log('[地图] 搜索结果选择:', item);

      // 确保位置信息存在
      if (!item.location) {
        console.error('[地图] 搜索结果没有位置信息:', item);
        return;
      }

      // 如果正在选择起点或终点，则设置相应的点
      if (selectingPoint.value === 'start') {
        startPoint.value = {
          name: item.name,
          location: {
            lng: parseFloat(item.location.lng),
            lat: parseFloat(item.location.lat)
          }
        };
        console.log('[地图] 设置起点:', startPoint.value);
        selectingPoint.value = '';
      } else if (selectingPoint.value === 'end') {
        endPoint.value = {
          name: item.name,
          location: {
            lng: parseFloat(item.location.lng),
            lat: parseFloat(item.location.lat)
          }
        };
        console.log('[地图] 设置终点:', endPoint.value);
        selectingPoint.value = '';
      }
    };

    // 初始化自动完成插件
    const initAutoComplete = () => {
      if (!window.AMap) {
        console.error('[地图] 高德地图API未加载');
        return;
      }

      // 初始化起点自动完成插件
      if (!autoCompleteStart.value) {
        window.AMap.plugin('AMap.AutoComplete', () => {
          autoCompleteStart.value = new window.AMap.AutoComplete({
            city: '全国'
          });
          console.log('[地图] 起点自动完成插件初始化成功');
        });
      }

      // 初始化终点自动完成插件
      if (!autoCompleteEnd.value) {
        window.AMap.plugin('AMap.AutoComplete', () => {
          autoCompleteEnd.value = new window.AMap.AutoComplete({
            city: '全国'
          });
          console.log('[地图] 终点自动完成插件初始化成功');
        });
      }
    };

    // 处理起点搜索
    const handleStartSearch = () => {
      if (!autoCompleteStart.value || !startSearchText.value.trim()) {
        startSearchResults.value = [];
        return;
      }

      autoCompleteStart.value.search(startSearchText.value, (status, result) => {
        if (status === 'complete' && result.tips) {
          startSearchResults.value = result.tips.map(tip => ({
            name: tip.name,
            address: tip.district,
            location: tip.location,
            id: tip.id
          }));
          console.log('[地图] 起点搜索结果:', startSearchResults.value);
        } else {
          startSearchResults.value = [];
        }
      });
    };

    // 处理终点搜索
    const handleEndSearch = () => {
      if (!autoCompleteEnd.value || !endSearchText.value.trim()) {
        endSearchResults.value = [];
        return;
      }

      autoCompleteEnd.value.search(endSearchText.value, (status, result) => {
        if (status === 'complete' && result.tips) {
          endSearchResults.value = result.tips.map(tip => ({
            name: tip.name,
            address: tip.district,
            location: tip.location,
            id: tip.id
          }));
          console.log('[地图] 终点搜索结果:', endSearchResults.value);
        } else {
          endSearchResults.value = [];
        }
      });
    };

    // 选择起点搜索结果
    const selectStartSearchResult = (item) => {
      console.log('[地图] 选择起点搜索结果:', item);

      // 确保位置信息存在
      if (!item.location) {
        console.error('[地图] 搜索结果没有位置信息:', item);
        return;
      }

      // 设置起点
      startPoint.value = {
        name: item.name,
        location: {
          lng: parseFloat(item.location.lng),
          lat: parseFloat(item.location.lat)
        }
      };

      // 更新搜索框文本
      startSearchText.value = item.name;

      // 隐藏搜索结果
      startSearchResults.value = [];
      startSearchFocused.value = false;

      // 在地图上标记起点
      if (map.value) {
        // 清除之前的标记
        clearRoute();

        // 移动地图到起点
        map.value.setCenter([item.location.lng, item.location.lat]);

        // 添加标记
        const marker = new window.AMap.Marker({
          position: [item.location.lng, item.location.lat],
          title: '起点: ' + item.name,
          animation: 'AMAP_ANIMATION_DROP',
          icon: 'https://webapi.amap.com/theme/v1.3/markers/n/start.png'
        });

        // 添加到地图
        map.value.add(marker);
      }
    };

    // 选择终点搜索结果
    const selectEndSearchResult = (item) => {
      console.log('[地图] 选择终点搜索结果:', item);

      // 确保位置信息存在
      if (!item.location) {
        console.error('[地图] 搜索结果没有位置信息:', item);
        return;
      }

      // 设置终点
      endPoint.value = {
        name: item.name,
        location: {
          lng: parseFloat(item.location.lng),
          lat: parseFloat(item.location.lat)
        }
      };

      // 更新搜索框文本
      endSearchText.value = item.name;

      // 隐藏搜索结果
      endSearchResults.value = [];
      endSearchFocused.value = false;

      // 在地图上标记终点
      if (map.value) {
        // 移动地图到终点
        map.value.setCenter([item.location.lng, item.location.lat]);

        // 添加标记
        const marker = new window.AMap.Marker({
          position: [item.location.lng, item.location.lat],
          title: '终点: ' + item.name,
          animation: 'AMAP_ANIMATION_DROP',
          icon: 'https://webapi.amap.com/theme/v1.3/markers/n/end.png'
        });

        // 添加到地图
        map.value.add(marker);
      }
    };

    // 处理起点搜索框失焦
    const handleStartBlur = () => {
      // 延迟隐藏结果，以便点击结果项
      setTimeout(() => {
        startSearchFocused.value = false;
      }, 200);
    };

    // 处理终点搜索框失焦
    const handleEndBlur = () => {
      // 延迟隐藏结果，以便点击结果项
      setTimeout(() => {
        endSearchFocused.value = false;
      }, 200);
    };

    // 处理搜索清除
    const handleSearchClear = () => {
      console.log('[地图] 搜索清除');

      // 清除地图上的标记
      if (map.value) {
        map.value.clearMap();
      }
    };

    // 切换导航模式
    const toggleNavigationMode = () => {
      navigationModeActive.value = !navigationModeActive.value;
      console.log(`[地图] 导航模式 ${navigationModeActive.value ? '开启' : '关闭'}`);

      // 如果关闭导航模式，清除路线
      if (!navigationModeActive.value) {
        clearRoute();
      } else {
        // 关闭天气模式
        weatherModeActive.value = false;
        removeMapClickListener();
      }
    };

    // 选择起点
    const selectStartPoint = () => {
      console.log('[地图] 选择起点');
      selectingPoint.value = 'start';
    };

    // 选择终点
    const selectEndPoint = () => {
      console.log('[地图] 选择终点');
      selectingPoint.value = 'end';
    };

    // 使用当前位置作为起点
    const useCurrentLocationAsStart = async () => {
      try {
        console.log('[地图] 使用当前位置作为起点');

        // 获取当前位置
        const position = await mapService.getCurrentPosition();
        console.log('[地图] 获取到当前位置:', position);

        // 确保位置信息存在
        if (!position || !position.coords) {
          throw new Error('无法获取位置信息');
        }

        const longitude = position.coords.longitude;
        const latitude = position.coords.latitude;

        // 设置起点
        startPoint.value = {
          name: '我的位置',
          location: {
            lng: longitude,
            lat: latitude
          }
        };

        console.log('[地图] 设置起点为我的位置:', startPoint.value);

        // 更新搜索框文本
        startSearchText.value = '我的位置';

        // 在地图上标记起点
        if (map.value) {
          map.value.setCenter([longitude, latitude]);

          // 添加标记
          const marker = new window.AMap.Marker({
            position: [longitude, latitude],
            title: '我的位置',
            animation: 'AMAP_ANIMATION_DROP'
          });

          // 添加到地图
          map.value.add(marker);
        }
      } catch (error) {
        console.error('[地图] 获取当前位置失败:', error);
        errorMessage.value = `获取当前位置失败: ${error.message}`;
      }
    };

    // 计算是否可以规划路线
    const canPlanRoute = computed(() => {
      return startPoint.value.location && endPoint.value.location;
    });

    // 规划路线
    const planRoute = () => {
      if (!canPlanRoute.value) {
        console.warn('[地图] 无法规划路线: 起点或终点未设置');
        return;
      }

      console.log('[地图] 开始规划路线');
      console.log('[地图] 起点:', startPoint.value);
      console.log('[地图] 终点:', endPoint.value);

      // 清除之前的路线
      clearRoute();

      try {
        // 创建起点和终点
        const startLngLat = new window.AMap.LngLat(
          startPoint.value.location.lng,
          startPoint.value.location.lat
        );

        const endLngLat = new window.AMap.LngLat(
          endPoint.value.location.lng,
          endPoint.value.location.lat
        );

        console.log('[地图] 起点LngLat:', startLngLat);
        console.log('[地图] 终点LngLat:', endLngLat);

        // 创建驾车规划实例
        if (drivingInstance.value) {
          drivingInstance.value.clear();
        }

        // @ts-ignore
        drivingInstance.value = new window.AMap.Driving({
          map: map.value,
          panel: false,
          policy: window.AMap.DrivingPolicy.LEAST_TIME,
          autoFitView: true
        });

        // 规划路线
        drivingInstance.value.search(
          startLngLat,
          endLngLat,
          (status, result) => {
            if (status === 'complete') {
              console.log('[地图] 路线规划成功:', result);

              // 保存路径点
              if (result.routes && result.routes.length > 0) {
                const route = result.routes[0];
                routePath.value = route.steps.reduce((acc, step) => {
                  return acc.concat(step.path);
                }, []);

                // 设置路线信息
                routeInfo.value = {
                  distance: formatDistance(route.distance),
                  time: formatTime(route.time)
                };
              }
            } else {
              console.error('[地图] 路线规划失败:', result);
              errorMessage.value = '路线规划失败，请重试';
            }
          }
        );
      } catch (error) {
        console.error('[地图] 规划路线时发生错误:', error);
        errorMessage.value = `规划路线失败: ${error.message}`;
      }
    };

    // 清除路线
    const clearRoute = () => {
      console.log('[地图] 清除路线');

      // 清除驾车规划实例
      if (drivingInstance.value) {
        try {
          drivingInstance.value.clear();
        } catch (error) {
          console.error('[地图] 清除路线失败:', error);
        }
      }

      // 清除采样点标记
      removeSampleMarkers();

      // 清除地图上的所有覆盖物
      if (map.value) {
        try {
          map.value.clearMap();
        } catch (error) {
          console.error('[地图] 清除地图覆盖物失败:', error);
        }
      }

      // 清除路径点
      routePath.value = [];

      // 清除路线信息
      routeInfo.value = null;
    };

    // 格式化距离
    const formatDistance = (distance) => {
      if (distance >= 1000) {
        return `${(distance / 1000).toFixed(1)} 公里`;
      }
      return `${distance} 米`;
    };

    // 格式化时间
    const formatTime = (time) => {
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);

      if (hours > 0) {
        return `${hours} 小时 ${minutes} 分钟`;
      }
      return `${minutes} 分钟`;
    };

    // 采样点标记数组
    const sampleMarkers = ref([]);

    // 移除采样点标记
    const removeSampleMarkers = () => {
      if (sampleMarkers.value.length > 0 && map.value) {
        // 从地图上移除所有采样点标记
        map.value.remove(sampleMarkers.value);
        sampleMarkers.value = [];
        console.log('[地图] 已移除所有采样点标记');
      }
    };

    // 在地图上标记采样点
    const markSamplePoints = (points) => {
      if (!map.value || !points || points.length === 0) return;

      // 先移除现有的采样点标记
      removeSampleMarkers();

      // 为每个采样点创建标记
      const markers = points.map((point, index) => {
        // 根据点的类型选择不同的图标
        let icon;
        if (point.name === '起点') {
          icon = 'https://webapi.amap.com/theme/v1.3/markers/n/start.png';
        } else if (point.name === '终点') {
          icon = 'https://webapi.amap.com/theme/v1.3/markers/n/end.png';
        } else {
          // 途经点使用数字图标
          const iconIndex = (index % 10) + 1; // 1-10的数字
          icon = `https://webapi.amap.com/theme/v1.3/markers/n/mark_b${iconIndex}.png`;
        }

        // 创建标记
        const marker = new window.AMap.Marker({
          position: [point.longitude, point.latitude],
          title: `${point.name}${point.weather ? ': ' + point.weather.weather : ''}`,
          icon: icon,
          label: {
            content: `<div style="padding: 2px 5px; background-color: #fff; border-radius: 3px; border: 1px solid #ccc; font-size: 12px;">${point.name}</div>`,
            direction: 'top'
          }
        });

        return marker;
      });

      // 将所有标记添加到地图
      map.value.add(markers);

      // 保存标记引用
      sampleMarkers.value = markers;

      console.log(`[地图] 已在地图上标记${markers.length}个采样点`);
    };

    // 检查路线天气
    const checkRouteWeather = async () => {
      if (routePath.value.length === 0 || !routeInfo.value) {
        console.warn('[地图] 无法检查路线天气: 路线未规划或路线信息不完整');
        return;
      }

      try {
        console.log('[地图] 开始检查路线天气');

        // 显示加载状态
        showRouteWeatherPopup.value = true;
        isRouteWeatherLoading.value = true;
        routeWeatherError.value = '';

        // 从路线信息中提取距离（去掉单位）
        let distanceText = routeInfo.value.distance;
        let distance = 0;

        if (distanceText.includes('公里')) {
          // 如果距离以公里为单位，转换为米
          distance = parseFloat(distanceText.replace(' 公里', '')) * 1000;
        } else {
          // 如果距离以米为单位
          distance = parseFloat(distanceText.replace(' 米', ''));
        }

        console.log(`[地图] 路线距离: ${distance}米`);

        // 获取路线上的采样点，根据距离确定采样点数量
        const samplePoints = routeWeatherService.getSamplePoints(routePath.value, distance);
        console.log('[地图] 路线采样点:', samplePoints);

        // 获取采样点的天气信息
        const pointsWithWeather = await routeWeatherService.getRouteWeather(samplePoints);
        routeWeatherPoints.value = pointsWithWeather;

        // 在地图上标记采样点
        markSamplePoints(pointsWithWeather);

        // 清除加载状态
        isRouteWeatherLoading.value = false;
      } catch (error) {
        console.error('[地图] 检查路线天气失败:', error);
        routeWeatherError.value = `检查路线天气失败: ${error.message}`;
        isRouteWeatherLoading.value = false;
      }
    };

    // 关闭路线天气弹窗
    const closeRouteWeatherPopup = () => {
      showRouteWeatherPopup.value = false;
      console.log('[地图] 关闭路线天气弹窗');

      // 保留采样点标记，不移除
      // 如果需要在关闭弹窗时移除标记，可以取消下面这行的注释
      // removeSampleMarkers();
    };

    // 组件卸载时清理资源
    onUnmounted(() => {
      console.log('[地图] 组件已卸载');

      // 移除点击监听器和标记
      removeMapClickListener();
      removeClickMarker();

      // 移除当前位置标记
      if (currentLocationMarker.value && map.value) {
        map.value.remove(currentLocationMarker.value);
        currentLocationMarker.value = null;
      }

      // 移除采样点标记
      removeSampleMarkers();

      // 清除路线
      clearRoute();

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
      map,

      // 天气相关
      weatherModeActive,
      showWeatherPopup,
      isWeatherLoading,
      weatherError,
      weatherData,
      toggleWeatherMode,
      closeWeatherPopup,
      retryWeatherFetch,

      // 搜索相关
      handleSearchSelect,
      handleSearchClear,

      // 导航相关
      navigationModeActive,
      startPoint,
      endPoint,
      toggleNavigationMode,
      selectStartPoint,
      selectEndPoint,
      useCurrentLocationAsStart,
      canPlanRoute,
      planRoute,
      clearRoute,
      routeInfo,

      // 起点搜索相关
      startSearchText,
      startSearchResults,
      startSearchFocused,
      handleStartSearch,
      selectStartSearchResult,
      handleStartBlur,

      // 终点搜索相关
      endSearchText,
      endSearchResults,
      endSearchFocused,
      handleEndSearch,
      selectEndSearchResult,
      handleEndBlur,

      // 路线天气相关
      showRouteWeatherPopup,
      routeWeatherPoints,
      isRouteWeatherLoading,
      routeWeatherError,
      checkRouteWeather,
      closeRouteWeatherPopup,

      // 采样点标记相关
      sampleMarkers,
      markSamplePoints,
      removeSampleMarkers
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
  position: relative;

  h1 {
    text-align: center;
    margin-bottom: var(--spacing-lg);
    color: #333;
    font-size: var(--font-size-xxl);
  }

  .search-box-container {
    position: absolute;
    top: calc(var(--spacing-lg) + var(--font-size-xxl) + var(--spacing-lg));
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 500px;
    z-index: 9; /* 降低z-index，确保导航面板在上层 */
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

  .navigation-panel {
    position: absolute;
    top: calc(var(--spacing-lg) + var(--font-size-xxl) + var(--spacing-lg) + 50px); /* 位于标题和搜索框下方 */
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 500px;
    background-color: white;
    border-radius: var(--border-radius-lg);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 11; /* 确保在搜索框上方 */
    overflow: hidden;

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-md);
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

    .panel-content {
      padding: var(--spacing-md);

      .input-group {
        display: flex;
        align-items: center;
        background-color: #f5f5f5;
        border-radius: var(--border-radius-md);
        padding: var(--spacing-sm) var(--spacing-md);
        margin-bottom: var(--spacing-md);
        position: relative;

        .material-icons {
          color: var(--primary-color);
          margin-right: var(--spacing-sm);
        }

        .search-input-wrapper {
          flex: 1;
          position: relative;

          input {
            width: 100%;
            border: none;
            background: none;
            outline: none;
            font-size: var(--font-size-md);

            &::placeholder {
              color: #999;
            }
          }

          .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            width: 100%;
            max-height: 300px;
            overflow-y: auto;
            background-color: white;
            border-radius: var(--border-radius-md);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            margin-top: var(--spacing-xs);

            .search-result-item {
              display: flex;
              align-items: center;
              padding: var(--spacing-sm) var(--spacing-md);
              cursor: pointer;

              &:hover {
                background-color: #f5f5f5;
              }

              .material-icons {
                color: var(--primary-color);
                margin-right: var(--spacing-sm);
                font-size: 18px;
              }

              .result-info {
                flex: 1;

                .result-name {
                  font-weight: bold;
                  font-size: var(--font-size-sm);
                }

                .result-address {
                  font-size: var(--font-size-xs);
                  color: #666;
                  margin-top: 2px;
                }
              }
            }
          }
        }

        .action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;

          .material-icons {
            color: #666;
            margin-right: 0;
          }

          &:hover .material-icons {
            color: var(--primary-color);
          }
        }
      }

      .button-group {
        display: flex;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-md);

        .plan-button, .clear-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--border-radius-md);
          border: none;
          cursor: pointer;
          font-size: var(--font-size-md);

          .material-icons {
            margin-right: var(--spacing-xs);
          }
        }

        .plan-button {
          flex: 2;
          background-color: var(--primary-color);
          color: white;

          &:hover {
            background-color: var(--primary-color-dark);
          }

          &:disabled {
            background-color: #ccc;
            cursor: not-allowed;
          }
        }

        .clear-button {
          flex: 1;
          background-color: #f5f5f5;
          color: #666;

          &:hover {
            background-color: #e0e0e0;
          }
        }
      }

      .route-info {
        background-color: #f5f5f5;
        border-radius: var(--border-radius-md);
        padding: var(--spacing-md);

        .info-item {
          display: flex;
          align-items: center;
          margin-bottom: var(--spacing-sm);

          .material-icons {
            color: var(--primary-color);
            margin-right: var(--spacing-sm);
          }
        }

        .check-weather-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          background-color: var(--primary-color);
          color: white;
          border: none;
          padding: var(--spacing-sm);
          border-radius: var(--border-radius-md);
          cursor: pointer;
          margin-top: var(--spacing-md);

          .material-icons {
            margin-right: var(--spacing-xs);
          }

          &:hover {
            background-color: var(--primary-color-dark);
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

    .map-controls {
      flex-wrap: wrap;

      .control-button {
        font-size: var(--font-size-sm);
        padding: var(--spacing-xs) var(--spacing-md);
      }
    }

    .navigation-panel {
      width: 95%;
      top: calc(var(--spacing-lg) + var(--font-size-xl) + var(--spacing-md) + 40px); /* 调整移动设备上的位置 */

      .panel-content {
        padding: var(--spacing-sm);
      }
    }
  }
}
</style>
