// server/routes/ipLocationRoutes.js
const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');

/**
 * 获取客户端IP地址
 * @param {Object} req - Express请求对象
 * @returns {string} - 客户端IP地址
 */
function getClientIp(req) {
  // 尝试从各种可能的请求头中获取IP地址
  const ip = 
    req.headers['x-forwarded-for']?.split(',')[0] || 
    req.headers['x-real-ip'] || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress || 
    req.connection.socket?.remoteAddress || 
    '127.0.0.1';
  
  // 如果IP地址是IPv6格式的本地地址，转换为IPv4格式
  return ip.indexOf('::ffff:') === 0 ? ip.substring(7) : ip;
}

// 获取IP地址和位置信息
router.get('/', (req, res) => {
  try {
    // 获取客户端IP地址
    const ip = getClientIp(req);
    console.log(`[IP定位] 客户端IP地址: ${ip}`);

    // 使用geoip-lite查询位置信息
    const geo = geoip.lookup(ip);
    console.log(`[IP定位] 位置信息:`, geo);

    if (geo) {
      // 返回成功结果
      res.json({
        success: true,
        data: {
          ip,
          country: geo.country,
          region: geo.region,
          city: geo.city,
          ll: geo.ll, // 经纬度 [latitude, longitude]
          timezone: geo.timezone
        }
      });
    } else {
      // 如果无法获取位置信息，返回仅包含IP的结果
      res.json({
        success: true,
        data: {
          ip,
          message: '无法确定IP地址的位置信息'
        }
      });
    }
  } catch (error) {
    console.error('[IP定位] 获取IP位置信息错误:', error.message);
    res.status(500).json({
      success: false,
      error: `服务器内部错误: ${error.message}`
    });
  }
});

module.exports = router;
