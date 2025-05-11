// kill-python.js
const { execSync } = require('child_process');

console.log('正在终止所有Python进程...');

try {
  // 设置控制台代码页为UTF-8
  execSync('chcp 65001', { stdio: 'inherit' });
  
  // 终止所有Python进程
  const result = execSync('taskkill /F /IM python.exe /T', { 
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe']
  });
  
  console.log('终止结果:');
  console.log(result);
} catch (error) {
  console.error('终止Python进程时出错:');
  
  if (error.stdout) {
    console.log('标准输出:');
    console.log(error.stdout);
  }
  
  if (error.stderr) {
    console.log('标准错误:');
    console.log(error.stderr);
  }
  
  // 尝试列出当前运行的Python进程
  try {
    console.log('当前运行的Python进程:');
    const processes = execSync('tasklist /FI "IMAGENAME eq python.exe"', { 
      encoding: 'utf8' 
    });
    console.log(processes);
  } catch (listError) {
    console.error('无法列出Python进程:', listError.message);
  }
}

console.log('脚本执行完毕');
