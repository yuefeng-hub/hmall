package com.hmall.order.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
public class CreateOrderDTO {

    private String address;

    /** 兼容旧调用：只传 itemIds 时每件数量按 1 处理 */
    private List<Long> itemIds;

    /** 推荐：带数量的商品列表，购物车里买 2 件就真的是 2 件 */
    private List<OrderItem> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItem {
        private Long itemId;
        private Integer num;
    }
}
