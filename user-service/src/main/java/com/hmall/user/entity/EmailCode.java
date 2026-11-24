package com.hmall.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 邮箱验证码。一次一码：校验成功后 used 置 1，重复使用会被拒绝。
 */
@Data
@TableName("email_code")
public class EmailCode {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String email;
    private String code;
    /** LOGIN / REGISTER */
    private String purpose;
    /** 1 已使用，0 未使用 */
    private Integer used;
    private LocalDateTime expiredAt;
    private LocalDateTime createTime;
}
