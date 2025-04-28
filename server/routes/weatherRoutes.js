// server/routes/weatherRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// 和风天气API配置
const QWEATHER_API_KEY = '14a0e3ca3e544621814e37a67bf3f6c5'; // 请替换为您的实际API密钥
const QWEATHER_API_BASE = 'https://geoapi.qweather.com/v2';
const QWEATHER_WEATHER_API_BASE = 'https://devapi.qweather.com/v7';

// 设置身份验证方式，可选 'header' 或 'param'
const AUTH_METHOD = 'param';

// 获取实时天气数据
router.get('/now', async (req, res) => {
  try {
    // 从查询参数中获取城市代码或坐标
    const location = req.query.location || '101270401'; // 默认绵阳城市代码

    console.log(`获取实时天气数据，位置: ${location}`);

    // 构建API URL和请求配置
    let apiUrl, requestConfig;

    if (AUTH_METHOD === 'header') {
      // 使用请求标头方式
      apiUrl = `${QWEATHER_WEATHER_API_BASE}/weather/now?location=${location}`;
      requestConfig = {
        headers: {
          'X-QW-Api-Key': QWEATHER_API_KEY
        }
      };
    } else {
      // 使用请求参数方式
      apiUrl = `${QWEATHER_WEATHER_API_BASE}/weather/now?key=${QWEATHER_API_KEY}&location=${location}`;
      requestConfig = {};
    }

    console.log(`使用${AUTH_METHOD === 'header' ? '请求标头' : '请求参数'}方式调用API`);

    // 调用和风天气API
    console.log(`调用API: ${apiUrl}`);
    const response = await axios.get(apiUrl, requestConfig);

    // 检查响应状态
    console.log('响应数据:', response.data);
    if (response.status === 200 && response.data.code === '200') {
      console.log('天气API调用成功');
      res.json({
        success: true,
        data: response.data
      });
    } else {
      console.error(`天气API调用失败，状态码: ${response.status}, API代码: ${response.data.code}`);
      res.status(200).json({
        success: false,
        error: `天气API调用失败: ${response.data.code}`
      });
    }
  } catch (error) {
    console.error('获取天气数据错误:', error.message);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

// 获取未来三天天气预报
router.get('/forecast', async (req, res) => {
  try {
    // 从查询参数中获取城市代码或坐标
    const location = req.query.location || '101270401'; // 默认绵阳城市代码

    console.log(`获取天气预报数据，位置: ${location}`);

    // 构建API URL和请求配置
    let apiUrl, requestConfig;

    if (AUTH_METHOD === 'header') {
      // 使用请求标头方式
      apiUrl = `${QWEATHER_WEATHER_API_BASE}/weather/3d?location=${location}`;
      requestConfig = {
        headers: {
          'X-QW-Api-Key': QWEATHER_API_KEY
        }
      };
    } else {
      // 使用请求参数方式
      apiUrl = `${QWEATHER_WEATHER_API_BASE}/weather/3d?key=${QWEATHER_API_KEY}&location=${location}`;
      requestConfig = {};
    }

    console.log(`使用${AUTH_METHOD === 'header' ? '请求标头' : '请求参数'}方式调用API`);

    // 调用和风天气API
    console.log(`调用API: ${apiUrl}`);
    const response = await axios.get(apiUrl, requestConfig);

    // 检查响应状态
    console.log('响应数据:', response.data);
    if (response.status === 200 && response.data.code === '200') {
      console.log('天气预报API调用成功');
      res.json({
        success: true,
        data: response.data
      });
    } else {
      console.error(`天气预报API调用失败，状态码: ${response.status}, API代码: ${response.data.code}`);
      res.status(200).json({
        success: false,
        error: `天气预报API调用失败: ${response.data.code}`
      });
    }
  } catch (error) {
    console.error('获取天气预报数据错误:', error.message);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

// 获取分钟级降水预报
router.get('/minutely', async (req, res) => {
  try {
    // 从查询参数中获取经纬度坐标或城市ID
    let location = req.query.location || '101270401'; // 默认绵阳城市代码

    // 如果提供了经纬度坐标，优先使用
    const lon = req.query.lon;
    const lat = req.query.lat;
    if (lon && lat) {
      location = `${lon},${lat}`;
      console.log(`使用经纬度坐标: ${location}`);
    }

    console.log(`获取分钟级降水预报数据，位置: ${location}`);

    // 构建API URL和请求配置
    let apiUrl, requestConfig;

    if (AUTH_METHOD === 'header') {
      // 使用请求标头方式
      apiUrl = `${QWEATHER_WEATHER_API_BASE}/minutely/5m?location=${location}`;
      requestConfig = {
        headers: {
          'X-QW-Api-Key': QWEATHER_API_KEY
        }
      };
    } else {
      // 使用请求参数方式
      apiUrl = `${QWEATHER_WEATHER_API_BASE}/minutely/5m?key=${QWEATHER_API_KEY}&location=${location}`;
      requestConfig = {};
    }

    // 打印完整的URL和请求配置
    console.log('分钟级降水预报完整URL:', apiUrl);
    console.log('分钟级降水预报请求配置:', JSON.stringify(requestConfig));

    console.log(`使用${AUTH_METHOD === 'header' ? '请求标头' : '请求参数'}方式调用API`);

    // 调用和风天气API
    console.log(`调用API: ${apiUrl}`);
    const response = await axios.get(apiUrl, requestConfig);

    // 检查响应状态
    console.log('响应数据:', response.data);
    if (response.status === 200 && response.data.code === '200') {
      console.log('分钟级降水预报API调用成功');
      res.json({
        success: true,
        data: response.data
      });
    } else {
      console.error(`分钟级降水预报API调用失败，状态码: ${response.status}, API代码: ${response.data.code}`);
      res.status(200).json({
        success: false,
        error: `分钟级降水预报API调用失败: ${response.data.code}`
      });
    }
  } catch (error) {
    console.error('获取分钟级降水预报数据错误:', error.message);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

// 获取逐小时天气预报
router.get('/hourly', async (req, res) => {
  try {
    // 从查询参数中获取城市代码或坐标
    const location = req.query.location || '101270401'; // 默认绵阳城市代码

    console.log(`获取逐小时天气预报数据，位置: ${location}`);

    // 构建API URL和请求配置
    let apiUrl, requestConfig;

    if (AUTH_METHOD === 'header') {
      // 使用请求标头方式
      apiUrl = `${QWEATHER_WEATHER_API_BASE}/weather/24h?location=${location}`;
      requestConfig = {
        headers: {
          'X-QW-Api-Key': QWEATHER_API_KEY
        }
      };
    } else {
      // 使用请求参数方式
      apiUrl = `${QWEATHER_WEATHER_API_BASE}/weather/24h?key=${QWEATHER_API_KEY}&location=${location}`;
      requestConfig = {};
    }

    console.log(`使用${AUTH_METHOD === 'header' ? '请求标头' : '请求参数'}方式调用API`);

    // 调用和风天气API
    console.log(`调用API: ${apiUrl}`);
    const response = await axios.get(apiUrl, requestConfig);

    // 检查响应状态
    console.log('响应数据:', response.data);
    if (response.status === 200 && response.data.code === '200') {
      console.log('逐小时天气预报API调用成功');
      res.json({
        success: true,
        data: response.data
      });
    } else {
      console.error(`逐小时天气预报API调用失败，状态码: ${response.status}, API代码: ${response.data.code}`);
      res.status(200).json({
        success: false,
        error: `逐小时天气预报API调用失败: ${response.data.code}`
      });
    }
  } catch (error) {
    console.error('获取逐小时天气预报数据错误:', error.message);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

// 获取城市信息
router.get('/city', async (req, res) => {
  try {
    // 从查询参数中获取城市名称
    const location = req.query.location || '绵阳';

    console.log(`获取城市信息，城市名称: ${location}`);

    // 构建API URL和请求配置
    let apiUrl, requestConfig;

    if (AUTH_METHOD === 'header') {
      // 使用请求标头方式
      apiUrl = `${QWEATHER_API_BASE}/city/lookup?location=${encodeURIComponent(location)}`;
      requestConfig = {
        headers: {
          'X-QW-Api-Key': QWEATHER_API_KEY
        }
      };
    } else {
      // 使用请求参数方式
      apiUrl = `${QWEATHER_API_BASE}/city/lookup?key=${QWEATHER_API_KEY}&location=${encodeURIComponent(location)}`;
      requestConfig = {};
    }

    console.log(`使用${AUTH_METHOD === 'header' ? '请求标头' : '请求参数'}方式调用API`);

    // 调用和风天气API
    console.log(`调用API: ${apiUrl}`);
    const response = await axios.get(apiUrl, requestConfig);

    // 检查响应状态
    console.log('响应数据:', response.data);
    if (response.status === 200 && response.data.code === '200') {
      console.log('城市信息API调用成功');
      res.json({
        success: true,
        data: response.data
      });
    } else {
      console.error(`城市信息API调用失败，状态码: ${response.status}, API代码: ${response.data.code}`);
      res.status(200).json({
        success: false,
        error: `城市信息API调用失败: ${response.data.code}`
      });
    }
  } catch (error) {
    console.error('获取城市信息错误:', error.message);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

module.exports = router;
