// server/config/index.js
module.exports = {
  server: {
    port: 3000,
    host: '0.0.0.0',  // 确保是0.0.0.0而不是localhost
    secret_key: 'mwYgR7#*X2'
  },
  paths: {
    // Python脚本路径
    DB_SERVICE_SCRIPT: '../python/db_service.py',
    RAINFALL_API_SCRIPT: '../python/rainfall_api.py',
    RAINFALL_COLLECTOR_SCRIPT: '../python/rainfall_collector.py',
    RAINFALL_DB_SCRIPT: '../python/rainfall_db.py',
    ONENET_API_SCRIPT: '../python/onenet_api.py',
    ONENET_STATS_SCRIPT: '../python/onenet_stats.py'
  }
};
