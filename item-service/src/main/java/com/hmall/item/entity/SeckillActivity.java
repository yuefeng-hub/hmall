package com.hmall.item.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 秒杀活动：一个商品在某时间窗内以秒杀价限量出售。
 * 秒杀库存独立于商品日常库存，扣完即止。
 */
@Data
@TableName("seckill_activity")
public class SeckillActivity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long itemId;
    /** 秒杀价（商品原价在 item 表） */
    private BigDecimal seckillPrice;
    /** 秒杀库存，原子扣减，扣到 0 即售罄 */
    private Integer stock;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    /** 1 进行中, 0 已下架/结束 */
    private Integer status;
    /** 活动标题 */
    private String title;
    private LocalDateTime createTime;
}
