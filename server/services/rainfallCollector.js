// server/services/rainfallCollector.js
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const config = require('../config');
const { terminateAllPythonProcesses } = require('../utils/processUtils');

// 全局变量
let collectorProcess = null;
let oneNetSyncProcess = null; // OneNET同步进程
let shouldRestartCollector = true; // 控制是否应该重启采集器
let shouldRestartOneNetSync = true; // 控制是否应该重启OneNET同步服务

// 初始化时读取OneNET同步设置
try {
  const settingsFilePath = path.join(__dirname, '..', 'data', 'onenet_sync_settings.json');
  if (fs.existsSync(settingsFilePath)) {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
    if (settings && settings.autoSync !== undefined) {
      shouldRestartOneNetSync = settings.autoSync;
      console.log(`从配置文件中读取OneNET同步自动重启标志: ${shouldRestartOneNetSync}`);
    }
  } else {
    // 如果设置文件不存在，创建一个默认的
    fs.writeFileSync(settingsFilePath, JSON.stringify({ autoSync: true }, null, 2), 'utf8');
    console.log('创建了默认的OneNET同步设置文件，默认启用自动同步');
  }
} catch (error) {
  console.error('读取或创建OneNET同步设置文件时出错:', error);
  // 出错时使用默认值
  shouldRestartOneNetSync = true;
}

/**
 * 启动雨量数据采集器 (现在直接调用OneNET同步服务)
 * @param {string} username - 用户名
 * @returns {Promise<void>}
 */
async function startRainfallCollector(username = 'admin') {
  console.log(`准备启动雨量数据采集器 (现在使用OneNET同步服务代替) (用户: ${username})...`);

  // 直接调用OneNET同步服务
  return startOneNetSync(username);
}

/**
 * 停止雨量数据采集器 (现在直接调用OneNET同步服务的停止方法)
 * @param {string} username - 用户名，默认为'admin'
 * @returns {Promise<void>}
 */
async function stopRainfallCollector(username = 'admin') {
  console.log(`开始停止雨量数据采集器 (现在使用OneNET同步服务代替)，用户名: ${username}`);

  // 直接调用OneNET同步服务的停止方法
  return stopOneNetSync(username);
}

/**
 * 设置是否应该重启采集器
 * @param {boolean} value - 是否应该重启
 */
function setShouldRestartCollector(value) {
  shouldRestartCollector = value;
  console.log(`设置重启标志为${value ? 'true' : 'false'}，${value ? '允许' : '禁止'}数据采集器自动重启`);
}

/**
 * 启动OneNET数据同步服务
 * @param {string} username - 用户名
 * @returns {Promise<void>}
 */
async function startOneNetSync(username = 'admin') {
  console.log(`准备启动OneNET数据同步服务 (用户: ${username})...`);

  // 确保用户名不为空
  if (!username || username.trim() === '') {
    console.error('用户名不能为空，使用默认用户名: admin');
    username = 'admin';
  } else {
    console.log(`使用用户名: ${username}`);
  }

  // 确保同步服务变量被重置
  oneNetSyncProcess = null;

  // 确保用户名参数正确
  let finalUsername = username ? username.trim() : 'admin';
  console.log(`强制使用当前用户名: '${finalUsername}'`);

  const usernameParam = `--username=${finalUsername}`;
  console.log(`最终用户名参数: ${usernameParam}`);

  // 使用新创建的OneNET同步脚本
  const scriptPath = path.join(__dirname, '..', '..', 'python', 'onenet_sync.py');
  console.log(`OneNET同步脚本路径: ${scriptPath}`);

  oneNetSyncProcess = spawn('python', [
    scriptPath,
    '--action=start',
    usernameParam,
    '--interval=5'
  ]);

  oneNetSyncProcess.stdout.on('data', (data) => {
    console.log(`OneNET同步服务输出: ${data}`);
  });

  // 处理stderr输出
  oneNetSyncProcess.stderr.on('data', (data) => {
    const dataStr = data.toString();
    // 如果是LOG开头，则视为日志
    if (dataStr.includes('LOG:')) {
      console.log(`OneNET同步服务日志: ${dataStr.trim()}`);
    } else {
      console.error(`OneNET同步服务错误: ${dataStr.trim()}`);
    }
  });

  oneNetSyncProcess.on('close', (code) => {
    console.log(`OneNET同步服务已终止，退出码: ${code}`);

    // 清除引用
    oneNetSyncProcess = null;

    // 如果意外终止且应该重启，则尝试重启
    if (code !== 0 && shouldRestartOneNetSync) {
      console.log('尝试重启OneNET同步服务...');
      setTimeout(() => {
        // 再次检查是否应该重启
        if (shouldRestartOneNetSync) {
          startOneNetSync(username);
        } else {
          console.log('重启标志已关闭，不再重启OneNET同步服务');
        }
      }, 5000);
    }
  });
}

/**
 * 停止OneNET数据同步服务
 * @param {string} username - 用户名，默认为'admin'
 * @returns {Promise<void>}
 */
async function stopOneNetSync(username = 'admin') {
  console.log(`开始停止OneNET数据同步服务，用户名: ${username}`);

  // 设置不重启标志
  shouldRestartOneNetSync = false;
  console.log('设置不重启标志，确保OneNET同步服务不会自动重启');

  // 如果有正在运行的同步服务，强制停止
  if (oneNetSyncProcess) {
    console.log(`强制停止OneNET同步服务进程`);

    try {
      // 先尝试使用标准的kill方法
      oneNetSyncProcess.kill();
      console.log('已发送终止信号给OneNET同步服务进程');

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 500));

      // 如果进程还在运行，尝试使用SIGKILL
      if (oneNetSyncProcess) {
        try {
          oneNetSyncProcess.kill('SIGKILL');
          console.log('已发送SIGKILL信号终止OneNET同步服务');
        } catch (killError) {
          console.error('使用SIGKILL终止OneNET同步服务时出错:', killError);
        }
      }
    } catch (killError) {
      console.error('终止OneNET同步服务时出错:', killError);
    }

    // 等待进程终止
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 确保进程引用被清除
    oneNetSyncProcess = null;
  } else {
    console.log('没有找到正在运行的OneNET同步服务进程');
  }

  console.log(`OneNET同步服务已强制停止，用户 ${username} 的数据库中的数据保持不变`);

  return { success: true, message: 'OneNET同步服务已停止' };
}

/**
 * 设置是否应该重启OneNET同步服务
 * @param {boolean} value - 是否应该重启
 */
function setShouldRestartOneNetSync(value) {
  shouldRestartOneNetSync = value;
  console.log(`设置OneNET同步服务重启标志为${value ? 'true' : 'false'}，${value ? '允许' : '禁止'}OneNET同步服务自动重启`);
}

/**
 * 获取采集器和同步服务状态
 * @returns {Object} - 采集器和同步服务状态
 */
function getCollectorStatus() {
  return {
    isRunning: collectorProcess !== null,
    shouldRestart: shouldRestartCollector,
    isOneNetSyncRunning: oneNetSyncProcess !== null,
    shouldRestartOneNetSync: shouldRestartOneNetSync
  };
}

/**
 * 清理资源
 */
function cleanup() {
  if (collectorProcess) {
    collectorProcess.kill();
    collectorProcess = null;
  }

  if (oneNetSyncProcess) {
    oneNetSyncProcess.kill();
    oneNetSyncProcess = null;
  }
}

// 在服务器关闭时清理资源
process.on('exit', cleanup);

module.exports = {
  startRainfallCollector,
  stopRainfallCollector,
  startOneNetSync,
  stopOneNetSync,
  setShouldRestartCollector,
  setShouldRestartOneNetSync,
  getCollectorStatus,
  cleanup
};
