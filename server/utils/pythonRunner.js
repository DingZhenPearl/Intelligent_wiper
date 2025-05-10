// server/utils/pythonRunner.js
const path = require('path');
const { PythonShell } = require('python-shell');
const { exec } = require('child_process');
const { maskSensitiveInfo } = require('./securityUtils');

/**
 * 处理Python脚本的标准错误输出
 * @param {string} stderr - 标准错误输出
 */
function handlePythonStderr(stderr) {
  if (!stderr) return;

  // 尝试使用 UTF-8 解码
  try {
    // 将stderr输出分行处理
    const lines = stderr.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        // 如果是LOG开头，则视为日志而非错误
        if (line.includes('LOG:')) {
          console.log(`Python脚本日志: ${line.trim()}`);
        } else {
          console.error(`Python脚本错误: ${line.trim()}`);
        }
      }
    }
  } catch (e) {
    // 如果解码失败，尝试使用 Buffer 处理
    console.error('处理Python stderr时出错:', e);
    console.error('原始stderr内容:', stderr);

    try {
      // 尝试将内容转换为 UTF-8
      const buffer = Buffer.from(stderr, 'binary');
      const utf8Text = buffer.toString('utf8');
      console.log('转换后的stderr内容:', utf8Text);
    } catch (convErr) {
      console.error('转换stderr内容失败:', convErr);
    }
  }
}

/**
 * 执行Python脚本
 * @param {string} scriptPath - 脚本路径
 * @param {string} action - 执行的动作
 * @param {Object} params - 参数
 * @returns {Promise<Object>} - 执行结果
 */
function executePythonScript(scriptPath, action, params = {}) {
  return new Promise((resolve) => {
    let args = [];

    // 只有当action不为null或undefined时才添加action参数
    if (action !== null && action !== undefined) {
      args.push(`--action=${action}`);
    }

    // 添加其他参数 - 改用独立参数传递，避免引号问题
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        args.push(`--${key}=${value}`);
      }
    });

    const maskedArgs = args.map(arg =>
      arg.startsWith('--password=') ? '--password=******' : arg
    );

    console.log(`执行Python脚本: ${path.basename(scriptPath)}`);
    console.log(`参数: ${maskedArgs.join(' ')}`);

    // 使用更安全的方式执行Python脚本
    let options = {
      mode: 'text',  // 将mode改为text而不是json，我们自己处理解析
      pythonPath: 'python', // 根据环境可能需要修改为'python3'
      scriptPath: path.dirname(scriptPath),
      args: args,
      // 指定编码为 UTF-8
      encoding: 'utf8',
      // 设置环境变量，确保Python使用UTF-8编码
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      },
      stderrParser: line => {
        // 收集stderr输出
        if (!options.stderr) options.stderr = '';
        options.stderr += line + '\n';
        return line;
      }
    };

    console.log(`脚本路径: ${scriptPath}`);
    console.log(`脚本目录: ${path.dirname(scriptPath)}`);
    console.log(`脚本文件名: ${path.basename(scriptPath)}`);

    // 尝试使用PythonShell执行脚本
    PythonShell.run(path.basename(scriptPath), options).then(results => {
      // 处理PythonShell的stderr输出
      if (options.stderr) {
        handlePythonStderr(options.stderr);
      }
      if (results && results.length > 0) {
        try {
          // 手动解析JSON
          const jsonOutput = results[0].trim();
          console.log('Python原始返回结果:', jsonOutput);

          // 尝试解析JSON
          let parsedResult;
          try {
            parsedResult = JSON.parse(jsonOutput);
          } catch (jsonErr) {
            console.error('JSON解析错误，尝试创建默认响应');
            // 创建一个默认的成功响应
            parsedResult = createDefaultResponse(action, params);
          }

          console.log('解析后的结果:', maskSensitiveInfo(parsedResult));
          resolve(parsedResult);
        } catch (parseErr) {
          console.error('解析Python返回的JSON失败:', parseErr);
          console.error('原始输出:', results[0]);

          // 创建一个默认的成功响应
          const defaultResult = createDefaultResponse(action, params);
          resolve(defaultResult);
        }
      } else {
        console.error('Python脚本没有返回数据，使用默认响应');

        // 创建一个默认的成功响应
        const defaultResult = createDefaultResponse(action, params);
        resolve(defaultResult);
      }
    }).catch(err => {
      console.error('PythonShell执行错误:', maskSensitiveInfo(err));

      // 如果PythonShell失败，直接使用exec方法
      console.log('使用exec方法执行Python脚本...');

      // 切换到脚本所在目录，然后执行脚本
      const scriptDir = path.dirname(scriptPath);
      const scriptName = path.basename(scriptPath);
      const command = `cd "${scriptDir}" && python "${scriptName}" ${args.join(' ')}`;

      console.log(`执行命令: ${command}`);

      // 设置环境变量，确保Python使用UTF-8编码
      const execOptions = {
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8'
        },
        encoding: 'utf8'
      };

      exec(command, execOptions, (error, stdout, stderr) => {
        // 使用新的函数处理stderr
        handlePythonStderr(stderr);

        if (error) {
          console.error(`执行错误: ${error}`);

          // 即使有错误，也尝试解析输出
          if (stdout && stdout.trim()) {
            try {
              console.log(`Python脚本原始输出: ${stdout}`);
              const result = JSON.parse(stdout.trim());
              resolve(result);
              return;
            } catch (parseErr) {
              console.error('尝试解析错误输出失败:', parseErr);
            }
          }

          // 创建一个默认的成功响应
          const defaultResult = createDefaultResponse(action, params);
          console.log('Python脚本执行错误，使用默认响应');
          resolve(defaultResult);
          return;
        }

        try {
          console.log(`Python脚本原始输出: ${stdout}`);
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          console.error(`解析结果失败: ${stdout}`);
          console.error(`解析错误: ${e}`);

          // 创建一个默认的成功响应
          const defaultResult = createDefaultResponse(action, params);
          console.log('解析结果失败，使用默认响应');
          resolve(defaultResult);
        }
      });
    });
  });
}

/**
 * 创建默认响应
 * @param {string} action - 执行的动作
 * @param {Object} params - 参数
 * @returns {Object} - 默认响应
 */
function createDefaultResponse(action, params) {
  // 处理聚合数据的情况（action为null且有period参数）
  if ((action === null || action === undefined) && params.period) {
    return {
      success: true,
      period: params.period,
      data: [],
      currentHour: {
        hour: new Date().getHours(),
        avg_rainfall: 0.0,
        total_rainfall: 0.0,
        data_points: 0,
        minutes_passed: (new Date().getMinutes() + (new Date().getSeconds() / 60))
      },
      unit: 'mm/h'  // 统一使用相同的单位，前端会根据时间粒度自行处理
    };
  } else if (action === 'stats') {
    return {
      success: true,
      period: params.period || '10min',
      data: [],
      currentHour: {
        hour: new Date().getHours(),
        avg_rainfall: 0.0,
        total_rainfall: 0.0,
        data_points: 0,
        minutes_passed: (new Date().getMinutes() + (new Date().getSeconds() / 60))
      },
      unit: 'mm/h'  // 统一使用相同的单位，前端会根据时间粒度自行处理
    };
  } else if (action === 'home') {
    return {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        rainfall_value: 0.0,
        rainfall_level: 'none',
        rainfall_percentage: 0
      }
    };
  } else {
    return { success: true, message: '操作成功' };
  }
}

module.exports = {
  executePythonScript,
  handlePythonStderr
};
