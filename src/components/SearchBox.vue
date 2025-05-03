<template>
  <div class="search-box">
    <div class="search-input-container">
      <input 
        type="text" 
        class="search-input" 
        v-model="searchText" 
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        placeholder="搜索地点"
        ref="searchInput"
      />
      <button class="search-button" @click="handleSearch">
        <span class="material-icons">search</span>
      </button>
      <button v-if="searchText" class="clear-button" @click="clearSearch">
        <span class="material-icons">close</span>
      </button>
    </div>
    
    <div class="search-results" v-if="showResults && searchResults.length > 0">
      <div 
        v-for="(item, index) in searchResults" 
        :key="index" 
        class="search-result-item"
        @click="selectResult(item)"
      >
        <span class="material-icons">place</span>
        <div class="result-info">
          <div class="result-name">{{ item.name }}</div>
          <div class="result-address">{{ item.address }}</div>
        </div>
      </div>
    </div>
    
    <div class="search-results" v-if="showResults && searchResults.length === 0 && searchText">
      <div class="no-results">
        <span class="material-icons">search_off</span>
        <p>未找到相关地点</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue';

export default {
  name: 'SearchBox',
  props: {
    map: {
      type: Object,
      required: true
    }
  },
  setup(props, { emit }) {
    const searchText = ref('');
    const searchResults = ref([]);
    const showResults = ref(false);
    const searchInput = ref(null);
    const autoComplete = ref(null);
    const placeSearch = ref(null);
    
    // 初始化自动完成和地点搜索插件
    const initPlugins = () => {
      if (!window.AMap) {
        console.error('[搜索框] 高德地图API未加载');
        return;
      }
      
      // 初始化自动完成插件
      if (!autoComplete.value) {
        window.AMap.plugin('AMap.AutoComplete', () => {
          autoComplete.value = new window.AMap.AutoComplete({
            city: '全国'
          });
          console.log('[搜索框] 自动完成插件初始化成功');
        });
      }
      
      // 初始化地点搜索插件
      if (!placeSearch.value) {
        window.AMap.plugin('AMap.PlaceSearch', () => {
          placeSearch.value = new window.AMap.PlaceSearch({
            map: props.map,
            pageSize: 10,
            pageIndex: 1
          });
          console.log('[搜索框] 地点搜索插件初始化成功');
        });
      }
    };
    
    // 处理输入
    const handleInput = () => {
      if (!autoComplete.value || !searchText.value.trim()) {
        searchResults.value = [];
        return;
      }
      
      autoComplete.value.search(searchText.value, (status, result) => {
        if (status === 'complete' && result.tips) {
          searchResults.value = result.tips.map(tip => ({
            name: tip.name,
            address: tip.district,
            location: tip.location,
            id: tip.id
          }));
          showResults.value = true;
        } else {
          searchResults.value = [];
        }
      });
    };
    
    // 处理搜索
    const handleSearch = () => {
      if (!placeSearch.value || !searchText.value.trim()) {
        return;
      }
      
      placeSearch.value.search(searchText.value, (status, result) => {
        if (status === 'complete' && result.poiList && result.poiList.pois.length > 0) {
          const poi = result.poiList.pois[0];
          selectResult({
            name: poi.name,
            address: poi.address,
            location: poi.location
          });
        } else {
          console.log('[搜索框] 未找到搜索结果');
        }
      });
    };
    
    // 选择搜索结果
    const selectResult = (item) => {
      console.log('[搜索框] 选择搜索结果:', item);
      searchText.value = item.name;
      showResults.value = false;
      
      // 发送选择事件
      emit('select', item);
      
      // 如果有位置信息，移动地图
      if (item.location) {
        props.map.setCenter([item.location.lng, item.location.lat]);
        
        // 添加标记
        const marker = new window.AMap.Marker({
          position: [item.location.lng, item.location.lat],
          title: item.name,
          animation: 'AMAP_ANIMATION_DROP'
        });
        
        // 清除之前的标记
        props.map.clearMap();
        
        // 添加新标记
        props.map.add(marker);
        
        // 缩放地图
        props.map.setZoom(15);
      }
    };
    
    // 清除搜索
    const clearSearch = () => {
      searchText.value = '';
      searchResults.value = [];
      showResults.value = false;
      emit('clear');
    };
    
    // 处理焦点
    const handleFocus = () => {
      showResults.value = searchResults.value.length > 0;
    };
    
    // 处理失焦
    const handleBlur = () => {
      // 延迟隐藏结果，以便点击结果项
      setTimeout(() => {
        showResults.value = false;
      }, 200);
    };
    
    // 监听地图变化
    watch(() => props.map, (newMap) => {
      if (newMap) {
        initPlugins();
      }
    }, { immediate: true });
    
    return {
      searchText,
      searchResults,
      showResults,
      searchInput,
      handleInput,
      handleSearch,
      selectResult,
      clearSearch,
      handleFocus,
      handleBlur
    };
  }
};
</script>

<style lang="scss" scoped>
.search-box {
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  
  .search-input-container {
    display: flex;
    align-items: center;
    background-color: white;
    border-radius: var(--border-radius-md);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    
    .search-input {
      flex: 1;
      padding: var(--spacing-sm) var(--spacing-md);
      border: none;
      outline: none;
      font-size: var(--font-size-md);
      
      &::placeholder {
        color: #999;
      }
    }
    
    .search-button, .clear-button {
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      padding: var(--spacing-sm);
      cursor: pointer;
      
      .material-icons {
        font-size: 20px;
        color: #666;
      }
      
      &:hover .material-icons {
        color: var(--primary-color);
      }
    }
    
    .search-button {
      background-color: var(--primary-color);
      
      .material-icons {
        color: white;
      }
      
      &:hover {
        background-color: var(--primary-color-dark);
      }
    }
  }
  
  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: white;
    border-radius: 0 0 var(--border-radius-md) var(--border-radius-md);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    margin-top: 2px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
    
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
      }
      
      .result-info {
        flex: 1;
        
        .result-name {
          font-weight: bold;
          margin-bottom: 2px;
        }
        
        .result-address {
          font-size: var(--font-size-sm);
          color: #666;
        }
      }
    }
    
    .no-results {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--spacing-md);
      color: #999;
      
      .material-icons {
        font-size: 32px;
        margin-bottom: var(--spacing-sm);
      }
      
      p {
        margin: 0;
      }
    }
  }
}

/* 移动设备适配 */
@media screen and (max-width: 768px) {
  .search-box {
    max-width: 100%;
  }
}
</style>
