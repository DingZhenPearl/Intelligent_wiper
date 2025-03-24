const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: './',  // 使用相对路径很重要
  outputDir: 'dist'  // 确保输出目录正确
})
