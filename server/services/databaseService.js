// server/services/databaseService.js
const path = require('path');
const config = require('../config');
const { executePythonScript } = require('../utils/pythonRunner');

/**
 * 初始化数据库
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  try {
    // 初始化用户数据库
    const dbScriptPath = path.join(__dirname, '..', config.paths.DB_SERVICE_SCRIPT);
    const dbResult = await executePythonScript(dbScriptPath, 'init');
    console.log('数据库初始化结果:', dbResult);

    // 初始化雨量数据库，只创建表结构，不清除现有数据
    const rainfallDbScriptPath = path.join(__dirname, '..', config.paths.RAINFALL_DB_SCRIPT);
    console.log('初始化雨量数据库，保留现有数据');
    const rainfallDbResult = await executePythonScript(rainfallDbScriptPath, 'init');
    console.log('雨量数据库初始化结果:', rainfallDbResult);
  } catch (err) {
    console.error('数据库初始化失败:', err);
    throw err;
  }
}

module.exports = {
  initializeDatabase
};
