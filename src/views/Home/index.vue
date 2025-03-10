<template>
  <div class="home">
    <div class="chart-with-img" @click="navigateToChart">
      <img src="@/assets/images/rainfall.png" alt="rainfall"/>
      <span>雨量显示</span>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'

export default {
  name: 'HomePage',
  setup() {
    const router = useRouter()

    const navigateToChart = () => {
      router.push('/rainfall')
    }

    return {
      navigateToChart
    }
  }
}
</script>

<style lang="scss" scoped>
.home {
  .chart-with-img {
    display: inline-block;
    width: 25%;
    margin: 50% 40%;
    text-align: center;
    
    img {
      width: 100%;
      height: 100px;
      padding: 20px;
      background-color: #f3f3f3;
      border: 1px solid #eee;
      margin-bottom: 10px;
    }
  }
}
</style>