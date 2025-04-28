// src/utils/ipLocation.js

/**
 * 获取公网IP地址
 * @returns {Promise<string>} 公网IP地址
 */
export const getPublicIpAddress = async () => {
  try {
    console.log('[IP定位] 获取公网IP地址...');

    // 使用HTTPS API，避免混合内容问题
    // 使用jsonp格式的API，避免CORS问题
    try {
      // 使用ipinfo.io的API（支持HTTPS和CORS）
      const response = await fetch('https://ipinfo.io/json');
      if (response.ok) {
        const data = await response.json();
        const ip = data.ip;

        if (isValidIpAddress(ip)) {
          console.log('[IP定位] 获取公网IP成功(ipinfo.io):', ip);
          return ip;
        }
      }
    } catch (error) {
      console.error('[IP定位] ipinfo.io API失败:', error);
    }

    // 如果第一个API失败，尝试使用备用API
    console.log('[IP定位] 尝试备用IP获取API...');
    try {
      // 使用ipapi.co的API（支持HTTPS和CORS）
      const response = await fetch('https://ipapi.co/json/');
      if (response.ok) {
        const data = await response.json();
        const ip = data.ip;

        if (isValidIpAddress(ip)) {
          console.log('[IP定位] 备用API获取公网IP成功(ipapi.co):', ip);
          return ip;
        }
      }
    } catch (error) {
      console.error('[IP定位] ipapi.co API失败:', error);
    }

    // 尝试第三个API
    console.log('[IP定位] 尝试第三个IP获取API...');
    try {
      // 使用api.ipify.org的API（支持HTTPS和CORS）
      const response = await fetch('https://api.ipify.org?format=json');
      if (response.ok) {
        const data = await response.json();
        const ip = data.ip;

        if (isValidIpAddress(ip)) {
          console.log('[IP定位] 第三个API获取公网IP成功(api.ipify.org):', ip);
          return ip;
        }
      }
    } catch (error) {
      console.error('[IP定位] api.ipify.org API失败:', error);
    }

    // 所有API都失败
    console.error('[IP定位] 所有公网IP获取API都失败');
    throw new Error('无法获取公网IP地址');
  } catch (error) {
    console.error('[IP定位] 获取公网IP地址出错:', error);
    throw error;
  }
};

/**
 * 使用IP地址获取位置信息
 * @param {string} ip IP地址
 * @returns {Promise<Object>} 位置信息
 */
export const getLocationByIp = async (ip) => {
  try {
    console.log('[IP定位] 使用IP地址获取位置信息:', ip);

    // 先尝试使用ipinfo.io API（支持HTTPS和CORS）
    try {
      const response = await fetch(`https://ipinfo.io/${ip}/json`);
      if (response.ok) {
        const data = await response.json();

        if (data.loc) {
          console.log('[IP定位] ipinfo.io定位成功:', data);

          // ipinfo.io返回的loc格式为"纬度,经度"
          const [latitude, longitude] = data.loc.split(',').map(coord => parseFloat(coord));

          return {
            coords: {
              latitude,
              longitude,
              accuracy: 10000 // IP定位精度较低，设置为10公里
            },
            timestamp: Date.now(),
            provider: 'ipinfo.io',
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country
          };
        }
      }
    } catch (error) {
      console.error('[IP定位] ipinfo.io定位API失败:', error);
    }

    // 如果ipinfo.io API失败，尝试使用ip-api.com API（支持HTTPS和CORS）
    console.log('[IP定位] 尝试ip-api.com定位API...');
    try {
      const response = await fetch(`https://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon,query&lang=zh-CN`);
      if (response.ok) {
        const data = await response.json();

        if (data.status === 'success') {
          console.log('[IP定位] ip-api.com定位成功:', data);

          return {
            coords: {
              latitude: data.lat,
              longitude: data.lon,
              accuracy: 10000 // IP定位精度较低，设置为10公里
            },
            timestamp: Date.now(),
            provider: 'ip-api.com',
            ip: data.query,
            city: data.city,
            region: data.regionName,
            country: data.country
          };
        }
      }
    } catch (error) {
      console.error('[IP定位] ip-api.com定位API失败:', error);
    }

    // 如果ip-api.com API失败，尝试使用ipapi.co API
    console.log('[IP定位] 尝试ipapi.co定位API...');
    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      if (response.ok) {
        const data = await response.json();

        if (data.latitude && data.longitude) {
          console.log('[IP定位] ipapi.co定位成功:', data);

          return {
            coords: {
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: 10000 // IP定位精度较低，设置为10公里
            },
            timestamp: Date.now(),
            provider: 'ipapi.co',
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country_name
          };
        }
      }
    } catch (error) {
      console.error('[IP定位] ipapi.co定位API失败:', error);
    }

    // 所有API都失败
    console.error('[IP定位] 所有IP定位API都失败');
    throw new Error('无法通过IP获取位置信息');
  } catch (error) {
    console.error('[IP定位] IP定位出错:', error);
    throw error;
  }
};

/**
 * 获取IP定位
 * @returns {Promise<Object>} 位置信息
 */
export const getIPLocation = async () => {
  try {
    console.log('[IP定位] 获取IP定位...');

    // 先尝试直接获取位置信息（不需要先获取IP地址）
    try {
      const location = await getDirectLocation();
      return location;
    } catch (directError) {
      console.error('[IP定位] 直接获取位置信息失败:', directError);

      // 如果直接获取失败，尝试先获取IP地址，再获取位置信息
      const ip = await getPublicIpAddress();
      return await getLocationByIp(ip);
    }
  } catch (error) {
    console.error('[IP定位] 获取IP定位失败:', error);
    throw error;
  }
};

/**
 * 直接获取位置信息（不需要先获取IP地址）
 * @returns {Promise<Object>} 位置信息
 */
export const getDirectLocation = async () => {
  try {
    console.log('[IP定位] 直接获取位置信息...');

    // 尝试使用ipinfo.io API直接获取位置信息
    try {
      const response = await fetch('https://ipinfo.io/json');
      if (response.ok) {
        const data = await response.json();

        if (data.loc) {
          console.log('[IP定位] ipinfo.io直接定位成功:', data);

          // ipinfo.io返回的loc格式为"纬度,经度"
          const [latitude, longitude] = data.loc.split(',').map(coord => parseFloat(coord));

          return {
            coords: {
              latitude,
              longitude,
              accuracy: 10000 // IP定位精度较低，设置为10公里
            },
            timestamp: Date.now(),
            provider: 'ipinfo.io',
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country
          };
        }
      }
    } catch (error) {
      console.error('[IP定位] ipinfo.io直接定位API失败:', error);
    }

    // 如果ipinfo.io API失败，尝试使用ipapi.co API直接获取位置信息
    console.log('[IP定位] 尝试ipapi.co直接定位API...');
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (response.ok) {
        const data = await response.json();

        if (data.latitude && data.longitude) {
          console.log('[IP定位] ipapi.co直接定位成功:', data);

          return {
            coords: {
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: 10000 // IP定位精度较低，设置为10公里
            },
            timestamp: Date.now(),
            provider: 'ipapi.co',
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country_name
          };
        }
      }
    } catch (error) {
      console.error('[IP定位] ipapi.co直接定位API失败:', error);
    }

    // 所有API都失败
    console.error('[IP定位] 所有直接定位API都失败');
    throw new Error('无法直接获取位置信息');
  } catch (error) {
    console.error('[IP定位] 直接获取位置信息出错:', error);
    throw error;
  }
};

/**
 * 验证IP地址是否有效
 * @param {string} ip IP地址
 * @returns {boolean} 是否有效
 */
function isValidIpAddress(ip) {
  // 简单验证IP地址格式
  const ipPattern = /^([01]?\d\d?|2[0-4]\d|25[0-5])\.([01]?\d\d?|2[0-4]\d|25[0-5])\.([01]?\d\d?|2[0-4]\d|25[0-5])\.([01]?\d\d?|2[0-4]\d|25[0-5])$/;
  return ipPattern.test(ip);
}

export default {
  getPublicIpAddress,
  getLocationByIp,
  getIPLocation,
  getDirectLocation
};
