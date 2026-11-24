package com.hmall.item.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hmall.common.dto.ItemDTO;
import com.hmall.item.entity.Item;

import java.util.List;

public interface ItemService extends IService<Item> {

    List<ItemDTO> queryByIds(List<Long> ids);

    ItemDTO queryById(Long id);

    /**
     * 首页/搜索页的商品列表：按分类过滤 + 关键词模糊匹配（名称、品牌、卖点）。
     * category 传空或「全部」表示不筛分类。
     */
    List<ItemDTO> search(String category, String keyword, int limit);

    /** 全部一级分类（按商品数量倒序），给左侧导航用 */
    List<String> categories();

    /** 批量扣减库存，任一商品库存不足则整体回滚 */
    boolean deductStock(List<com.hmall.common.dto.StockDTO> list);

    /** 批量回补库存（取消订单时调用），纯加法不会失败 */
    boolean restoreStock(List<com.hmall.common.dto.StockDTO> list);
}
