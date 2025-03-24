# 安卓APP打包说明

## 环境准备
1. 安装JDK 11或更高版本
2. 安装Android Studio
3. 通过Android Studio安装Android SDK
4. 设置环境变量：ANDROID_HOME和JAVA_HOME

## 打包步骤

### 安装依赖
```bash
npm install @capacitor/core @capacitor/android @capacitor/cli @capacitor/splash-screen @capacitor/app
```

### 初始化Capacitor (如果是首次使用)
```bash
npx cap init 智能雨刷控制系统 com.rainwiper.app
```

### 构建Vue项目
```bash
npm run build
```

### 添加Android平台 (如果是首次使用)
```bash
npx cap add android
```

### 同步Web代码到Android
```bash
npx cap sync
```

### 使用Android Studio打开项目
```bash
npx cap open android
```

在Android Studio中:
1. 点击工具栏的"Build"菜单
2. 选择"Build Bundle(s) / APK(s)"
3. 选择"Build APK(s)"
4. 构建完成后会提示APK位置

## 一键构建命令
```bash
npm run build:android
```
这将执行构建Vue项目、同步代码到Android并打开Android Studio。

## 注意事项
- 每次修改Vue代码后需要重新运行 `npm run build` 和 `npx cap sync`
- 签名APK需要在Android Studio中配置密钥库
- 上架Google Play需要创建开发者账号
