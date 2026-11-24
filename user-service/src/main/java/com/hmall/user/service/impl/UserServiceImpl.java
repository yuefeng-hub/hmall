package com.hmall.user.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hmall.common.dto.UserDTO;
import com.hmall.user.dto.EmailLoginDTO;
import com.hmall.user.dto.LoginDTO;
import com.hmall.user.dto.LoginVO;
import com.hmall.user.dto.RechargeDTO;
import com.hmall.user.dto.RechargeVO;
import com.hmall.user.dto.RegisterDTO;
import com.hmall.user.dto.SendCodeDTO;
import com.hmall.user.dto.SendCodeVO;
import com.hmall.user.entity.RechargeRecord;
import com.hmall.user.entity.User;
import com.hmall.user.exception.BizException;
import com.hmall.user.mapper.RechargeRecordMapper;
import com.hmall.user.mapper.UserMapper;
import com.hmall.user.security.TokenStore;
import com.hmall.user.service.EmailCodeService;
import com.hmall.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.DigestUtils;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {

    /** 单笔充值上限 */
    private static final BigDecimal MAX_RECHARGE = new BigDecimal("50000");

    /** 注册赠送的新人礼金，让新账号注册完就能直接下单 */
    private static final BigDecimal NEW_USER_BONUS = new BigDecimal("500.00");

    /** 用户名只允许中英文、数字、下划线，避免出现空格和奇怪字符 */
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[A-Za-z0-9_\\u4e00-\\u9fa5]+$");

    /** 渠道编码 → 展示名称 */
    private static final Map<String, String> CHANNELS = Map.of(
            "alipay", "支付宝",
            "wechat", "微信支付",
            "bank", "银行卡");

    private static final DateTimeFormatter NO_FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final TokenStore tokenStore;
    private final RechargeRecordMapper recordMapper;
    private final EmailCodeService emailCodeService;

    @Override
    public UserDTO queryById(Long id) {
        User user = getById(id);
        if (user == null) {
            throw new BizException("用户不存在: id=" + id, 404);
        }
        return toDTO(user);
    }

    @Override
    public boolean checkPassword(Long id, String rawPassword) {
        User user = getById(id);
        if (user == null || rawPassword == null) {
            return false;
        }
        return md5(rawPassword).equalsIgnoreCase(user.getPassword());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deductBalance(Long id, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        return baseMapper.deductBalance(id, amount) > 0;
    }

    // ==================== 密码登录 ====================

    @Override
    public LoginVO login(LoginDTO dto) {
        if (dto == null) {
            throw new BizException("请填写账号和密码");
        }
        String username = dto.getUsername() == null ? "" : dto.getUsername().trim();
        String rawPwd = dto.getPassword() == null ? "" : dto.getPassword();

        if (!StringUtils.hasText(username)) {
            throw new BizException("用户名不能为空");
        }
        if (!StringUtils.hasText(rawPwd)) {
            throw new BizException("密码不能为空");
        }

        // 支持「用户名或邮箱」二选一登录，少让用户记一个东西
        User user = getOne(Wrappers.<User>lambdaQuery()
                .eq(User::getUsername, username)
                .or()
                .eq(User::getEmail, username.toLowerCase()), false);

        // 账号不存在与密码错误返回同一提示，避免被枚举出哪些用户名存在
        if (user == null || !md5(rawPwd).equalsIgnoreCase(user.getPassword())) {
            throw new BizException("用户名或密码错误", 401);
        }
        if (!"正常".equals(user.getStatus())) {
            throw new BizException("账号已被冻结，请联系管理员", 403);
        }
        return toLoginVO(user);
    }

    // ==================== 邮箱验证码 ====================

    @Override
    public SendCodeVO sendEmailCode(SendCodeDTO dto) {
        if (dto == null) {
            throw new BizException("请填写邮箱");
        }
        return emailCodeService.send(dto.getEmail(), dto.getPurpose());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LoginVO register(RegisterDTO dto) {
        if (dto == null) {
            throw new BizException("请填写注册信息");
        }
        String username = dto.getUsername() == null ? "" : dto.getUsername().trim();
        String rawPwd = dto.getPassword() == null ? "" : dto.getPassword();

        if (!StringUtils.hasText(username)) {
            throw new BizException("请填写用户名");
        }
        if (username.length() < 3 || username.length() > 20) {
            throw new BizException("用户名需要 3-20 个字符");
        }
        if (!USERNAME_PATTERN.matcher(username).matches()) {
            throw new BizException("用户名只能包含中文、字母、数字和下划线");
        }
        if (rawPwd.length() < 6 || rawPwd.length() > 32) {
            throw new BizException("密码需要 6-32 位");
        }
        String email = emailCodeService.normalizeEmail(dto.getEmail());

        if (getOne(Wrappers.<User>lambdaQuery().eq(User::getUsername, username), false) != null) {
            throw new BizException("用户名已被占用，换一个试试");
        }
        if (getOne(Wrappers.<User>lambdaQuery().eq(User::getEmail, email), false) != null) {
            throw new BizException("该邮箱已注册，可直接用邮箱验证码登录");
        }

        // 唯一性检查全部通过后再消费验证码。
        // 顺序反了的话，用户因为「用户名重复」失败一次就白扔掉一个码，得重新等 60 秒
        emailCodeService.verify(email, EmailCodeService.PURPOSE_REGISTER, dto.getCode());

        User user = new User();
        user.setUsername(username);
        user.setPassword(md5(rawPwd));
        user.setEmail(email);
        user.setBalance(NEW_USER_BONUS);
        user.setStatus("正常");
        save(user);

        return toLoginVO(user);
    }

    @Override
    public LoginVO loginByEmail(EmailLoginDTO dto) {
        if (dto == null) {
            throw new BizException("请填写邮箱和验证码");
        }
        String email = emailCodeService.normalizeEmail(dto.getEmail());

        // 先确认账号存在再验码：未注册的邮箱直接报错，不白耗用户一个验证码
        User user = getOne(Wrappers.<User>lambdaQuery().eq(User::getEmail, email), false);
        if (user == null) {
            throw new BizException("该邮箱尚未注册，请先注册账号", 404);
        }
        if (!"正常".equals(user.getStatus())) {
            throw new BizException("账号已被冻结，请联系管理员", 403);
        }
        emailCodeService.verify(email, EmailCodeService.PURPOSE_LOGIN, dto.getCode());
        return toLoginVO(user);
    }

    // ==================== 令牌 ====================

    @Override
    public UserDTO queryByToken(String token) {
        Long userId = tokenStore.resolve(token);
        if (userId == null) {
            throw new BizException("登录已失效，请重新登录", 401);
        }
        return queryById(userId);
    }

    @Override
    public void logout(String token) {
        tokenStore.revoke(token);
    }

    // ==================== 充值 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RechargeVO recharge(Long userId, RechargeDTO dto) {
        if (dto == null || dto.getAmount() == null) {
            throw new BizException("请填写充值金额");
        }

        BigDecimal amount = dto.getAmount().setScale(2, RoundingMode.HALF_UP);
        if (amount.compareTo(new BigDecimal("0.01")) < 0) {
            throw new BizException("充值金额至少 0.01 元");
        }
        if (amount.compareTo(MAX_RECHARGE) > 0) {
            throw new BizException("单笔充值不能超过 " + MAX_RECHARGE.toPlainString() + " 元");
        }

        String channel = StringUtils.hasText(dto.getChannel()) ? dto.getChannel().trim().toLowerCase() : "alipay";
        String channelName = CHANNELS.get(channel);
        if (channelName == null) {
            throw new BizException("不支持的充值渠道: " + dto.getChannel());
        }

        User user = getById(userId);
        if (user == null) {
            throw new BizException("用户不存在: id=" + userId, 404);
        }
        if (!"正常".equals(user.getStatus())) {
            throw new BizException("账号状态异常，暂时无法充值", 403);
        }

        if (baseMapper.rechargeBalance(userId, amount) <= 0) {
            throw new BizException("充值失败，请稍后重试");
        }

        LocalDateTime now = LocalDateTime.now();
        RechargeRecord record = new RechargeRecord();
        record.setUserId(userId);
        record.setRechargeNo(newRechargeNo(now));
        record.setAmount(amount);
        record.setChannel(channel);
        record.setStatus(1);
        record.setCreateTime(now);
        recordMapper.insert(record);

        // 充值后重新查库，保证返回的是数据库里的真实余额
        User latest = getById(userId);

        RechargeVO vo = new RechargeVO();
        vo.setRechargeNo(record.getRechargeNo());
        vo.setAmount(amount);
        vo.setBalance(latest == null ? amount : latest.getBalance());
        vo.setChannel(channel);
        vo.setChannelName(channelName);
        vo.setCreateTime(now.format(TIME_FMT));
        return vo;
    }

    @Override
    public List<RechargeVO> recentRecharges(Long userId, int limit) {
        if (userId == null) {
            return Collections.emptyList();
        }
        int size = limit <= 0 ? 10 : Math.min(limit, 50);
        List<RechargeRecord> records = recordMapper.selectList(
                Wrappers.<RechargeRecord>lambdaQuery()
                        .eq(RechargeRecord::getUserId, userId)
                        .orderByDesc(RechargeRecord::getId)
                        .last("limit " + size));
        return records.stream().map(r -> {
            RechargeVO vo = new RechargeVO();
            vo.setRechargeNo(r.getRechargeNo());
            vo.setAmount(r.getAmount());
            vo.setChannel(r.getChannel());
            vo.setChannelName(CHANNELS.getOrDefault(r.getChannel(), r.getChannel()));
            vo.setCreateTime(r.getCreateTime() == null ? "" : r.getCreateTime().format(TIME_FMT));
            return vo;
        }).collect(Collectors.toList());
    }

    // ==================== 内部工具 ====================

    private LoginVO toLoginVO(User user) {
        LoginVO vo = new LoginVO();
        vo.setToken(tokenStore.issue(user.getId()));
        vo.setUserId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setEmail(user.getEmail());
        vo.setBalance(user.getBalance());
        vo.setStatus(user.getStatus());
        vo.setExpiresIn(TokenStore.TTL_SECONDS);
        return vo;
    }

    private UserDTO toDTO(User user) {
        UserDTO dto = new UserDTO();
        BeanUtils.copyProperties(user, dto);
        return dto;
    }

    private String md5(String raw) {
        return DigestUtils.md5DigestAsHex(raw.getBytes(StandardCharsets.UTF_8));
    }

    private String newRechargeNo(LocalDateTime now) {
        return "RC" + now.format(NO_FMT) + ThreadLocalRandom.current().nextInt(100, 1000);
    }
}
