package com.hmall.order.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 秒杀下单：由 item-service 抢购成功后回调，携带秒杀价。
 * 与普通下单的区别：金额按秒杀价（seckillPrice）结算，而不是商品原价。
 */
@Data
public class SeckillCreateOrderDTO {
    private Long itemId;
    /** 秒杀价，服务端以它结算（item-service 抢购成功时透传） */
    private BigDecimal seckillPrice;
    private String address;
}
