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
  console.log('[getClientIp] 开始获取客户端IP地址');

  // 记录所有可能的IP地址来源
  const xForwardedFor = req.headers['x-forwarded-for'];
  const xRealIp = req.headers['x-real-ip'];
  const remoteAddress = req.connection.remoteAddress;
  const socketRemoteAddress = req.socket.remoteAddress;
  const connectionSocketRemoteAddress = req.connection.socket?.remoteAddress;

  console.log('[getClientIp] 可能的IP地址来源:');
  console.log(`  - X-Forwarded-For: ${xForwardedFor || '未设置'}`);
  console.log(`  - X-Real-IP: ${xRealIp || '未设置'}`);
  console.log(`  - connection.remoteAddress: ${remoteAddress || '未设置'}`);
  console.log(`  - socket.remoteAddress: ${socketRemoteAddress || '未设置'}`);
  console.log(`  - connection.socket.remoteAddress: ${connectionSocketRemoteAddress || '未设置'}`);

  // 尝试从各种可能的请求头中获取IP地址
  let ip =
    xForwardedFor?.split(',')[0] ||
    xRealIp ||
    remoteAddress ||
    socketRemoteAddress ||
    connectionSocketRemoteAddress ||
    '127.0.0.1';

  console.log(`[getClientIp] 选择的IP地址: ${ip}`);

  // 如果IP地址是IPv6格式的本地地址，转换为IPv4格式
  if (ip.indexOf('::ffff:') === 0) {
    const ipv4 = ip.substring(7);
    console.log(`[getClientIp] 将IPv6格式转换为IPv4格式: ${ip} -> ${ipv4}`);
    ip = ipv4;
  }

  // 对于内网IP地址，尝试使用一个公共IP进行测试
  if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    console.log(`[getClientIp] 检测到内网IP地址: ${ip}`);

    // 如果是内网IP，可以考虑使用一个公共IP进行测试
    // 这里使用一个示例公共IP，实际使用时可以根据需要修改
    const testPublicIp = '114.114.114.114'; // 中国电信公共DNS服务器IP
    console.log(`[getClientIp] 考虑使用公共IP进行测试: ${testPublicIp}`);

    // 注意：这里只是记录日志，实际返回的仍然是原始IP
    // 如果需要使用公共IP进行测试，可以取消下面的注释
    // return testPublicIp;
  }

  console.log(`[getClientIp] 最终返回的IP地址: ${ip}`);
  return ip;
}

// 获取IP地址和位置信息
router.get('/', (req, res) => {
  try {
    console.log('[IP定位] 开始处理IP定位请求');
    console.log('[IP定位] 请求头:', JSON.stringify(req.headers));

    // 获取客户端IP地址
    const ip = getClientIp(req);
    console.log(`[IP定位] 客户端IP地址: ${ip}`);
    console.log(`[IP定位] 原始请求IP信息: X-Forwarded-For=${req.headers['x-forwarded-for']}, X-Real-IP=${req.headers['x-real-ip']}, remoteAddress=${req.connection.remoteAddress}`);

    // 使用geoip-lite查询位置信息
    console.log(`[IP定位] 调用geoip.lookup(${ip})`);
    const geo = geoip.lookup(ip);
    console.log(`[IP定位] 位置信息:`, geo);

    if (geo) {
      console.log(`[IP定位] 成功获取位置信息: 国家=${geo.country}, 地区=${geo.region}, 城市=${geo.city}, 经纬度=${geo.ll}`);

      // 返回成功结果
      const responseData = {
        success: true,
        data: {
          ip,
          country: geo.country,
          region: geo.region,
          city: geo.city,
          ll: geo.ll, // 经纬度 [latitude, longitude]
          timezone: geo.timezone
        }
      };

      console.log(`[IP定位] 返回数据:`, JSON.stringify(responseData));
      res.json(responseData);
    } else {
      // 如果无法获取位置信息，返回默认位置（绵阳）
      console.log('[IP定位] 无法确定IP地址的位置信息，返回默认位置（绵阳）');

      // 绵阳的大致经纬度：北纬31.46，东经104.68
      const defaultLocation = {
        ip,
        country: 'CN',
        region: '四川',
        city: '绵阳',
        ll: [31.46, 104.68], // [latitude, longitude]
        timezone: 'Asia/Shanghai',
        message: '无法确定IP地址的位置信息，使用默认位置（绵阳）'
      };

      const responseData = {
        success: true,
        data: defaultLocation
      };

      console.log(`[IP定位] 返回默认位置数据:`, JSON.stringify(responseData));
      res.json(responseData);
    }
  } catch (error) {
    console.error('[IP定位] 获取IP位置信息错误:', error);
    console.error('[IP定位] 错误堆栈:', error.stack);

    const errorResponse = {
      success: false,
      error: `服务器内部错误: ${error.message}`
    };

    console.log(`[IP定位] 返回错误:`, JSON.stringify(errorResponse));
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
