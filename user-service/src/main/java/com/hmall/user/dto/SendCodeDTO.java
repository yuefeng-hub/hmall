package com.hmall.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "发送邮箱验证码")
public class SendCodeDTO {

    @Schema(description = "邮箱", example = "zhangsan@hmall.com")
    private String email;

    @Schema(description = "用途：LOGIN 登录 / REGISTER 注册", example = "REGISTER")
    private String purpose;
}
