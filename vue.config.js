const { defineConfig } = require('@vue/cli-service')
const fs = require('fs')
const path = require('path')

// 检查是否存在证书文件
// 如果证书文件不存在，则使用普通HTTP
// 证书文件需要自行生成并放在项目根目录的ssl文件夹中
const httpsOptions = (() => {
  try {
    return {
      key: fs.readFileSync(path.resolve(__dirname, './ssl/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, './ssl/cert.pem'))
    }
  } catch (e) {
    console.warn('未找到SSL证书文件，将使用HTTP协议。如需使用HTTPS，请运行 node https/generate-ssl-cert.js 生成证书文件。')
    return false
  }
})()

module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: '/',  // 使用绝对路径以支持history模式
  outputDir: 'dist',  // 确保输出目录正确
  devServer: {
    historyApiFallback: true,  // 确保history模式下的路由可以正常工作
    hot: true,  // 启用热重载
    watchFiles: ['src/**/*', 'public/**/*'],  // 监听src和public目录下的所有文件
    https: httpsOptions, // 使用HTTPS，如果证书文件存在
    port: 8080, // 指定端口
    host: 'localhost', // 指定主机
    open: true // 自动打开浏览器
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
