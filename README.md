# Telegram Translator Project

这是一个基于 Electron 和 Spring Boot 的 Telegram Web 自动翻译工具，支持激活码验证及多国语言翻译。

## 项目结构
- `node/`: Electron 前端项目
- `translation-service/`: Java Spring Boot 后端项目
- `redis/`: Redis 服务相关（在 `/Volumes/m2/application/redis`）

---

## 1. 前端 Electron 打包与运行

### 环境准备
```bash
cd node
npm install
```

### 开发运行
```bash
npm start
```

### 打包命令 (Consolidated)
打包产物将位于 `node/dist` 文件夹中。

| 目标平台 | 命令 | 说明 |
| :--- | :--- | :--- |
| **Mac (M1/M2/M3)** | `npm run build:mac` | 生成 `.dmg` (ARM64) |
| **Mac (Intel)** | `npm run build:mac -- --x64` | 生成 `.dmg` (x64) |
| **Windows** | `npm run build:win` | 生成 `.exe` 安装程序 |
| **全平台** | `npm run build:all` | 同时生成 Mac 和 Windows 安装包 |

> **提示**: 在 Mac 上为 Windows 打包可能需要安装 `wine`。如果 `npm` 命令执行不畅，可以尝试：
> `npx electron-builder --win --x64`

---

## 2. 后端 Java 服务

### 环境要求
- JDK 21
- Maven 3.x
- MySQL 8.0

### 构建与运行
```bash
cd translation-service
# 打包
mvn clean package -DskipTests
# 运行
java -jar target/translation-service-1.0.0.jar
```

---

## 3. Redis 服务管理

Redis 安装在：`/Volumes/m2/application/redis`

### 管理脚本
```bash
# 进入目录
cd /Volumes/m2/application/redis

# 启动 Redis
./start.sh

# 停止 Redis
./stop.sh

# 重启 Redis
./restart.sh

# 查看状态
./status.sh
```

---

## 4. 配置说明

### 前端配置
文件：`node/preload.js`
- 修改 `API_BASE_URL` 指向你的后端接口（已改为线上的 `https://telegram.api.shangchenghu.shop`）。

### 后端配置
文件：`translation-service/src/main/resources/application-prod.yml`
- 修改数据库和 Redis 的连接信息。

---

## 5. 常见问题
- **时间不翻译**: 前端已过滤消息中的时间元素，只翻译文字内容。
- **登录状态**: 移除了主循环中的 `clearAllCache`，用户的 Telegram 登录状态和激活信息会自动保留。
