// server/utils/securityUtils.js

/**
 * 掩盖敏感信息，如密码
 * @param {Object} obj - 包含可能敏感信息的对象
 * @returns {Object} - 掩盖敏感信息后的对象
 */
function maskSensitiveInfo(obj) {
  const masked = { ...obj };
  if (masked.password) {
    masked.password = '******';
  }
  if (masked.body && masked.body.password) {
    masked.body = { ...masked.body, password: '******' };
  }
  return masked;
}

module.exports = {
  maskSensitiveInfo
};
