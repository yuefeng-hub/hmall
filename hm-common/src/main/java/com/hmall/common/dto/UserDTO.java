package com.hmall.common.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class UserDTO {
    private Long id;
    private String username;
    private String email;
    private BigDecimal balance;
    private String status;
}
