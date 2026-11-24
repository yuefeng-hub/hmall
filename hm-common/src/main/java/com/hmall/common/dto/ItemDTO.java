package com.hmall.common.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class ItemDTO {
    private Long id;
    private String name;
    /** 卖点副标题，列表页展示在标题下方 */
    private String subtitle;
    private BigDecimal price;
    private Integer stock;
    private String image;
    private String category;
    private String brand;
    /** 累计销量 */
    private Integer sales;
    /** 评价数 */
    private Integer commentCount;
    /** 好评率（百分比整数，如 98） */
    private Integer goodRate;
    /** 营销标签：自营 / 秒杀 / 新品 / 热卖 */
    private String tag;
    /** 1 上架, 0 下架 */
    private Integer status;
}
