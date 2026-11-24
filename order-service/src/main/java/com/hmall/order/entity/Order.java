package com.hmall.order.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("orders")
public class Order {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private BigDecimal totalFee;
    private Integer payType;
    /** 1 待支付, 2 已支付, 3 已取消 */
    private Integer status;
    /** 1 普通订单, 2 秒杀订单（秒杀单不扣商品日常库存，取消也不回补） */
    private Integer orderType;
    private String address;
    private LocalDateTime createTime;
    private LocalDateTime payTime;
    private LocalDateTime updateTime;
}
