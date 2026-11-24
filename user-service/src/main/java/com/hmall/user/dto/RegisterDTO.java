package com.hmall.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "邮箱验证码注册")
public class RegisterDTO {

    @Schema(description = "用户名，3-20 位，唯一", example = "xiaoming")
    private String username;

    @Schema(description = "登录密码，6-32 位", example = "123456")
    private String password;

    @Schema(description = "邮箱，注册后作为登录账号", example = "xiaoming@qq.com")
    private String email;

    @Schema(description = "邮箱收到的 6 位验证码", example = "123456")
    private String code;
}
