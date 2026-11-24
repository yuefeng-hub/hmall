package com.hmall.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 秒杀抢购结果。抢到返回 orderId 供前端跳支付；没抢到返回 failReason。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeckillResultDTO {
    /** true=抢到，false=没抢到 */
    private Boolean success;
    /** 抢到后生成的普通订单 id */
    private Long orderId;
    /** 秒杀价（下单金额） */
    private BigDecimal price;
    /** 没抢到时的原因：已售罄 / 已抢过 / 未开始 / 已结束 / 商品不存在 */
    private String failReason;
}
