package com.translator.service;

import com.translator.dto.ChatCompletionRequest;
import com.translator.dto.ChatCompletionResponse;
import com.translator.dto.TranslateRequest;
import com.translator.dto.TranslateResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 翻译服务 - 使用专用翻译接口（OpenAI Chat Completions 格式）
 * 
 * 优化策略：
 * 1. Redis 缓存翻译结果（7天过期，命中时自动续期）
 * 2. 使用专用翻译 API（稳定可靠，无 429 限流，不限量）
 * 
 * @author mac
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TranslationService {

    private final WebClient.Builder webClientBuilder;
    private final StringRedisTemplate redisTemplate;

    // 翻译 API 配置
    @Value("${translation.api.url}")
    private String apiUrl;

    @Value("${translation.api.key}")
    private String apiKey;

    @Value("${translation.api.model:gpt-3.5-turbo}")
    private String model;

    // 缓存配置
    private static final String CACHE_PREFIX = "translator:translation:";
    private static final Duration CACHE_TTL = Duration.ofDays(7);

    /**
     * 翻译文本（主入口）
     * 
     * 流程：
     * 1. 检查 Redis 缓存
     * 2. 调用翻译 API
     * 3. 缓存结果
     */
    public TranslateResponse translate(TranslateRequest request) {
        try {
            log.debug("翻译请求: {} -> {} | {}",
                    request.getSourceLang(),
                    request.getTargetLang(),
                    request.getText().substring(0, Math.min(50, request.getText().length())));

            // 1. 检查缓存
            String cacheKey = buildCacheKey(request);
            String cachedResult = redisTemplate.opsForValue().get(cacheKey);

            if (cachedResult != null) {
                // 刷新缓存过期时间（续期为7天）
                redisTemplate.expire(cacheKey, CACHE_TTL);
                log.debug("✅ 命中缓存，直接返回（已刷新过期时间）");

                return TranslateResponse.builder()
                        .translatedText(cachedResult)
                        .sourceLang(request.getSourceLang())
                        .targetLang(request.getTargetLang())
                        .success(true)
                        .build();
            }

            // 2. 调用翻译 API
            String translatedText = callTranslationApi(request);

            if (translatedText != null) {
                // 3. 缓存结果
                redisTemplate.opsForValue().set(cacheKey, translatedText, CACHE_TTL);
                log.debug("✅ 翻译成功并已缓存: {}", translatedText.substring(0, Math.min(50, translatedText.length())));

                return TranslateResponse.builder()
                        .translatedText(translatedText)
                        .sourceLang(request.getSourceLang())
                        .targetLang(request.getTargetLang())
                        .success(true)
                        .build();
            } else {
                return TranslateResponse.builder()
                        .success(false)
                        .error("翻译失败：API 返回为空")
                        .build();
            }

        } catch (WebClientResponseException e) {
            log.error("❌ 翻译 API 请求失败 ({}): {}", e.getStatusCode(), e.getMessage());
            return TranslateResponse.builder()
                    .success(false)
                    .error("翻译服务异常: " + e.getStatusCode())
                    .build();
        } catch (Exception e) {
            log.error("❌ 翻译失败", e);
            return TranslateResponse.builder()
                    .success(false)
                    .error("翻译失败: " + e.getMessage())
                    .build();
        }
    }

    /**
     * 调用翻译 API（OpenAI Chat Completions 格式）
     */
    private String callTranslationApi(TranslateRequest request) {
        // 构建翻译 Prompt
        String prompt = buildTranslationPrompt(request);

        // 构建请求体
        ChatCompletionRequest chatRequest = ChatCompletionRequest.builder()
                .model(model)
                .messages(Collections.singletonList(
                        ChatCompletionRequest.Message.builder()
                                .role("user")
                                .content(prompt)
                                .build()))
                .build();

        // 调用 API
        WebClient client = webClientBuilder
                .baseUrl(apiUrl)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();

        ChatCompletionResponse response = client.post()
                .bodyValue(chatRequest)
                .retrieve()
                .bodyToMono(ChatCompletionResponse.class)
                .block();

        // 解析响应
        if (response != null &&
                response.getChoices() != null &&
                !response.getChoices().isEmpty()) {

            String content = response.getChoices().get(0).getMessage().getContent();
            return content != null ? content.trim() : null;
        }

        return null;
    }

    /**
     * 构建翻译 Prompt
     */
    private String buildTranslationPrompt(TranslateRequest request) {
        String sourceLang = mapLanguageNameChinese(request.getSourceLang());
        String targetLang = mapLanguageNameChinese(request.getTargetLang());

        return String.format(
                "请将以下%s翻译成%s，只返回翻译结果，不要有任何其他内容：\n\n%s",
                sourceLang,
                targetLang,
                request.getText());
    }

    /**
     * 语言代码转中文名称
     */
    private String mapLanguageNameChinese(String lang) {
        switch (lang.toLowerCase()) {
            case "zh":
            case "zh-cn":
                return "中文";
            case "en":
            case "en-us":
                return "英文";
            case "ja":
                return "日文";
            case "ko":
                return "韩文";
            case "fr":
                return "法文";
            case "de":
                return "德文";
            case "es":
                return "西班牙文";
            case "ru":
                return "俄文";
            default:
                return lang;
        }
    }

    /**
     * 构建缓存 Key: MD5(原文 + 源语言 + 目标语言)
     */
    private String buildCacheKey(TranslateRequest request) {
        try {
            String raw = request.getText() + ":" +
                    request.getSourceLang() + ":" +
                    request.getTargetLang();

            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hash = md.digest(raw.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1)
                    hexString.append('0');
                hexString.append(hex);
            }

            return CACHE_PREFIX + hexString.toString();
        } catch (Exception e) {
            log.error("生成缓存 Key 失败", e);
            return CACHE_PREFIX + request.getText().hashCode();
        }
    }

    /**
     * 获取支持的语言列表
     */
    public Object getSupportedLanguages() {
        return Map.of(
                "languages", new String[] {
                        "zh-CN", "en-US", "ja", "ko", "fr", "de", "es", "it", "ru", "pt"
                },
                "note", "专用翻译API - 已启用缓存优化");
    }
}
