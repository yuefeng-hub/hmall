package com.hmall.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 充值流水。
 */
@Data
@TableName("recharge_record")
public class RechargeRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** 充值流水号，形如 RC20261110100724001 */
    private String rechargeNo;

    private BigDecimal amount;

    /** alipay / wechat / bank */
    private String channel;

    /** 1 成功 */
    private Integer status;

    private LocalDateTime createTime;
}
