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

        // 从请求头获取授权码与设备 ID
        String authCode = request.getHeader("X-Auth-Token");
        String deviceId = request.getHeader("X-Device-Id");
        
        if (authCode == null || authCode.isEmpty()) {
            log.warn("请求缺少授权码: {} {}", request.getMethod(), request.getRequestURI());
            return unauthorizedResponse(response, "功能不可用，请先激活授权码");
        }

        if (deviceId == null || deviceId.isEmpty()) {
            log.warn("请求缺少设备 ID: {} {}", request.getMethod(), request.getRequestURI());
            return unauthorizedResponse(response, "设备指纹缺失，请重新激活");
        }

        // 验证授权码效期与设备一致性
        if (!activationService.validateCode(authCode, deviceId)) {
            log.warn("授权验证失败 (Token 无效或设备不匹配): token={}, device={}", authCode, deviceId);
            return unauthorizedResponse(response, "授权码无效、已过期或已在其他设备绑定");
        }

        return true;
    }

    private boolean unauthorizedResponse(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(String.format("{\"success\":false,\"error\":\"%s\"}", message));
        return false;
    }
}
