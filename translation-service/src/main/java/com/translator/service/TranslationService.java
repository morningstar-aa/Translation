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

    private final WebClient libreTranslateClient;

    @Value("${libretranslate.api-key:}")
    private String apiKey;

    /**
     * 调用 LibreTranslate API 进行翻译
     */
    public TranslateResponse translate(TranslateRequest request) {
        try {
            log.debug("翻译请求: {} -> {} | {}", 
                request.getSourceLang(), 
                request.getTargetLang(), 
                request.getText().substring(0, Math.min(50, request.getText().length())));

            // 构建请求体
            Map<String, Object> body = Map.of(
                "q", request.getText(),
                "source", request.getSourceLang(),
                "target", request.getTargetLang(),
                "format", "text"
            );

            // 如果有 API Key，添加到请求中
            if (apiKey != null && !apiKey.isEmpty()) {
                body = Map.of(
                    "q", request.getText(),
                    "source", request.getSourceLang(),
                    "target", request.getTargetLang(),
                    "format", "text",
                    "api_key", apiKey
                );
            }

            // 调用 LibreTranslate API
            Map<String, Object> response = libreTranslateClient.post()
                .uri("/translate")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

            if (response != null && response.containsKey("translatedText")) {
                String translatedText = (String) response.get("translatedText");
                log.debug("翻译结果: {}", translatedText.substring(0, Math.min(50, translatedText.length())));
                
                return TranslateResponse.builder()
                    .translatedText(translatedText)
                    .sourceLang(request.getSourceLang())
                    .targetLang(request.getTargetLang())
                    .success(true)
                    .build();
            } else {
                log.error("翻译响应格式错误: {}", response);
                return TranslateResponse.builder()
                    .success(false)
                    .error("Invalid response from LibreTranslate")
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
     * 获取支持的语言列表
     */
    public Object getSupportedLanguages() {
        try {
            return libreTranslateClient.get()
                .uri("/languages")
                .retrieve()
                .bodyToMono(Object.class)
                .block();
        } catch (Exception e) {
            log.error("获取语言列表失败", e);
            return Map.of("error", e.getMessage());
        }
    }
}
