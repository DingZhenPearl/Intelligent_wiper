#!/usr/bin/env node
/**
 * 项目清理脚本
 * 清理临时文件、缓存文件和构建产物
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 智能雨刷项目清理工具');
console.log('=' .repeat(40));

// 要清理的目录和文件模式
const cleanupTargets = [
    // Python缓存
    'python/__pycache__',
    
    // Node.js缓存
    'node_modules/.cache',
    
    // 构建产物（可选）
    // 'dist',
    // 'android/build',
    
    // 临时文件
    '*.tmp',
    '*.log',
    
    // 编辑器临时文件
    '.vscode/settings.json.bak',
    '*.swp',
    '*~'
];

// 安全删除函数
function safeDelete(targetPath) {
    try {
        const fullPath = path.resolve(targetPath);
        
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                console.log(`🗂️  删除目录: ${targetPath}`);
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                console.log(`📄 删除文件: ${targetPath}`);
                fs.unlinkSync(fullPath);
            }
            
            return true;
        } else {
            console.log(`⏭️  跳过不存在的路径: ${targetPath}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ 删除失败 ${targetPath}: ${error.message}`);
        return false;
    }
}

// 使用glob模式查找文件
function findFilesByPattern(pattern) {
    try {
        // 使用PowerShell的Get-ChildItem来查找文件
        const command = `Get-ChildItem -Path . -Name "${pattern}" -Recurse -Force | ForEach-Object { $_.FullName }`;
        const result = execSync(`powershell -Command "${command}"`, { 
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
        });
        
        return result.trim().split('\n').filter(line => line.trim());
    } catch (error) {
        return [];
    }
}

// 主清理函数
function cleanup() {
    let deletedCount = 0;
    
    console.log('\n🔍 开始清理...\n');
    
    for (const target of cleanupTargets) {
        if (target.includes('*')) {
            // 处理通配符模式
            const files = findFilesByPattern(target);
            for (const file of files) {
                if (safeDelete(file)) {
                    deletedCount++;
                }
            }
        } else {
            // 处理具体路径
            if (safeDelete(target)) {
                deletedCount++;
            }
        }
    }
    
    console.log(`\n✅ 清理完成！共删除 ${deletedCount} 个项目`);
    
    // 显示清理建议
    console.log('\n💡 其他清理建议:');
    console.log('   • 运行 "npm run build" 重新生成dist目录');
    console.log('   • 运行 "npm install" 确保依赖完整');
    console.log('   • 检查 .gitignore 确保临时文件不被提交');
}

// 显示帮助信息
function showHelp() {
    console.log('\n📖 使用说明:');
    console.log('   node cleanup.js        - 执行标准清理');
    console.log('   node cleanup.js --help - 显示帮助信息');
    console.log('   node cleanup.js --deep - 深度清理（包括构建产物）');
}

// 深度清理（包括构建产物）
function deepCleanup() {
    console.log('\n🔥 执行深度清理（包括构建产物）...\n');
    
    const deepTargets = [
        'dist',
        'android/build',
        'node_modules/.cache'
    ];
    
    let deletedCount = 0;
    
    for (const target of deepTargets) {
        if (safeDelete(target)) {
            deletedCount++;
        }
    }
    
    // 执行标准清理
    cleanup();
    
    console.log(`\n🎯 深度清理额外删除 ${deletedCount} 个构建产物`);
    console.log('   建议运行 "npm run build" 重新构建项目');
}

// 主程序
function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        return;
    }
    
    if (args.includes('--deep')) {
        deepCleanup();
        return;
    }
    
    cleanup();
}

// 运行主程序
if (require.main === module) {
    main();
}

module.exports = { cleanup, deepCleanup, safeDelete };
