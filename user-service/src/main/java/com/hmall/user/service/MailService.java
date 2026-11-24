package com.hmall.user.service;

import com.hmall.user.exception.BizException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.mail.internet.MimeMessage;

/**
 * 邮件发送。
 *
 * 关键设计：没配授权码也要能用。
 * 本地开发 / 演示 / 自动化测试都拿不到 QQ 授权码，如果这时直接抛异常，
 * 整个注册登录链路就没法跑。所以未配置时走「降级模式」——验证码只打日志，
 * 业务照常进行；启动时打一段醒目告警，避免上线忘配还静默降级。
 */
@Service
public class MailService implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.host:}")
    private String host;

    @Value("${spring.mail.username:}")
    private String username;

    @Value("${spring.mail.password:}")
    private String password;

    @Override
    public void afterPropertiesSet() {
        if (ready()) {
            log.info("QQ SMTP 已就绪，发件账号 {}", username);
            return;
        }
        if (StringUtils.hasText(username) && !StringUtils.hasText(password)) {
            // 典型的「填了邮箱忘了授权码」：如果不单独提示，会走真实发送然后每封都 500
            log.warn("========================================================");
            log.warn("MAIL_USERNAME 已配置（{}），但 MAIL_PASSWORD 为空", username);
            log.warn("QQ 邮箱必须用「设置-账户-POP3/SMTP」生成的 16 位授权码，不是登录密码");
            log.warn("当前按降级模式运行：验证码不会真的发出，只打印在本日志里");
            log.warn("========================================================");
            return;
        }
        log.warn("========================================================");
        log.warn("SMTP 未配置：验证码不会真的发出，只打印在本日志里（降级模式）");
        log.warn("要真实发信，在 user-service/src/main/resources/application-local.yml 里填：");
        log.warn("  MAIL_USERNAME: 你的QQ邮箱@qq.com");
        log.warn("  MAIL_PASSWORD: QQ邮箱「设置-账户-POP3/SMTP」生成的16位授权码");
        log.warn("========================================================");
    }

    /** 是否具备真实发信能力。缺少授权码也算不具备——半配的账号发出去必然失败 */
    public boolean ready() {
        return mailSender != null && StringUtils.hasText(host)
                && StringUtils.hasText(username) && StringUtils.hasText(password);
    }

    /**
     * 发送验证码。
     *
     * @return true 表示真的投递出去了；false 表示当前是降级模式，码只在日志里
     */
    public boolean sendCode(String to, String code, String scene) {
        if (!ready()) {
            log.info("【降级模式】邮箱 {} 的{}验证码：code={}（5 分钟内有效）", to, scene, code);
            return false;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(username);
            helper.setTo(to);
            helper.setSubject("【黑马商城】" + scene + "验证码 " + code);
            helper.setText(buildHtml(code, scene), true);
            mailSender.send(message);
            log.info("{}验证码已投递到 {}", scene, to);
            return true;
        } catch (Exception e) {
            // 配了授权码却发不出去，必须让用户看到，不能假装成功
            log.error("向 {} 发送验证码失败: {}", to, e.getMessage(), e);
            throw new BizException("邮件发送失败，请稍后重试或联系管理员检查邮箱配置", 500);
        }
    }

    private String buildHtml(String code, String scene) {
        return "<div style=\"font-family:-apple-system,'Microsoft YaHei',sans-serif;max-width:520px;"
                + "margin:0 auto;padding:28px;border:1px solid #eee;border-radius:10px\">"
                + "<h2 style=\"color:#e1251b;margin:0 0 6px\">黑马商城</h2>"
                + "<p style=\"color:#666;margin:0 0 22px;font-size:13px\">hmall 微服务演示 · "
                + scene + "验证</p>"
                + "<p style=\"font-size:14px;color:#333\">你正在进行" + scene + "操作，验证码是：</p>"
                + "<p style=\"font-size:32px;letter-spacing:10px;font-weight:700;color:#e1251b;"
                + "margin:14px 0\">" + code + "</p>"
                + "<p style=\"font-size:13px;color:#999\">5 分钟内有效，请勿转发给他人。"
                + "如果不是你本人操作，忽略本邮件即可。</p></div>";
    }
}
