package com.hmall.user.controller;

import com.hmall.common.dto.UserDTO;
import com.hmall.user.dto.EmailLoginDTO;
import com.hmall.user.dto.LoginDTO;
import com.hmall.user.dto.LoginVO;
import com.hmall.user.dto.RechargeDTO;
import com.hmall.user.dto.RechargeVO;
import com.hmall.user.dto.RegisterDTO;
import com.hmall.user.dto.SendCodeDTO;
import com.hmall.user.dto.SendCodeVO;
import com.hmall.user.exception.BizException;
import com.hmall.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@Tag(name = "用户服务")
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // ==================== 登录相关 ====================

    @Operation(summary = "登录（用户名或邮箱 + 密码，返回令牌与用户信息）")
    @PostMapping("/login")
    public LoginVO login(@RequestBody LoginDTO dto) {
        return userService.login(dto);
    }

    @Operation(summary = "发送邮箱验证码，purpose=REGISTER / LOGIN")
    @PostMapping("/email/code")
    public SendCodeVO sendEmailCode(@RequestBody SendCodeDTO dto) {
        return userService.sendEmailCode(dto);
    }

    @Operation(summary = "邮箱验证码注册（成功即登录）")
    @PostMapping("/register")
    public LoginVO register(@RequestBody RegisterDTO dto) {
        return userService.register(dto);
    }

    @Operation(summary = "邮箱验证码登录")
    @PostMapping("/email/login")
    public LoginVO loginByEmail(@RequestBody EmailLoginDTO dto) {
        return userService.loginByEmail(dto);
    }

    @Operation(summary = "查询当前登录用户（请求头 X-Token）")
    @GetMapping("/me")
    public UserDTO me(@RequestHeader(value = "X-Token", required = false) String token) {
        return userService.queryByToken(token);
    }

    @Operation(summary = "退出登录，注销令牌")
    @PostMapping("/logout")
    public void logout(@RequestHeader(value = "X-Token", required = false) String token) {
        userService.logout(token);
    }

    // ==================== 余额相关 ====================

    @Operation(summary = "查询用户（含余额）")
    @GetMapping("/{id}")
    public UserDTO queryById(@PathVariable("id") Long id) {
        return userService.queryById(id);
    }

    @Operation(summary = "充值（请求头 X-User-Id 指定用户）")
    @PostMapping("/recharge")
    public RechargeVO recharge(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                               @RequestBody RechargeDTO dto) {
        return userService.recharge(userId, dto);
    }

    @Operation(summary = "最近的充值记录")
    @GetMapping("/recharges")
    public List<RechargeVO> recentRecharges(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                                            @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return userService.recentRecharges(userId, limit);
    }

    // ==================== 支付相关（订单/支付服务调用） ====================

    @Operation(summary = "校验支付密码")
    @GetMapping("/{id}/check-password")
    public boolean checkPassword(@PathVariable("id") Long id, @RequestParam("pw") String pw) {
        if (!StringUtils.hasText(pw)) {
            throw new BizException("支付密码不能为空");
        }
        return userService.checkPassword(id, pw);
    }

    @Operation(summary = "扣减余额")
    @PutMapping("/{id}/balance/deduct")
    public boolean deductBalance(@PathVariable("id") Long id, @RequestParam("amount") BigDecimal amount) {
        return userService.deductBalance(id, amount);
    }
}
