package com.translator.dto;

import lombok.Data;

@Data
public class ActivateRequest {
    /**
     * 激活码
     */
    private String code;
    
    /**
     * Telegram 用户 ID
     */
    private Long userId;
}
