// server/utils/processUtils.js
const { exec } = require('child_process');
const path = require('path');
const config = require('../config');

/**
 * 终止所有Python进程
 * @returns {Promise<void>}
 */
async function terminateAllPythonProcesses() {
  try {
    console.log('强制终止所有Python进程');
    if (process.platform === 'win32') {
      // Windows系统 - 终止所有Python进程
      try {
        // 先尝试使用taskkill终止python.exe，设置编码为UTF-8
        require('child_process').execSync('chcp 65001 >nul && taskkill /F /IM python.exe /T', {
          stdio: 'pipe',
          encoding: 'utf8'
        });
        console.log('已终止所有Python进程');
      } catch (e) {
        console.error('终止Python进程失败:', e.message);
        // 如果失败，尝试列出进程
        try {
          console.log('当前运行的Python进程:');
          console.log(require('child_process').execSync('chcp 65001 >nul && tasklist /FI "IMAGENAME eq python.exe"', {
            encoding: 'utf8'
          }));
        } catch (listError) {
          console.error('无法列出Python进程:', listError.message);
        }
      }
    } else {
      // Linux/Mac系统 - 终止所有Python进程
      try {
        require('child_process').execSync('pkill -9 python', { stdio: 'ignore' });
        console.log('已终止所有Python进程');
      } catch (e) {
        console.error('终止Python进程失败:', e.message);
      }
    }

    // 等待一小段时间，确保进程已经完全终止
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (execError) {
    console.error('终止进程时出错:', execError.message);
  }
}

/**
 * 终止特定的Python脚本进程
 * @param {string} scriptPath - 脚本路径
 * @returns {Promise<void>}
 */
async function terminateSpecificPythonProcess(scriptPath) {
  try {
    console.log(`尝试终止脚本 ${path.basename(scriptPath)} 的进程`);
    if (process.platform === 'win32') {
      // Windows系统 - 只终止特定脚本的进程
      try {
        require('child_process').execSync(`taskkill /F /FI "WINDOWTITLE eq ${scriptPath}*" /T`, { stdio: 'ignore' });
      } catch (e) {
        // 如果上面的命令失败，尝试更精确的方式
        require('child_process').execSync(`wmic process where "commandline like '%${scriptPath}%'" delete`, { stdio: 'ignore' });
      }
    } else {
      // Linux/Mac系统 - 只终止特定脚本的进程
      require('child_process').execSync(`pkill -f "${scriptPath}"`, { stdio: 'ignore' });
    }
    console.log(`已尝试终止脚本 ${path.basename(scriptPath)} 的进程`);

    // 等待一小段时间，确保进程已经完全终止
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (execError) {
    // 忽略错误，因为可能没有找到匹配的进程
    console.log(`没有找到需要终止的脚本 ${path.basename(scriptPath)} 进程或终止过程中出错`);
  }
}

module.exports = {
  terminateAllPythonProcesses,
  terminateSpecificPythonProcess
};
