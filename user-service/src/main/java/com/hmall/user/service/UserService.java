package com.hmall.user.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hmall.common.dto.UserDTO;
import com.hmall.user.dto.EmailLoginDTO;
import com.hmall.user.dto.LoginDTO;
import com.hmall.user.dto.LoginVO;
import com.hmall.user.dto.RechargeDTO;
import com.hmall.user.dto.RechargeVO;
import com.hmall.user.dto.RegisterDTO;
import com.hmall.user.dto.SendCodeDTO;
import com.hmall.user.dto.SendCodeVO;
import com.hmall.user.entity.User;

import java.math.BigDecimal;
import java.util.List;

public interface UserService extends IService<User> {

    UserDTO queryById(Long id);

    boolean checkPassword(Long id, String rawPassword);

    boolean deductBalance(Long id, BigDecimal amount);

    /** 登录：校验账号密码，签发令牌 */
    LoginVO login(LoginDTO dto);

    /** 发送邮箱验证码（注册 / 邮箱登录共用） */
    SendCodeVO sendEmailCode(SendCodeDTO dto);

    /** 邮箱验证码注册，注册成功直接返回登录态 */
    LoginVO register(RegisterDTO dto);

    /** 邮箱验证码登录 */
    LoginVO loginByEmail(EmailLoginDTO dto);

    /** 用令牌换用户信息（相当于 /me） */
    UserDTO queryByToken(String token);

    /** 注销令牌 */
    void logout(String token);

    /** 充值：加余额并写一条流水 */
    RechargeVO recharge(Long userId, RechargeDTO dto);

    /** 当前用户最近的充值记录 */
    List<RechargeVO> recentRecharges(Long userId, int limit);
}
