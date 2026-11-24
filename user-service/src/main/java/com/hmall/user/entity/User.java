package com.hmall.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;

@Data
@TableName("users")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    /** MD5 后的支付密码 */
    private String password;
    /** 绑定邮箱，用于验证码注册与登录；历史账号可为空 */
    private String email;
    private BigDecimal balance;
    private String status;
}
