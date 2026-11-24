package com.hmall.item.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 秒杀订单：记录「谁抢到了哪场秒杀」，(activity_id, user_id) 唯一索引保证一人一单。
 * 抢到后随即在 order-service 建一张普通订单（order_id 存这里供对账）。
 */
@Data
@TableName("seckill_order")
public class SeckillOrder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long activityId;
    private Long userId;
    /** 关联的普通订单 id（order-service） */
    private Long orderId;
    private LocalDateTime createTime;
}
