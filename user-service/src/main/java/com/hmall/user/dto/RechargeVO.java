package com.hmall.user.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 充值结果：返回本次流水号与充值后的余额，前端直接展示。
 *
 * <p>充值记录列表复用这个 DTO，但没有「充值后余额」这个值，
 * 用 NON_NULL 把空字段省掉，避免前端拿到一堆 {@code "balance": null}。
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "充值结果")
public class RechargeVO {

    @Schema(description = "充值流水号")
    private String rechargeNo;

    @Schema(description = "本次充值金额")
    private BigDecimal amount;

    @Schema(description = "充值后余额")
    private BigDecimal balance;

    @Schema(description = "渠道编码")
    private String channel;

    @Schema(description = "渠道名称")
    private String channelName;

    @Schema(description = "充值时间 yyyy-MM-dd HH:mm:ss")
    private String createTime;
}
