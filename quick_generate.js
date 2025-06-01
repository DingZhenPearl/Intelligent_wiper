#!/usr/bin/env node

// 快速激活码生成脚本
const { generateActivationCodes, showStatistics } = require('./generate_activation_codes.js');

function quickGenerate() {
    console.log('🚀 快速激活码生成');
    console.log('=' .repeat(30));
    
    // 默认生成10个16位标准激活码
    const result = generateActivationCodes({
        count: 10,
        prefix: 'WIPER',
        format: 'standard'  // 使用新的16位标准格式
    });
    
    if (result.success) {
        console.log('\n🎯 新生成的激活码:');
        result.codes.forEach((item, index) => {
            console.log(`${String(index + 1).padStart(2, ' ')}. ${item.code}`);
        });
        
        console.log('\n📋 可直接复制使用的激活码列表:');
        console.log(result.codes.map(item => item.code).join('\n'));
        
        console.log('\n');
        showStatistics();
    }
}

if (require.main === module) {
    quickGenerate();
}

module.exports = { quickGenerate };
