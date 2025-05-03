// server/routes/amapWeatherRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// 高德地图API密钥
const AMAP_API_KEY = '6374d5a763f22f25cf1995f6dad8929a';
const AMAP_API_BASE = 'https://restapi.amap.com/v3';

/**
 * 获取天气信息
 * @route GET /api/weather/amap
 * @param {string} city - 城市编码
 * @param {string} extensions - 气象类型，可选值：base/all，base:返回实况天气，all:返回预报天气
 */
router.get('/amap', async (req, res) => {
  try {
    // 获取请求参数
    const { city, extensions = 'all' } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: '缺少城市编码参数'
      });
    }

    console.log(`[高德天气API] 获取城市(${city})的天气信息，类型:${extensions}`);

    // 构建API URL
    const apiUrl = `${AMAP_API_BASE}/weather/weatherInfo`;
    const params = {
      key: AMAP_API_KEY,
      city,
      extensions,
      output: 'JSON'
    };

    // 发送请求
    const response = await axios.get(apiUrl, { params });
    const data = response.data;

    // 检查响应状态
    if (data.status !== '1') {
      console.error(`[高德天气API] 请求失败:`, data);
      return res.status(500).json({
        success: false,
        error: data.info || '获取天气信息失败'
      });
    }

    console.log(`[高德天气API] 获取天气信息成功`);

    // 返回成功结果
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[高德天气API] 获取天气信息出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

/**
 * 根据经纬度获取城市信息
 * @route GET /api/weather/amap/city
 * @param {string} location - 经纬度，格式：longitude,latitude
 */
router.get('/amap/city', async (req, res) => {
  try {
    // 获取请求参数
    const { location } = req.query;

    if (!location) {
      return res.status(400).json({
        success: false,
        error: '缺少位置参数'
      });
    }

    console.log(`[高德天气API] 获取位置(${location})的城市信息`);

    // 构建API URL
    const apiUrl = `${AMAP_API_BASE}/geocode/regeo`;
    const params = {
      key: AMAP_API_KEY,
      location,
      extensions: 'base',
      output: 'JSON'
    };

    // 发送请求
    const response = await axios.get(apiUrl, { params });
    const data = response.data;

    // 检查响应状态
    if (data.status !== '1') {
      console.error(`[高德天气API] 请求失败:`, data);
      return res.status(500).json({
        success: false,
        error: data.info || '获取城市信息失败'
      });
    }

    console.log(`[高德天气API] 获取城市信息成功`);

    // 返回成功结果
    res.json({
      success: true,
      data: data.regeocode
    });
  } catch (error) {
    console.error('[高德天气API] 获取城市信息出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

/**
 * 保留原来的city路由，以便其他部分的代码仍然可以正常工作
 * @route GET /api/weather/city
 * @param {string} location - 经纬度，格式：longitude,latitude
 */
router.get('/city', async (req, res) => {
  try {
    // 获取请求参数
    const { location } = req.query;

    if (!location) {
      return res.status(400).json({
        success: false,
        error: '缺少位置参数'
      });
    }

    console.log(`[高德天气API] 获取位置(${location})的城市信息 (通过/city路由)`);

    // 构建API URL
    const apiUrl = `${AMAP_API_BASE}/geocode/regeo`;
    const params = {
      key: AMAP_API_KEY,
      location,
      extensions: 'base',
      output: 'JSON'
    };

    // 发送请求
    const response = await axios.get(apiUrl, { params });
    const data = response.data;

    // 检查响应状态
    if (data.status !== '1') {
      console.error(`[高德天气API] 请求失败:`, data);
      return res.status(500).json({
        success: false,
        error: data.info || '获取城市信息失败'
      });
    }

    console.log(`[高德天气API] 获取城市信息成功 (通过/city路由)`);

    // 返回成功结果
    res.json({
      success: true,
      data: data.regeocode
    });
  } catch (error) {
    console.error('[高德天气API] 获取城市信息出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

/**
 * 根据经纬度直接获取天气信息
 * @route GET /api/weather/amap/weather
 * @param {string} location - 经纬度，格式：longitude,latitude
 * @param {string} extensions - 气象类型，可选值：base/all，base:返回实况天气，all:返回预报天气
 */
router.get('/amap/weather', async (req, res) => {
  try {
    // 获取请求参数
    const { location, extensions = 'all' } = req.query;

    if (!location) {
      return res.status(400).json({
        success: false,
        error: '缺少位置参数'
      });
    }

    console.log(`[高德天气API] 根据位置(${location})直接获取天气信息`);

    // 第一步：通过经纬度获取城市编码
    const geoUrl = `${AMAP_API_BASE}/geocode/regeo`;
    const geoParams = {
      key: AMAP_API_KEY,
      location,
      extensions: 'base',
      output: 'JSON'
    };

    // 发送请求获取城市信息
    const geoResponse = await axios.get(geoUrl, { params: geoParams });
    const geoData = geoResponse.data;

    // 检查响应状态
    if (geoData.status !== '1') {
      console.error(`[高德天气API] 获取城市信息失败:`, geoData);
      return res.status(500).json({
        success: false,
        error: geoData.info || '获取城市信息失败'
      });
    }

    // 从响应中提取城市编码
    const adcode = geoData.regeocode.addressComponent.adcode;
    if (!adcode) {
      return res.status(500).json({
        success: false,
        error: '无法获取城市编码'
      });
    }

    console.log(`[高德天气API] 获取到城市编码: ${adcode}`);

    // 第二步：使用城市编码获取天气信息
    const weatherUrl = `${AMAP_API_BASE}/weather/weatherInfo`;
    const weatherParams = {
      key: AMAP_API_KEY,
      city: adcode,
      extensions,
      output: 'JSON'
    };

    // 发送请求获取天气信息
    const weatherResponse = await axios.get(weatherUrl, { params: weatherParams });
    const weatherData = weatherResponse.data;

    // 检查响应状态
    if (weatherData.status !== '1') {
      console.error(`[高德天气API] 获取天气信息失败:`, weatherData);
      return res.status(500).json({
        success: false,
        error: weatherData.info || '获取天气信息失败'
      });
    }

    console.log(`[高德天气API] 获取天气信息成功`);

    // 返回成功结果
    res.json({
      success: true,
      data: weatherData
    });
  } catch (error) {
    console.error('[高德天气API] 获取天气信息出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
});

module.exports = router;
