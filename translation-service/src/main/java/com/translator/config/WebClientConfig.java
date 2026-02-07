package com.translator.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    /*
     * 【旧版 LibreTranslate 配置】已注释
     * 
     * @Value("${libretranslate.url:http://localhost:5000}")
     * private String libreTranslateUrl;
     * 
     * @Bean
     * public WebClient libreTranslateClient() {
     * return WebClient.builder()
     * .baseUrl(libreTranslateUrl)
     * .build();
     * }
     */

    /**
     * 【新版】提供 WebClient.Builder 用于 MyMemory API
     * MyMemory 是完全免费的翻译服务，无需配置
     */
    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }
}
