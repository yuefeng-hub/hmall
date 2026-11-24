package com.hmall.cart.dto;

import lombok.Data;

@Data
public class CartForm {
    private Long id;
    private Long itemId;
    private Integer num;
}
