# 雨量数据管理系统

本系统提供了一套完整的雨量数据管理解决方案，包括数据库设计、数据采集、数据聚合和API接口。

## 数据库设计

系统使用MySQL数据库，设计了以下表结构：

1. `rainfall_raw` - 原始雨量数据（5秒间隔）
2. `rainfall_10min` - 10分钟聚合数据
3. `rainfall_hourly` - 小时聚合数据
4. `rainfall_daily` - 日聚合数据
5. `rainfall_monthly` - 月聚合数据

## 文件说明

- `rainfall_db.py` - 数据库操作核心模块，包含表初始化、数据聚合等功能
- `rainfall_collector.py` - 数据采集模块，支持模拟数据和真实数据采集
- `rainfall_api.py` - API接口模块，提供给前端使用的数据接口

## 使用方法

### 1. 初始化数据库

```bash
python rainfall_db.py --action=init
```

### 2. 生成模拟数据（可选）

```bash
# 生成7天的模拟数据
python rainfall_db.py --action=mock --days=7
```

### 3. 启动数据采集

```bash
# 使用模拟数据，每5秒采集一次
python rainfall_collector.py --action=start --interval=5 --verbose

# 使用真实数据（需要实现硬件接口）
python rainfall_collector.py --action=start --interval=5 --real --verbose
```

### 4. 获取统计数据

```bash
# 获取10分钟视图数据
python rainfall_api.py --action=stats --period=10min

# 获取小时视图数据
python rainfall_api.py --action=stats --period=hourly

# 获取日视图数据
python rainfall_api.py --action=stats --period=daily

# 获取总数据视图（30天）
python rainfall_api.py --action=stats --period=all
```

### 5. 获取首页实时数据

```bash
python rainfall_api.py --action=home
```

## 数据聚合逻辑

- 原始数据：每5秒采集一次，单位为 mm/h
- 10分钟数据：对原始数据按10分钟时间段聚合，计算平均值，单位为 mm/h
- 小时数据：对10分钟数据按小时聚合，计算平均值，单位为 mm/h，同时计算累计雨量
- 日数据：对小时数据按天聚合，计算平均值和累计雨量，单位分别为 mm/h 和 mm/天
- 月数据：对日数据按月聚合，计算平均日雨量和月累计雨量，单位为 mm/天 和 mm/月

## 雨量级别定义

- 无降雨：< 0.3 mm/h
- 小雨：0.3 - 2.2 mm/h
- 中雨：2.2 - 4.0 mm/h
- 大雨：4.0 - 33 mm/h

## 注意事项

1. 数据采集脚本会自动每10分钟执行一次数据聚合
2. 使用 Ctrl+C 可以优雅地停止数据采集脚本
3. 数据库配置在 `rainfall_db.py` 文件中，与 `db_service.py` 保持一致
4. 如需使用真实硬件数据，请在 `rainfall_collector.py` 中实现 `collect_real_data()` 函数
