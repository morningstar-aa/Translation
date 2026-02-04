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
                    .message("激活码无效")
                    .build();
        }

        // 2. 检查是否已被激活
        if (activationCode.getIsUsed()) {
            // 已被激活的情况下，检查是否过期
            if (activationCode.getExpireAt() != null && activationCode.getExpireAt().isBefore(LocalDateTime.now())) {
                return ActivateResponse.builder()
                        .success(false)
                        .message("该激活码已过期")
                        .build();
            }

            // 校验设备 ID 是否匹配 (用于重新登录同步缓存)
            String boundDeviceId = activationCode.getDeviceId();
            if (boundDeviceId != null && !boundDeviceId.equals(request.getDeviceId())) {
                return ActivateResponse.builder()
                        .success(false)
                        .message("该激活码已在其他设备上绑定使用")
                        .build();
            }

            saveToRedis(activationCode);
            return buildSuccessResponse(activationCode);
        }

        // 3. 首次绑定激活码与设备
        int updated = activationCodeMapper.activateCode(code, userId, request.getDeviceId());
        if (updated == 0) {
            return ActivateResponse.builder()
                    .success(false)
                    .message("激活异常，该激活码可能刚被绑定")
                    .build();
        }

        // 4. 重查获取最新的 expire_at
        activationCode = activationCodeMapper.findByCode(code);
        
        // 5. 存入 Redis 并返回
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
        LocalDateTime now = LocalDateTime.now();
        
        // 1. 计算 Redis TTL（严格遵循：到期时间 - 当前时间 + 10秒）
        Duration ttl = Duration.between(now, expireAt).plusSeconds(10);
        
        // 如果已经过期，但还在10秒缓冲期内，则维持10秒
        if (ttl.isNegative() || ttl.isZero()) {
            ttl = Duration.ofSeconds(10); 
        }

        // 2. 计算存储的过期时间戳（到期时间 + 10秒）
        long expireTimestamp = expireAt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        long storedExpireTimestamp = expireTimestamp + 10000; // +10秒缓冲

        // 3. 存入 Token 效期并绑定设备：code -> expireTimestamp|deviceId
        String codeKey = CODE_PREFIX + activationCode.getCode();
        String value = storedExpireTimestamp + "|" + activationCode.getDeviceId();
        redisTemplate.opsForValue().set(codeKey, value, ttl);
        
        log.info("授权码 Redis 信息已刷新: code={}, deviceId={}, 剩余 TTL: {}s", 
            activationCode.getCode(), activationCode.getDeviceId(), ttl.getSeconds());
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
    /**
     * 验证授权码是否有效
     * 1. 先查 Redis
     * 2. Redis 没有则查数据库
     * 3. 数据库有且未过期则重新加载到 Redis
     */
    public boolean validateCode(String code, String deviceId) {
        if (code == null || code.isEmpty() || deviceId == null) {
            return false;
        }

        // 1. 校验 Code 的效期与设备匹配性（Redis）
        String codeKey = CODE_PREFIX + code;
        String val = redisTemplate.opsForValue().get(codeKey);
        if (val != null) {
            String[] parts = val.split("\\|");
            long expireTimestamp = Long.parseLong(parts[0]);
            String boundDeviceId = parts.length > 1 ? parts[1] : null;

            if (expireTimestamp > System.currentTimeMillis()) {
                // 校验设备一致性
                if (deviceId.equals(boundDeviceId)) {
                    return true;
                } else {
                    log.warn("授权码设备不匹配: token={}, reqDevice={}, boundDevice={}", code, deviceId, boundDeviceId);
                    return false;
                }
            } else {
                log.debug("授权码已过期（Redis）: {}", code);
                redisTemplate.delete(codeKey);
                return false;
            }
        }

        // 2. 兜底逻辑：Redis 中缺失，查数据库
        return validateWithDb(code, deviceId);
    }

    private boolean validateWithDb(String code, String deviceId) {
        log.debug("Redis 未命中，查询数据库: code={}", code);
        ActivationCode activationCode = activationCodeMapper.findByCode(code);
        
        if (activationCode == null || !activationCode.getIsUsed()) {
            return false;
        }

        // 校验数据库中的设备 ID
        if (activationCode.getDeviceId() != null && !activationCode.getDeviceId().equals(deviceId)) {
            log.warn("数据库校验：授权码设备不一致");
            return false;
        }

        LocalDateTime expireAt = activationCode.getExpireAt();
        if (expireAt == null || expireAt.isBefore(LocalDateTime.now())) {
            log.warn("数据库校验：授权码已过期");
            return false;
        }

        // 刷新 Redis
        saveToRedis(activationCode);
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
