package com.translator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActivateResponse {
    private boolean success;
    private String message;
    
    /**
     * 授权 Token（存储到客户端）
     */
    private String token;
    
    /**
     * 到期时间
     */
    private LocalDateTime expireAt;
    
    /**
     * 到期时间戳（毫秒）
     */
    private Long expireTimestamp;
}
