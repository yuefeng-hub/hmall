package com.hmall.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * 登录请求。
 */
@Data
@Schema(description = "登录请求")
public class LoginDTO {

    @Schema(description = "用户名", example = "zhangsan")
    private String username;

    @Schema(description = "登录密码", example = "123456")
    private String password;
}
