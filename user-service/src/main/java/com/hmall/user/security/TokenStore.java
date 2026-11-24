package com.hmall.user.security;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.hmall.user.entity.UserToken;
import com.hmall.user.mapper.UserTokenMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 落库的极简令牌存储。
 *
 * <p>演示项目不引入 JWT 依赖，登录用 {@link #issue(Long)} 发一个 UUID 令牌，
 * 后续请求带 {@code X-Token} 头即可换回用户 ID。令牌 24 小时过期。
 *
 * <p>原来是内存 ConcurrentHashMap，业务数据改成 H2 文件库之后，重启服务会把所有人踢回登录页，
 * 所以令牌也一起落库：重启后前端 localStorage 里的 token 仍然可用，体验是连续的。
 */
@Component
@RequiredArgsConstructor
public class TokenStore {

    /** 令牌有效期：24 小时 */
    public static final long TTL_SECONDS = 24 * 60 * 60L;

    private final UserTokenMapper tokenMapper;

    /** 签发令牌（顺手清掉过期行，避免表无限膨胀） */
    public String issue(Long userId) {
        tokenMapper.delete(Wrappers.<UserToken>lambdaQuery()
                .lt(UserToken::getExpiresAt, LocalDateTime.now()));
        String token = UUID.randomUUID().toString().replace("-", "");
        LocalDateTime now = LocalDateTime.now();
        UserToken entity = new UserToken();
        entity.setToken(token);
        entity.setUserId(userId);
        entity.setCreateTime(now);
        entity.setExpiresAt(now.plusSeconds(TTL_SECONDS));
        tokenMapper.insert(entity);
        return token;
    }

    /** 换取用户 ID，令牌无效或过期返回 null */
    public Long resolve(String token) {
        if (token == null || token.isEmpty()) {
            return null;
        }
        UserToken entity = tokenMapper.selectById(token);
        if (entity == null) {
            return null;
        }
        if (entity.getExpiresAt() == null || entity.getExpiresAt().isBefore(LocalDateTime.now())) {
            tokenMapper.deleteById(token);
            return null;
        }
        return entity.getUserId();
    }

    /** 主动注销 */
    public void revoke(String token) {
        if (token != null && !token.isEmpty()) {
            tokenMapper.deleteById(token);
        }
    }
}
