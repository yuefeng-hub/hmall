package com.hmall.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "发送验证码结果")
public class SendCodeVO {

    @Schema(description = "脱敏后的邮箱，如 zha***@qq.com")
    private String email;

    @Schema(description = "true = 邮件真的发出去了")
    private Boolean sent;

    @Schema(description = "true = 未配置 SMTP，验证码只在服务端日志里")
    private Boolean degraded;

    @Schema(description = "验证码有效期（秒）")
    private Integer expiresIn;

    @Schema(description = "多少秒后才允许再次发送")
    private Integer resendAfter;

    @Schema(description = "给前端直接展示的提示语")
    private String message;
}
