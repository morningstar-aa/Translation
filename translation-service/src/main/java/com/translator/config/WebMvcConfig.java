package com.translator.config;

import com.translator.interceptor.AuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                // 拦截翻译接口
                .addPathPatterns("/api/translate")
                // 放行激活、健康检查等接口
                .excludePathPatterns(
                        "/api/activate",
                        "/api/check",
                        "/api/health",
                        "/api/languages"
                );
    }
}
