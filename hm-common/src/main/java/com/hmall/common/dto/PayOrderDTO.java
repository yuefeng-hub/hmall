package com.hmall.common.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class PayOrderDTO {
    private String payOrderNo;
    private Long orderId;
    private Long userId;
    private BigDecimal amount;
    /** 0 待支付, 1 已支付, 2 已失败 */
    private Integer status;
    private LocalDateTime payTime;
}
