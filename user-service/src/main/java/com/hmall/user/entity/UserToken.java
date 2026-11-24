package com.hmall.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 登录令牌，落在 user_token 表里，服务重启后依然有效 */
@Data
@TableName("user_token")
public class UserToken {

    @TableId(value = "token", type = IdType.INPUT)
    private String token;

    private Long userId;

    private LocalDateTime expiresAt;

    private LocalDateTime createTime;
}
