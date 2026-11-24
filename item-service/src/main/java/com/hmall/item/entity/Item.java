package com.hmall.item.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("item")
public class Item {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    /** 卖点副标题 */
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
    /** 好评率（百分比整数） */
    private Integer goodRate;
    /** 营销标签：自营 / 秒杀 / 新品 / 热卖 */
    private String tag;
    /** 1 上架, 0 下架 */
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
