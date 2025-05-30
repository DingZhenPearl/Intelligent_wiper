// server/services/rainfallCollector.js
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const config = require('../config');
const { terminateAllPythonProcesses } = require('../utils/processUtils');

// 全局变量
let collectorProcess = null;
let oneNetSyncProcesses = new Map(); // OneNET同步进程映射 (username -> process)
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

  // 确保用户名参数正确
  let finalUsername = username ? username.trim() : 'admin';
  console.log(`强制使用当前用户名: '${finalUsername}'`);

  // 检查该用户是否已经有同步进程在运行
  if (oneNetSyncProcesses.has(finalUsername)) {
    console.log(`用户 ${finalUsername} 的OneNET同步服务已在运行，跳过启动`);
    return;
  }

  const usernameParam = `--username=${finalUsername}`;
  console.log(`最终用户名参数: ${usernameParam}`);

  // 使用新创建的OneNET同步脚本
  const scriptPath = path.join(__dirname, '..', '..', 'python', 'onenet_sync.py');
  console.log(`OneNET同步脚本路径: ${scriptPath}`);

  const syncProcess = spawn('python', [
    scriptPath,
    '--action=start',
    usernameParam,
    '--interval=5'
  ]);

  // 将进程存储到映射中
  oneNetSyncProcesses.set(finalUsername, syncProcess);

  syncProcess.stdout.on('data', (data) => {
    console.log(`OneNET同步服务输出 (${finalUsername}): ${data}`);
  });

  // 处理stderr输出
  syncProcess.stderr.on('data', (data) => {
    const dataStr = data.toString();
    // 如果是LOG开头，则视为日志
    if (dataStr.includes('LOG:')) {
      console.log(`OneNET同步服务日志 (${finalUsername}): ${dataStr.trim()}`);
    } else {
      console.error(`OneNET同步服务错误 (${finalUsername}): ${dataStr.trim()}`);
    }
  });

  syncProcess.on('close', (code) => {
    console.log(`OneNET同步服务已终止 (${finalUsername})，退出码: ${code}`);

    // 从映射中移除进程
    oneNetSyncProcesses.delete(finalUsername);

    // 如果意外终止且应该重启，则尝试重启
    if (code !== 0 && shouldRestartOneNetSync) {
      console.log(`尝试重启OneNET同步服务 (${finalUsername})...`);
      setTimeout(() => {
        // 再次检查是否应该重启
        if (shouldRestartOneNetSync) {
          startOneNetSync(finalUsername);
        } else {
          console.log(`重启标志已关闭，不再重启OneNET同步服务 (${finalUsername})`);
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

  // 确保用户名参数正确
  let finalUsername = username ? username.trim() : 'admin';

  // 如果有正在运行的同步服务，强制停止
  if (oneNetSyncProcesses.has(finalUsername)) {
    const syncProcess = oneNetSyncProcesses.get(finalUsername);
    console.log(`强制停止OneNET同步服务进程 (${finalUsername})`);

    try {
      // 先尝试使用标准的kill方法
      syncProcess.kill();
      console.log(`已发送终止信号给OneNET同步服务进程 (${finalUsername})`);

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 500));

      // 如果进程还在运行，尝试使用SIGKILL
      if (oneNetSyncProcesses.has(finalUsername)) {
        try {
          syncProcess.kill('SIGKILL');
          console.log(`已发送SIGKILL信号终止OneNET同步服务 (${finalUsername})`);
        } catch (killError) {
          console.error(`使用SIGKILL终止OneNET同步服务时出错 (${finalUsername}):`, killError);
        }
      }
    } catch (killError) {
      console.error(`终止OneNET同步服务时出错 (${finalUsername}):`, killError);
    }

    // 等待进程终止
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 确保进程引用被清除
    oneNetSyncProcesses.delete(finalUsername);
  } else {
    console.log(`没有找到正在运行的OneNET同步服务进程 (${finalUsername})`);
  }

  console.log(`OneNET同步服务已强制停止，用户 ${finalUsername} 的数据库中的数据保持不变`);

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
 * 为所有用户启动OneNET同步服务
 * @returns {Promise<void>}
 */
async function startOneNetSyncForAllUsers() {
  console.log('开始为所有用户启动OneNET同步服务...');

  try {
    // 获取所有用户列表
    const { executePythonScript } = require('../utils/pythonRunner');
    const dbScriptPath = path.join(__dirname, '..', config.paths.DB_SERVICE_SCRIPT);
    const result = await executePythonScript(dbScriptPath, 'get_all_users');

    if (result.success && result.users && result.users.length > 0) {
      console.log(`找到 ${result.users.length} 个用户，开始启动同步服务`);

      // 为每个用户启动同步服务
      for (const user of result.users) {
        const username = user.username;
        console.log(`为用户 ${username} 启动OneNET同步服务`);

        try {
          await startOneNetSync(username);
          console.log(`用户 ${username} 的OneNET同步服务启动成功`);
        } catch (error) {
          console.error(`为用户 ${username} 启动OneNET同步服务失败:`, error);
        }

        // 在启动下一个用户的服务前稍等一下，避免同时启动太多进程
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`所有用户的OneNET同步服务启动完成，共启动 ${oneNetSyncProcesses.size} 个同步进程`);
    } else {
      console.log('没有找到用户或获取用户列表失败，只为默认用户admin启动同步服务');
      await startOneNetSync('admin');
    }
  } catch (error) {
    console.error('为所有用户启动OneNET同步服务时出错:', error);
    console.log('回退到只为默认用户admin启动同步服务');
    await startOneNetSync('admin');
  }
}

/**
 * 获取采集器和同步服务状态
 * @returns {Object} - 采集器和同步服务状态
 */
function getCollectorStatus() {
  return {
    isRunning: collectorProcess !== null,
    shouldRestart: shouldRestartCollector,
    isOneNetSyncRunning: oneNetSyncProcesses.size > 0,
    oneNetSyncUsers: Array.from(oneNetSyncProcesses.keys()),
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

  // 清理所有OneNET同步进程
  for (const [username, process] of oneNetSyncProcesses) {
    console.log(`清理OneNET同步进程: ${username}`);
    try {
      process.kill();
    } catch (error) {
      console.error(`清理OneNET同步进程失败 (${username}):`, error);
    }
  }
  oneNetSyncProcesses.clear();
}

// 在服务器关闭时清理资源
process.on('exit', cleanup);

module.exports = {
  startRainfallCollector,
  stopRainfallCollector,
  startOneNetSync,
  stopOneNetSync,
  startOneNetSyncForAllUsers,
  setShouldRestartCollector,
  setShouldRestartOneNetSync,
  getCollectorStatus,
  cleanup
};
