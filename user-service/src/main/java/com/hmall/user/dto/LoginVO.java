package com.hmall.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 登录成功后返回给前端的数据。token 用于后续请求的 X-Token 头。
 */
@Data
@Schema(description = "登录结果")
public class LoginVO {

    @Schema(description = "访问令牌，放入请求头 X-Token")
    private String token;

    @Schema(description = "用户 ID")
    private Long userId;

    @Schema(description = "用户名")
    private String username;

    @Schema(description = "绑定邮箱（未绑定时为空）")
    private String email;

    @Schema(description = "当前余额")
    private BigDecimal balance;

    @Schema(description = "账号状态")
    private String status;

    @Schema(description = "令牌有效期（秒）")
    private Long expiresIn;
}
