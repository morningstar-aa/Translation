package com.translator.interceptor;

import com.translator.service.ActivationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final ActivationService activationService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 放行 OPTIONS 请求（CORS 预检）
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        // 从请求头获取授权码（X-Auth-Token 就是激活码）
        String authCode = request.getHeader("X-Auth-Token");
        
        if (authCode == null || authCode.isEmpty()) {
            log.warn("请求缺少授权码: {} {}", request.getMethod(), request.getRequestURI());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"error\":\"功能不可用，请先激活授权码\"}");
            return false;
        }

        // 验证授权码（先查 Redis，没有则查数据库并重载）
        if (!activationService.validateCode(authCode)) {
            log.warn("授权码无效或已过期: {}", authCode);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"error\":\"授权已过期，功能不可用，请重新激活\"}");
            return false;
        }

        return true;
    }
}
