package com.translator.controller;

import com.translator.dto.ActivateRequest;
import com.translator.dto.ActivateResponse;
import com.translator.service.ActivationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ActivationController {

    private final ActivationService activationService;

    /**
     * 激活码绑定接口
     * POST /api/activate
     */
    @PostMapping("/activate")
    public ResponseEntity<ActivateResponse> activate(@RequestBody ActivateRequest request) {
        log.info("收到激活请求: userId={}, code={}", request.getUserId(), request.getCode());
        
        ActivateResponse response = activationService.activate(request);
        
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 检查用户授权状态
     * GET /api/check?userId=xxx
     */
    @GetMapping("/check")
    public ResponseEntity<ActivateResponse> checkStatus(@RequestParam Long userId) {
        log.info("检查用户状态: userId={}", userId);
        
        ActivateResponse response = activationService.checkUserStatus(userId);
        return ResponseEntity.ok(response);
    }
}
