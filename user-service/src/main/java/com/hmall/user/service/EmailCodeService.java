package com.hmall.user.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.hmall.user.dto.SendCodeVO;
import com.hmall.user.entity.EmailCode;
import com.hmall.user.exception.BizException;
import com.hmall.user.mapper.EmailCodeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

/**
 * 邮箱验证码：发码、限流、校验。
 *
 * 三条硬规则：
 *   1. 5 分钟有效
 *   2. 同一邮箱同一场景 60 秒内只能发一次（防止被脚本刷短信费）
 *   3. 一码一用（校验成功立刻置 used=1）
 */
@Service
@RequiredArgsConstructor
public class EmailCodeService {

    public static final String PURPOSE_LOGIN = "LOGIN";
    public static final String PURPOSE_REGISTER = "REGISTER";

    private static final int TTL_MINUTES = 5;
    private static final int RESEND_SECONDS = 60;

    /** 只做基础格式校验，真正的可达性交给发信环节 */
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)+$");

    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmailCodeMapper codeMapper;
    private final MailService mailService;

    public SendCodeVO send(String rawEmail, String rawPurpose) {
        String email = normalizeEmail(rawEmail);
        String purpose = normalizePurpose(rawPurpose);
        String scene = sceneOf(purpose);

        // 60 秒限流：报剩余秒数，比干巴巴一句「操作太频繁」体验好得多
        EmailCode last = latest(email, purpose);
        if (last != null && last.getCreateTime() != null) {
            long elapsed = Duration.between(last.getCreateTime(), LocalDateTime.now()).getSeconds();
            if (elapsed >= 0 && elapsed < RESEND_SECONDS) {
                long wait = RESEND_SECONDS - elapsed;
                throw new BizException("验证码已发送，请 " + wait + " 秒后再试", 429);
            }
        }

        LocalDateTime now = LocalDateTime.now();
        EmailCode record = new EmailCode();
        record.setEmail(email);
        record.setCode(String.format("%06d", RANDOM.nextInt(1000000)));
        record.setPurpose(purpose);
        record.setUsed(0);
        record.setCreateTime(now);
        record.setExpiredAt(now.plusMinutes(TTL_MINUTES));
        codeMapper.insert(record);

        // 顺手清掉一天前的废码，避免表无限增长
        codeMapper.delete(Wrappers.<EmailCode>lambdaQuery()
                .lt(EmailCode::getExpiredAt, now.minusDays(1)));

        boolean sent = mailService.sendCode(email, record.getCode(), scene);

        SendCodeVO vo = new SendCodeVO();
        vo.setEmail(maskEmail(email));
        vo.setSent(sent);
        vo.setDegraded(!sent);
        vo.setExpiresIn(TTL_MINUTES * 60);
        vo.setResendAfter(RESEND_SECONDS);
        vo.setMessage(sent
                ? "验证码已发送至 " + maskEmail(email) + "，5 分钟内有效"
                : "SMTP 未配置，验证码已打印到 user-service 日志（降级模式）");
        return vo;
    }

    /** 校验并消费验证码；任何一项不通过都抛 BizException */
    public void verify(String rawEmail, String rawPurpose, String code) {
        String email = normalizeEmail(rawEmail);
        String purpose = normalizePurpose(rawPurpose);

        if (!StringUtils.hasText(code)) {
            throw new BizException("请填写邮箱验证码");
        }

        EmailCode record = latest(email, purpose);
        // 没查到也报「验证码错误」，不泄露这个邮箱到底有没有发过码
        if (record == null) {
            throw new BizException("验证码错误或已失效，请重新获取");
        }
        if (record.getUsed() != null && record.getUsed() == 1) {
            throw new BizException("验证码已使用，请重新获取");
        }
        if (record.getExpiredAt() == null || record.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new BizException("验证码已过期，请重新获取");
        }
        if (!code.trim().equals(record.getCode())) {
            throw new BizException("验证码错误，请检查后重试");
        }

        // 条件更新：并发时只有一个人能把 used 从 0 改成 1
        int rows = codeMapper.update(null, Wrappers.<EmailCode>lambdaUpdate()
                .eq(EmailCode::getId, record.getId())
                .eq(EmailCode::getUsed, 0)
                .set(EmailCode::getUsed, 1));
        if (rows == 0) {
            throw new BizException("验证码已使用，请重新获取");
        }
    }

    // ==================== 内部工具 ====================

    private EmailCode latest(String email, String purpose) {
        return codeMapper.selectOne(Wrappers.<EmailCode>lambdaQuery()
                .eq(EmailCode::getEmail, email)
                .eq(EmailCode::getPurpose, purpose)
                .orderByDesc(EmailCode::getId)
                .last("limit 1"));
    }

    public String normalizeEmail(String rawEmail) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        if (!StringUtils.hasText(email)) {
            throw new BizException("请填写邮箱");
        }
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new BizException("邮箱格式不正确");
        }
        if (email.length() > 100) {
            throw new BizException("邮箱过长");
        }
        return email;
    }

    private String normalizePurpose(String purpose) {
        if (PURPOSE_LOGIN.equalsIgnoreCase(purpose)) {
            return PURPOSE_LOGIN;
        }
        if (PURPOSE_REGISTER.equalsIgnoreCase(purpose)) {
            return PURPOSE_REGISTER;
        }
        throw new BizException("验证码用途不正确");
    }

    private String sceneOf(String purpose) {
        return PURPOSE_LOGIN.equals(purpose) ? "登录" : "注册";
    }

    /** zhang***@qq.com，日志和接口返回都别暴露完整邮箱 */
    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) {
            return email;
        }
        String head = email.substring(0, Math.min(3, at));
        return head + "***" + email.substring(at);
    }
}
