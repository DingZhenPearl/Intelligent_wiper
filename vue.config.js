const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: './',  // 使用相对路径很重要
  outputDir: 'dist',  // 确保输出目录正确
  devServer: {
    historyApiFallback: true,  // 确保history模式下的路由可以正常工作
    hot: true,  // 启用热重载
    watchFiles: ['src/**/*', 'public/**/*']  // 监听src和public目录下的所有文件
  },
  // 使用configureWebpack传递Webpack选项
  configureWebpack: {
    watch: true,
    watchOptions: {
      poll: 1000, // 每秒检查一次变动
      aggregateTimeout: 500, // 防抖，500ms内的连续变化只构建一次
      ignored: /node_modules/
    }
  }
})
