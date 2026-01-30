# Translation Service

Spring Boot 3.2 + JDK 21 翻译服务，集成 LibreTranslate。

## 快速部署

### 使用 Docker Compose（推荐）

```bash
# 启动所有服务（LibreTranslate + Java 服务）
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 单独部署 LibreTranslate

```bash
docker run -d \
  --name libretranslate \
  -p 5000:5000 \
  -e LT_LOAD_ONLY=en,zh \
  libretranslate/libretranslate
```

### 本地开发

```bash
# 确保 LibreTranslate 在 localhost:5000 运行
mvn spring-boot:run
```

## API 接口

### POST /api/translate

```bash
curl -X POST http://localhost:8080/api/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "sourceLang": "en",
    "targetLang": "zh"
  }'
```

**Response:**
```json
{
  "translatedText": "你好世界",
  "sourceLang": "en",
  "targetLang": "zh",
  "success": true
}
```

### GET /api/languages

获取支持的语言列表。

### GET /api/health

健康检查接口。

## 配置

在 `application.yml` 中配置：

```yaml
libretranslate:
  url: http://localhost:5000   # LibreTranslate 地址
  api-key: ""                   # 如需要
```

## 项目结构

```
src/main/java/com/translator/
├── TranslationApplication.java    # 启动类
├── controller/
│   └── TranslationController.java # REST 接口
├── service/
│   └── TranslationService.java    # 翻译逻辑
├── dto/
│   ├── TranslateRequest.java
│   └── TranslateResponse.java
└── config/
    ├── CorsConfig.java            # CORS 配置
    └── WebClientConfig.java       # HTTP 客户端
```
