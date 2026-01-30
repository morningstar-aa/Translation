package com.translator.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.translator.entity.ActivationCode;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ActivationCodeMapper extends BaseMapper<ActivationCode> {

    /**
     * 根据激活码查询
     */
    @Select("SELECT * FROM activation_codes WHERE code = #{code}")
    ActivationCode findByCode(@Param("code") String code);

    /**
     * 根据用户 ID 查询有效的激活码
     */
    @Select("SELECT * FROM activation_codes WHERE used_by = #{userId} AND expire_at > NOW() LIMIT 1")
    ActivationCode findValidByUserId(@Param("userId") Long userId);

    /**
     * 激活码绑定用户
     */
    @Update("UPDATE activation_codes SET is_used = 1, used_by = #{userId}, used_at = NOW(), expire_at = DATE_ADD(NOW(), INTERVAL days DAY) WHERE code = #{code} AND is_used = 0")
    int activateCode(@Param("code") String code, @Param("userId") Long userId);
}
