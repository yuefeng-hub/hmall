package com.hmall.cart.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CartVO {
    private Long id;
    private Long itemId;
    private Integer num;
    /** 加入购物车时的价格，可能过期 */
    private BigDecimal price;
    private String name;
    private String image;
    /** 商品服务返回的当前价格 */
    private BigDecimal newPrice;
    /** 商品服务返回的库存 */
    private Integer stock;
    /** 商品服务返回的上下架状态：1 上架 0 下架 */
    private Integer status;
}
