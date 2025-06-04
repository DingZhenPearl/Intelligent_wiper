#!/usr/bin/env node

/**
 * 智能雨刷控制系统 - 依赖更新脚本
 * 自动检查和更新Node.js和Python依赖
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 智能雨刷控制系统 - 依赖更新工具');
console.log('=====================================');

// 颜色输出函数
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`
};

// 执行命令函数
function runCommand(command, description) {
  try {
    console.log(colors.blue(`\n📋 ${description}...`));
    console.log(colors.cyan(`执行: ${command}`));
    
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      cwd: __dirname 
    });
    
    console.log(colors.green('✅ 成功'));
    if (output.trim()) {
      console.log(output);
    }
    return true;
  } catch (error) {
    console.log(colors.red(`❌ 失败: ${error.message}`));
    return false;
  }
}

// 检查文件是否存在
function fileExists(filePath) {
  return fs.existsSync(path.join(__dirname, filePath));
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const updateType = args[0] || 'all';

  console.log(colors.yellow(`更新类型: ${updateType}`));
  console.log('');

  // Node.js依赖更新
  if (updateType === 'all' || updateType === 'node' || updateType === 'npm') {
    console.log(colors.cyan('🟢 Node.js 依赖管理'));
    console.log('===================');

    // 检查package.json
    if (!fileExists('package.json')) {
      console.log(colors.red('❌ package.json 文件不存在'));
      return;
    }

    // 检查过期依赖
    runCommand('npm outdated', '检查过期的Node.js依赖');

    // 安全审计
    runCommand('npm audit', '执行安全审计');

    // 更新依赖
    if (args.includes('--fix')) {
      runCommand('npm update', '更新Node.js依赖');
      runCommand('npm audit fix', '修复安全问题');
    }

    // 清理缓存
    if (args.includes('--clean')) {
      runCommand('npm cache clean --force', '清理npm缓存');
    }
  }

  // Python依赖更新
  if (updateType === 'all' || updateType === 'python' || updateType === 'pip') {
    console.log(colors.cyan('\n🐍 Python 依赖管理'));
    console.log('==================');

    // 检查requirements.txt
    if (!fileExists('requirements.txt')) {
      console.log(colors.red('❌ requirements.txt 文件不存在'));
      return;
    }

    // 检查pip版本
    runCommand('python -m pip --version', '检查pip版本');

    // 升级pip
    if (args.includes('--upgrade-pip')) {
      runCommand('python -m pip install --upgrade pip', '升级pip到最新版本');
    }

    // 检查已安装的包
    runCommand('pip list --outdated', '检查过期的Python包');

    // 导出当前依赖
    runCommand('pip freeze > requirements-current.txt', '导出当前Python依赖');

    // 更新依赖
    if (args.includes('--fix')) {
      runCommand('pip install --upgrade -r requirements.txt', '升级Python依赖');
    }

    // 安全检查（如果安装了safety）
    try {
      runCommand('safety check', '执行Python安全检查');
    } catch (error) {
      console.log(colors.yellow('💡 提示: 安装safety进行安全检查: pip install safety'));
    }
  }

  // 显示帮助信息
  if (updateType === 'help' || updateType === '--help' || updateType === '-h') {
    console.log(colors.cyan('\n📖 使用说明'));
    console.log('============');
    console.log('node update-dependencies.js [类型] [选项]');
    console.log('');
    console.log('类型:');
    console.log('  all     - 检查所有依赖 (默认)');
    console.log('  node    - 仅检查Node.js依赖');
    console.log('  python  - 仅检查Python依赖');
    console.log('  help    - 显示帮助信息');
    console.log('');
    console.log('选项:');
    console.log('  --fix          - 自动修复和更新依赖');
    console.log('  --clean        - 清理缓存');
    console.log('  --upgrade-pip  - 升级pip到最新版本');
    console.log('');
    console.log('示例:');
    console.log('  node update-dependencies.js all --fix');
    console.log('  node update-dependencies.js python --upgrade-pip --fix');
    console.log('  node update-dependencies.js node --clean');
  }

  console.log(colors.green('\n✅ 依赖检查完成!'));
  
  if (!args.includes('--fix')) {
    console.log(colors.yellow('💡 提示: 使用 --fix 参数自动更新依赖'));
  }
}

// 运行主函数
main().catch(error => {
  console.error(colors.red(`❌ 脚本执行失败: ${error.message}`));
  process.exit(1);
});
