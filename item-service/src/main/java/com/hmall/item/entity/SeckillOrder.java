package com.hmall.item.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 秒杀订单：记录「谁在第几轮抢到了哪个活动」，(activity_id, user_id, round_no) 唯一索引
 * 保证一人一轮只能抢一单。抢到后随即在 order-service 建一张普通订单。
 */
@Data
@TableName("seckill_order")
public class SeckillOrder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long activityId;
    private Long userId;
    /** 第几轮：同一批活动每 round-minutes 分钟再来一轮，用户下一轮可以再抢 */
    private Long roundNo;
    /** 关联的普通订单 id（order-service） */
    private Long orderId;
    private LocalDateTime createTime;
}
