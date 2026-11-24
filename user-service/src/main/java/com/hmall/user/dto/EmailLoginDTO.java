package com.hmall.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "邮箱验证码登录")
public class EmailLoginDTO {

    @Schema(description = "注册时绑定的邮箱", example = "zhangsan@hmall.com")
    private String email;

    @Schema(description = "6 位验证码", example = "123456")
    private String code;
}
