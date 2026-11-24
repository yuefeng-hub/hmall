package com.hmall.pay.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("pay_order")
public class PayOrder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String payOrderNo;
    private Long orderId;
    private Long userId;
    private BigDecimal amount;
    /** 0 待支付, 1 已支付, 2 已失败 */
    private Integer status;
    private LocalDateTime payTime;
    private LocalDateTime createTime;
}
