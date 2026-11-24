package com.hmall.common.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 秒杀活动：一个商品在某时间窗内以秒杀价限量出售。
 * 前端倒计时、抢购按钮、剩余库存都靠这个对象渲染。
 */
@Data
public class SeckillActivityDTO {
    private Long id;
    /** 参与秒杀的商品 id */
    private Long itemId;
    /** 秒杀价（原价在 item 表里） */
    private BigDecimal seckillPrice;
    /** 秒杀库存（独立于商品日常库存，扣完即止） */
    private Integer stock;
    /** 活动开始时间 */
    private LocalDateTime startTime;
    /** 活动结束时间 */
    private LocalDateTime endTime;
    /** 1 进行中, 0 未开始/已结束/下架 */
    private Integer status;
    /** 活动标题，如「华为手机 5 折秒杀」 */
    private String title;

    // ---- 下面是查询时从 item 表 join 出来的展示字段 ----
    private String name;
    private String subtitle;
    private String image;
    private String brand;
    private BigDecimal price;
    /** 剩余秒杀名额 */
    private Integer remain;
    /** 当前用户是否已抢到过（一人一单） */
    private Boolean grabbed;
}
