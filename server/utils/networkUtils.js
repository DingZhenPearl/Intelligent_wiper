// server/utils/networkUtils.js
const os = require('os');

/**
 * 获取本地IP地址列表
 * @returns {Array} - 本地IP地址列表
 */
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.keys(interfaces).forEach((netInterface) => {
    interfaces[netInterface].forEach((iface) => {
      // 只获取IPv4地址且排除内部地址
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    });
  });

  return addresses;
}

module.exports = {
  getLocalIpAddresses
};
