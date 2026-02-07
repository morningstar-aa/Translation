package com.translator.service;

import com.translator.dto.TranslateRequest;
import com.translator.dto.TranslateResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TranslationService {

    // 【新版】MyMemory API 客户端（完全免费，无限制）
    private final WebClient.Builder webClientBuilder;

    /*
     * 【旧版 LibreTranslate】已注释
     * private final WebClient libreTranslateClient;
     * 
     * @Value("${libretranslate.api-key:}")
     * private String apiKey;
     */

    /**
     * 调用 MyMemory Translation API 进行翻译
     * 官方文档: https://mymemory.translated.net/doc/spec.php
     * 
     * 【旧版 LibreTranslate 实现已注释在文件末尾】
     */
    public TranslateResponse translate(TranslateRequest request) {
        try {
            log.debug("翻译请求: {} -> {} | {}",
                    request.getSourceLang(),
                    request.getTargetLang(),
                    request.getText().substring(0, Math.min(50, request.getText().length())));

            // 语言代码映射
            String sourceLang = mapLanguageCode(request.getSourceLang());
            String targetLang = mapLanguageCode(request.getTargetLang());

            // 构建 MyMemory API URL
            String url = String.format(
                    "https://api.mymemory.translated.net/get?q=%s&langpair=%s|%s",
                    java.net.URLEncoder.encode(request.getText(), "UTF-8"),
                    sourceLang,
                    targetLang);

            // 调用 MyMemory API
            WebClient client = webClientBuilder.baseUrl("https://api.mymemory.translated.net").build();

            Map<String, Object> response = client.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/get")
                            .queryParam("q", request.getText())
                            .queryParam("langpair", sourceLang + "|" + targetLang)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && response.containsKey("responseData")) {
                Map<String, Object> responseData = (Map<String, Object>) response.get("responseData");
                String translatedText = (String) responseData.get("translatedText");

                log.debug("翻译结果: {}", translatedText.substring(0, Math.min(50, translatedText.length())));

                return TranslateResponse.builder()
                        .translatedText(translatedText)
                        .sourceLang(request.getSourceLang())
                        .targetLang(request.getTargetLang())
                        .success(true)
                        .build();
            } else {
                log.error("MyMemory 响应格式错误: {}", response);
                return TranslateResponse.builder()
                        .success(false)
                        .error("Invalid response from MyMemory API")
                        .build();
            }

        } catch (Exception e) {
            log.error("翻译失败", e);
            return TranslateResponse.builder()
                    .success(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    /**
     * 语言代码映射（MyMemory 使用标准代码）
     */
    private String mapLanguageCode(String lang) {
        switch (lang.toLowerCase()) {
            case "zh":
            case "zh-cn":
                return "zh-CN";
            case "en":
                return "en-US";
            default:
                return lang;
        }
    }

    /**
     * 获取支持的语言列表
     * MyMemory 支持的主要语言对
     */
    public Object getSupportedLanguages() {
        return Map.of(
                "languages", new String[] {
                        "zh-CN", "en-US", "ja", "ko", "fr", "de", "es", "it", "ru", "pt"
                },
                "note", "MyMemory Translation API - Free and Unlimited");
    }
}

/*
 * ========== 旧版 LibreTranslate 实现（已禁用）==========
 * 
 * private final WebClient libreTranslateClient;
 * 
 * @Value("${libretranslate.api-key:}")
 * private String apiKey;
 * 
 * public TranslateResponse translate(TranslateRequest request) {
 * try {
 * log.debug("翻译请求: {} -> {} | {}",
 * request.getSourceLang(),
 * request.getTargetLang(),
 * request.getText().substring(0, Math.min(50, request.getText().length())));
 * 
 * // 构建请求体
 * Map<String, Object> body = Map.of(
 * "q", request.getText(),
 * "source", request.getSourceLang(),
 * "target", request.getTargetLang(),
 * "format", "text"
 * );
 * 
 * // 如果有 API Key，添加到请求中
 * if (apiKey != null && !apiKey.isEmpty()) {
 * body = Map.of(
 * "q", request.getText(),
 * "source", request.getSourceLang(),
 * "target", request.getTargetLang(),
 * "format", "text",
 * "api_key", apiKey
 * );
 * }
 * 
 * // 调用 LibreTranslate API
 * Map<String, Object> response = libreTranslateClient.post()
 * .uri("/translate")
 * .bodyValue(body)
 * .retrieve()
 * .bodyToMono(Map.class)
 * .block();
 * 
 * if (response != null && response.containsKey("translatedText")) {
 * String translatedText = (String) response.get("translatedText");
 * log.debug("翻译结果: {}", translatedText.substring(0, Math.min(50,
 * translatedText.length())));
 * 
 * return TranslateResponse.builder()
 * .translatedText(translatedText)
 * .sourceLang(request.getSourceLang())
 * .targetLang(request.getTargetLang())
 * .success(true)
 * .build();
 * } else {
 * log.error("翻译响应格式错误: {}", response);
 * return TranslateResponse.builder()
 * .success(false)
 * .error("Invalid response from LibreTranslate")
 * .build();
 * }
 * 
 * } catch (Exception e) {
 * log.error("翻译失败", e);
 * return TranslateResponse.builder()
 * .success(false)
 * .error(e.getMessage())
 * .build();
 * }
 * }
 * 
 * public Object getSupportedLanguages() {
 * try {
 * return libreTranslateClient.get()
 * .uri("/languages")
 * .retrieve()
 * .bodyToMono(Object.class)
 * .block();
 * } catch (Exception e) {
 * log.error("获取语言列表失败", e);
 * return Map.of("error", e.getMessage());
 * }
 * }
 * 
 * ========== 旧版结束 ==========
 */
