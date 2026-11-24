package com.hmall.user.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 充值请求。
 */
@Data
@Schema(description = "充值请求")
public class RechargeDTO {

    @Schema(description = "充值金额（元），单笔 0.01 ~ 50000", example = "500")
    private BigDecimal amount;

    @Schema(description = "充值渠道：alipay / wechat / bank，默认 alipay", example = "alipay")
    private String channel;
}
