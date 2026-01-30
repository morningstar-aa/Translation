package com.translator.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Value("${libretranslate.url:http://localhost:5000}")
    private String libreTranslateUrl;

    @Bean
    public WebClient libreTranslateClient() {
        return WebClient.builder()
                .baseUrl(libreTranslateUrl)
                .build();
    }
}
