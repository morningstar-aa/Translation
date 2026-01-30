package com.translator.controller;

import com.translator.dto.TranslateRequest;
import com.translator.dto.TranslateResponse;
import com.translator.service.TranslationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * @author mac
 */
@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TranslationController {

    private final TranslationService translationService;

    /**
     * 翻译接口
     * POST /api/translate
     */
    @PostMapping("/translate")
    public ResponseEntity<TranslateResponse> translate(@RequestBody TranslateRequest request) {
        log.info("收到翻译请求: {} -> {}", request.getSourceLang(), request.getTargetLang());
        
        TranslateResponse response = translationService.translate(request);
        
        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * 获取支持的语言列表
     * GET /api/languages
     */
    @GetMapping("/languages")
    public ResponseEntity<Object> getLanguages() {
        return ResponseEntity.ok(translationService.getSupportedLanguages());
    }

    /**
     * 健康检查
     * GET /api/health
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
}
