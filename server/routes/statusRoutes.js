// server/routes/statusRoutes.js
const express = require('express');
const router = express.Router();
const { getCollectorStatus } = require('../services/rainfallCollector');

// 获取服务器状态
router.get('/', (req, res) => {
  const collectorStatus = getCollectorStatus();
  
  res.json({
    status: 'online',
    message: '服务器正常运行',
    timestamp: new Date().toISOString(),
    collector: {
      isRunning: collectorStatus.isRunning,
      shouldRestart: collectorStatus.shouldRestart
    }
  });
});

module.exports = router;
