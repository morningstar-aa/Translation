package com.translator.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("activation_codes")
public class ActivationCode {

    @TableId(type = IdType.AUTO)
    private Integer id;

    /**
     * 激活码字符串
     */
    private String code;

    /**
     * 授权有效天数
     */
    private Integer days;

    /**
     * 是否已激活 (0:否, 1:是)
     */
    private Boolean isUsed;

    /**
     * 绑定的 Telegram 用户 ID
     */
    private Long usedBy;

    /**
     * 用户激活的具体时间
     */
    private LocalDateTime usedAt;

    /**
     * 授权到期时间
     */
    private LocalDateTime expireAt;

    /**
     * 绑定的设备唯一标识 (机器码)
     */
    private String deviceId;

    /**
     * 后台生成激活码的时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
