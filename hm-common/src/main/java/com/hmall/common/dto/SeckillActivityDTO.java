package com.hmall.common.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 秒杀活动：一个商品在当前场次以秒杀价限量出售。
 * 前端场次条、倒计时、库存进度条、抢购按钮都靠这个对象渲染。
 */
@Data
public class SeckillActivityDTO {
    private Long id;
    /** 参与秒杀的商品 id */
    private Long itemId;
    /** 秒杀价（原价在 item 表里） */
    private BigDecimal seckillPrice;
    /** 本场剩余库存（独立于商品日常库存，扣完即止） */
    private Integer stock;
    /** 本场初始库存，用来算「已抢 N / 共 M」的进度条 */
    private Integer initStock;
    /** 本场已抢出多少件 */
    private Integer sold;
    /** 场次分组号 */
    private Integer slotNo;
    /** 第几轮（同一批活动每 N 分钟一轮） */
    private Long roundNo;
    /** 本场开始时间（服务端按轮次实时算出，不是库里写死的值） */
    private LocalDateTime startTime;
    /** 本场结束时间 */
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
    /** 剩余秒杀名额（与 stock 同值，保留老前端字段名） */
    private Integer remain;
    /** 当前用户本轮是否已抢到 */
    private Boolean grabbed;
}
