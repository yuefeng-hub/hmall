package com.hmall.item.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 秒杀活动：一个商品以秒杀价限量出售。秒杀库存独立于商品日常库存，扣完即止。
 *
 * <p>「什么时候开抢」不再看 startTime/endTime，而是看 {@code slotNo}：
 * 服务端按「当前分钟 / 每场分钟数 % 组数」算出当前该开哪一组，只取这一组的活动。
 * 于是场次会自动一轮一轮往下转，服务放多久再开都有进行中的场次。
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
    /** 本场初始库存：算「已抢 N / 共 M」和进度条，重置本场时也回到这个值 */
    private Integer initStock;
    /** 场次分组号 0..组数-1，同组同时开抢 */
    private Integer slotNo;
    /** 保留字段：开抢时间由服务端按场次实时算，不再作为判定依据 */
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    /** 1 上架, 0 下架 */
    private Integer status;
    /** 活动标题 */
    private String title;
    private LocalDateTime createTime;
}
