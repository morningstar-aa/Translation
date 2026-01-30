package com.translator.service;

import com.translator.dto.ActivateRequest;
import com.translator.dto.ActivateResponse;
import com.translator.entity.ActivationCode;
import com.translator.mapper.ActivationCodeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * @author mac
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ActivationService {

    private final ActivationCodeMapper activationCodeMapper;
    private final StringRedisTemplate redisTemplate;

    // Redis Key 前缀：code -> expireTimestamp
    private static final String CODE_PREFIX = "translator:code:";

    /**
     * 激活码绑定用户
     * @return 成功时返回激活码作为 Token
     */
    public ActivateResponse activate(ActivateRequest request) {
        String code = request.getCode();
        Long userId = request.getUserId();

        log.info("用户 {} 尝试激活码: {}", userId, code);

        // 1. 查询激活码
        ActivationCode activationCode = activationCodeMapper.findByCode(code);
        if (activationCode == null) {
            return ActivateResponse.builder()
                    .success(false)
                    .message("激活码不存在")
                    .build();
        }

        // 2. 检查是否已被使用
        if (activationCode.getIsUsed()) {
            // 检查是否是同一个用户
            if (activationCode.getUsedBy() != null && activationCode.getUsedBy().equals(userId)) {
                // 同一用户，返回已有的授权信息
                return buildSuccessResponse(activationCode);
            }
            return ActivateResponse.builder()
                    .success(false)
                    .message("该激活码已被其他用户使用")
                    .build();
        }

        // 3. 绑定激活码
        int updated = activationCodeMapper.activateCode(code, userId);
        if (updated == 0) {
            return ActivateResponse.builder()
                    .success(false)
                    .message("激活失败，请重试")
                    .build();
        }

        // 4. 重新查询获取更新后的数据
        activationCode = activationCodeMapper.findByCode(code);
        
        // 5. 存入 Redis
        saveToRedis(activationCode);
        
        log.info("用户 {} 激活成功，到期时间: {}", userId, activationCode.getExpireAt());
        
        return buildSuccessResponse(activationCode);
    }

    /**
     * 保存授权码到 Redis
     * 存储的过期时间戳 = 实际到期时间 + 10秒
     * Redis TTL = 到期时间 - 当前时间 + 10秒
     */
    private void saveToRedis(ActivationCode activationCode) {
        LocalDateTime expireAt = activationCode.getExpireAt();
        
        // 计算存储的过期时间戳（到期时间 + 10秒）
        long expireTimestamp = expireAt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        long storedExpireTimestamp = expireTimestamp + 10000; // +10秒
        
        // 计算 Redis TTL（到期时间 - 当前时间 + 10秒）
        Duration ttl = Duration.between(LocalDateTime.now(), expireAt).plusSeconds(10);
        if (ttl.isNegative() || ttl.isZero()) {
            ttl = Duration.ofSeconds(10); // 至少保留10秒
        }

        // 存入 Redis：code -> 过期时间戳（+10秒）
        String key = CODE_PREFIX + activationCode.getCode();
        redisTemplate.opsForValue().set(key, String.valueOf(storedExpireTimestamp), ttl);
        
        log.debug("授权码已存入 Redis: {}, 过期时间戳: {}, TTL: {}s", 
            activationCode.getCode(), storedExpireTimestamp, ttl.getSeconds());
    }

    /**
     * 构建成功响应（Token 就是激活码本身）
     * 返回的过期时间戳 = 实际到期时间 + 10秒
     */
    private ActivateResponse buildSuccessResponse(ActivationCode activationCode) {
        LocalDateTime expireAt = activationCode.getExpireAt();
        long expireTimestamp = expireAt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        long storedExpireTimestamp = expireTimestamp + 10000; // +10秒
        
        return ActivateResponse.builder()
                .success(true)
                .message("激活成功")
                .token(activationCode.getCode())  // Token 就是激活码
                .expireAt(expireAt)
                .expireTimestamp(storedExpireTimestamp) // 返回 +10秒 的时间戳
                .build();
    }

    /**
     * 验证授权码是否有效
     * 1. 先查 Redis
     * 2. Redis 没有则查数据库
     * 3. 数据库有且未过期则重新加载到 Redis
     */
    public boolean validateCode(String code) {
        if (code == null || code.isEmpty()) {
            return false;
        }

        String key = CODE_PREFIX + code;
        
        // 1. 先查 Redis
        String expireStr = redisTemplate.opsForValue().get(key);
        if (expireStr != null) {
            long expireTimestamp = Long.parseLong(expireStr);
            if (expireTimestamp > System.currentTimeMillis()) {
                log.debug("授权码有效（Redis）: {}", code);
                return true;
            } else {
                log.debug("授权码已过期（Redis）: {}", code);
                redisTemplate.delete(key);
                return false;
            }
        }

        // 2. Redis 没有，查数据库
        log.debug("Redis 未找到，查询数据库: {}", code);
        ActivationCode activationCode = activationCodeMapper.findByCode(code);
        
        if (activationCode == null) {
            log.warn("授权码不存在: {}", code);
            return false;
        }

        if (!activationCode.getIsUsed()) {
            log.warn("授权码未激活: {}", code);
            return false;
        }

        LocalDateTime expireAt = activationCode.getExpireAt();
        if (expireAt == null || expireAt.isBefore(LocalDateTime.now())) {
            log.warn("授权码已过期（数据库）: {}", code);
            return false;
        }

        // 3. 数据库有且有效，重新加载到 Redis
        saveToRedis(activationCode);
        log.info("授权码已重新加载到 Redis: {}", code);
        
        return true;
    }

    /**
     * 检查用户授权状态（根据用户 ID 查询）
     */
    public ActivateResponse checkUserStatus(Long userId) {
        // 查数据库获取该用户的有效激活码
        ActivationCode activationCode = activationCodeMapper.findValidByUserId(userId);
        
        if (activationCode == null) {
            return ActivateResponse.builder()
                    .success(false)
                    .message("未授权或已过期，请激活后使用")
                    .build();
        }

        // 确保 Redis 中有该授权码
        saveToRedis(activationCode);
        
        return buildSuccessResponse(activationCode);
    }
}
