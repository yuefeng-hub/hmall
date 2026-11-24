package com.hmall.common.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderDTO {
    private Long id;
    private Long userId;
    private BigDecimal totalFee;
    private Integer payType;
    /** 1 待支付, 2 已支付, 3 已取消 */
    private Integer status;
    /** 1 普通订单, 2 秒杀订单 */
    private Integer orderType;
    private String address;
    private LocalDateTime createTime;
    private LocalDateTime payTime;
    private List<OrderDetailDTO> details;
}
