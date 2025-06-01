#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置
const CONFIG = {
    dataFile: path.join(__dirname, 'server', 'data', 'device_activations.json'),
    defaultPrefix: 'WIPER',
    defaultYear: new Date().getFullYear(),
    deviceModel: '智能雨刷设备',
    firmwareVersion: 'v2.0'
};

// 生成激活码（16位标准格式）
function generateActivationCode(prefix, year, index, format = 'standard') {
    switch (format) {
        case 'standard':
            // 生成16位激活码：XXXX-XXXX-XXXX-XXXX
            const part1 = prefix.substring(0, 4).toUpperCase().padEnd(4, '0');
            const part2 = String(year).substring(2, 4) + String(index % 100).padStart(2, '0');
            const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
            const part4 = crypto.randomBytes(2).toString('hex').toUpperCase();
            return `${part1}-${part2}-${part3}-${part4}`;
        case 'simple':
            // 简化格式：前缀-年份-序号（保持向后兼容）
            return `${prefix}-${year}-${String(index).padStart(4, '0')}`;
        case 'random':
            // 16位随机格式
            const random1 = crypto.randomBytes(2).toString('hex').toUpperCase();
            const random2 = crypto.randomBytes(2).toString('hex').toUpperCase();
            const random3 = crypto.randomBytes(2).toString('hex').toUpperCase();
            const random4 = crypto.randomBytes(2).toString('hex').toUpperCase();
            return `${random1}-${random2}-${random3}-${random4}`;
        case 'uuid':
            // UUID格式：XXXX-XXXX-XXXX-XXXX
            const uuid = crypto.randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase();
            return `${uuid.substring(0, 4)}-${uuid.substring(4, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}`;
        case 'mixed':
            // 混合格式：前缀+随机
            const prefixPart = prefix.substring(0, 2).toUpperCase();
            const yearPart = String(year).substring(2, 4);
            const indexPart = String(index).padStart(2, '0');
            const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
            return `${prefixPart}${yearPart}-${indexPart}${randomPart.substring(0, 2)}-${randomPart.substring(2, 4)}${randomPart.substring(4, 6)}-${randomPart.substring(6, 8)}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;
        default:
            // 默认使用标准格式
            return generateActivationCode(prefix, year, index, 'standard');
    }
}

// 生成序列号
function generateSerialNumber(index) {
    return `IW-${CONFIG.defaultYear}-${String(index).padStart(3, '0')}`;
}

// 读取现有数据
function readActivationData() {
    try {
        if (fs.existsSync(CONFIG.dataFile)) {
            const data = fs.readFileSync(CONFIG.dataFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('❌ 读取激活数据文件失败:', error.message);
    }
    
    // 返回默认结构
    return {
        activations: {},
        activationCodes: {}
    };
}

// 保存数据
function saveActivationData(data) {
    try {
        // 确保目录存在
        const dir = path.dirname(CONFIG.dataFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('❌ 保存激活数据文件失败:', error.message);
        return false;
    }
}

// 获取下一个可用的索引
function getNextIndex(existingCodes, prefix, year, format = 'standard') {
    if (format === 'simple') {
        // 对于简单格式，使用原来的逻辑
        const pattern = new RegExp(`^${prefix}-${year}-(\\d{4})$`);
        let maxIndex = 0;

        for (const code of Object.keys(existingCodes)) {
            const match = code.match(pattern);
            if (match) {
                const index = parseInt(match[1], 10);
                if (index > maxIndex) {
                    maxIndex = index;
                }
            }
        }

        return maxIndex + 1;
    } else {
        // 对于其他格式，使用序列号来确定索引
        let maxIndex = 0;

        for (const codeData of Object.values(existingCodes)) {
            if (codeData.serialNumber) {
                const match = codeData.serialNumber.match(/IW-\d{4}-(\d{3})$/);
                if (match) {
                    const index = parseInt(match[1], 10);
                    if (index > maxIndex) {
                        maxIndex = index;
                    }
                }
            }
        }

        return maxIndex + 1;
    }
}

// 批量生成激活码
function generateActivationCodes(options) {
    const {
        count = 10,
        prefix = CONFIG.defaultPrefix,
        year = CONFIG.defaultYear,
        format = 'standard',
        startIndex = null,
        deviceModel = CONFIG.deviceModel,
        firmwareVersion = CONFIG.firmwareVersion
    } = options;
    
    console.log('🔧 开始生成激活码...');
    console.log(`📋 配置信息:`);
    console.log(`   数量: ${count}`);
    console.log(`   前缀: ${prefix}`);
    console.log(`   年份: ${year}`);
    console.log(`   格式: ${format}`);
    console.log(`   设备型号: ${deviceModel}`);
    console.log(`   固件版本: ${firmwareVersion}`);
    
    // 读取现有数据
    const data = readActivationData();
    const existingCodes = data.activationCodes || {};
    
    // 确定起始索引
    const nextIndex = startIndex || getNextIndex(existingCodes, prefix, year, format);
    console.log(`   起始索引: ${nextIndex}`);
    
    const newCodes = {};
    const generatedCodes = [];
    
    for (let i = 0; i < count; i++) {
        const currentIndex = nextIndex + i;
        const activationCode = generateActivationCode(prefix, year, currentIndex, format);
        const serialNumber = generateSerialNumber(currentIndex);
        
        // 检查是否已存在
        if (existingCodes[activationCode]) {
            console.log(`⚠️  激活码 ${activationCode} 已存在，跳过`);
            continue;
        }
        
        newCodes[activationCode] = {
            isUsed: false,
            deviceModel: deviceModel,
            serialNumber: serialNumber,
            firmwareVersion: firmwareVersion,
            generatedAt: new Date().toISOString()
        };
        
        generatedCodes.push({
            code: activationCode,
            serial: serialNumber,
            index: currentIndex
        });
    }
    
    if (Object.keys(newCodes).length === 0) {
        console.log('⚠️  没有生成新的激活码');
        return { success: false, codes: [] };
    }
    
    // 合并到现有数据
    Object.assign(existingCodes, newCodes);
    data.activationCodes = existingCodes;
    
    // 保存数据
    if (saveActivationData(data)) {
        console.log(`✅ 成功生成 ${Object.keys(newCodes).length} 个激活码`);
        return { success: true, codes: generatedCodes, data: newCodes };
    } else {
        console.log('❌ 保存激活码失败');
        return { success: false, codes: [] };
    }
}

// 显示激活码统计
function showStatistics() {
    const data = readActivationData();
    const codes = data.activationCodes || {};
    
    const total = Object.keys(codes).length;
    const used = Object.values(codes).filter(code => code.isUsed).length;
    const available = total - used;
    
    console.log('\n📊 激活码统计:');
    console.log(`   总数: ${total}`);
    console.log(`   已使用: ${used}`);
    console.log(`   可用: ${available}`);
    
    if (available > 0) {
        console.log('\n🎯 可用激活码示例:');
        const availableCodes = Object.keys(codes).filter(code => !codes[code].isUsed);
        for (let i = 0; i < Math.min(5, availableCodes.length); i++) {
            const code = availableCodes[i];
            console.log(`   • ${code} (${codes[code].serialNumber})`);
        }
        if (availableCodes.length > 5) {
            console.log(`   ... 还有 ${availableCodes.length - 5} 个可用`);
        }
    }
}

// 命令行参数解析
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--count':
            case '-c':
                options.count = parseInt(args[++i], 10);
                break;
            case '--prefix':
            case '-p':
                options.prefix = args[++i];
                break;
            case '--year':
            case '-y':
                options.year = parseInt(args[++i], 10);
                break;
            case '--format':
            case '-f':
                options.format = args[++i];
                break;
            case '--start':
            case '-s':
                options.startIndex = parseInt(args[++i], 10);
                break;
            case '--model':
            case '-m':
                options.deviceModel = args[++i];
                break;
            case '--firmware':
                options.firmwareVersion = args[++i];
                break;
            case '--stats':
                return { action: 'stats' };
            case '--help':
            case '-h':
                return { action: 'help' };
            default:
                if (!arg.startsWith('-')) {
                    options.count = parseInt(arg, 10);
                }
                break;
        }
    }
    
    return { action: 'generate', options };
}

// 显示帮助信息
function showHelp() {
    console.log(`
🔧 激活码批量生成程序

用法:
  node generate_activation_codes.js [选项] [数量]

选项:
  -c, --count <数量>        生成激活码数量 (默认: 10)
  -p, --prefix <前缀>       激活码前缀 (默认: WIPER)
  -y, --year <年份>         年份 (默认: 当前年份)
  -f, --format <格式>       格式类型 (standard|simple|random|uuid|mixed, 默认: standard)
  -s, --start <索引>        起始索引 (默认: 自动计算)
  -m, --model <型号>        设备型号 (默认: 智能雨刷设备)
      --firmware <版本>     固件版本 (默认: v2.0)
      --stats              显示激活码统计
  -h, --help               显示帮助信息

示例:
  node generate_activation_codes.js 20                    # 生成20个激活码
  node generate_activation_codes.js -c 50 -p TEST         # 生成50个TEST前缀的激活码
  node generate_activation_codes.js -f random -c 10       # 生成10个随机格式的激活码
  node generate_activation_codes.js --stats               # 显示统计信息

格式说明:
  standard: WIPE-2501-A1B2-C3D4 (16位标准格式，默认)
  simple:   WIPER-2025-0001 (前缀-年份-序号，向后兼容)
  random:   A1B2-C3D4-E5F6-7890 (16位纯随机)
  uuid:     A1B2-C3D4-E5F6-7890 (16位UUID格式)
  mixed:    WI25-01A1-B2C3-D4E5 (混合格式)
`);
}

// 主函数
function main() {
    console.log('🚀 激活码批量生成程序');
    console.log('=' .repeat(50));
    
    const { action, options } = parseArgs();
    
    switch (action) {
        case 'help':
            showHelp();
            break;
        case 'stats':
            showStatistics();
            break;
        case 'generate':
        default:
            const result = generateActivationCodes(options || {});
            if (result.success) {
                console.log('\n📋 生成的激活码:');
                result.codes.forEach((item, index) => {
                    console.log(`   ${index + 1}. ${item.code} (${item.serial})`);
                });
                console.log('\n');
                showStatistics();
            }
            break;
    }
}

// 运行程序
if (require.main === module) {
    main();
}

module.exports = {
    generateActivationCodes,
    showStatistics,
    readActivationData,
    saveActivationData
};
