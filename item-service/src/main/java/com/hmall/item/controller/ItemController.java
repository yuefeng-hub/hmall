package com.hmall.item.controller;

import com.hmall.common.dto.ItemDTO;
import com.hmall.common.dto.StockDTO;
import com.hmall.item.entity.Item;
import com.hmall.item.service.ItemService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@Tag(name = "商品服务")
@RestController
@RequestMapping("/items")
@RequiredArgsConstructor
public class ItemController {

    private final ItemService itemService;

    @Operation(summary = "商品列表：分类筛选 + 关键词搜索（首页用）")
    @GetMapping("/search")
    public List<ItemDTO> search(@RequestParam(value = "category", required = false) String category,
                                @RequestParam(value = "keyword", required = false) String keyword,
                                @RequestParam(value = "limit", defaultValue = "60") int limit) {
        return itemService.search(category, keyword, limit);
    }

    @Operation(summary = "全部一级分类（左侧导航用）")
    @GetMapping("/categories")
    public List<String> categories() {
        return itemService.categories();
    }

    @Operation(summary = "根据 id 批量查询商品")
    @GetMapping
    public List<ItemDTO> queryByIds(@RequestParam("ids") List<Long> ids) {
        return itemService.queryByIds(ids);
    }

    @Operation(summary = "根据 id 查询单个商品")
    // 限定成数字，避免 /items/search 这类字面量路径被当成 {id} 吃了
    @GetMapping("/{id:\\d+}")
    public ItemDTO queryById(@PathVariable("id") Long id) {
        return itemService.queryById(id);
    }

    @Operation(summary = "新增商品（初始化数据用）")
    @PostMapping
    public ItemDTO save(@RequestBody Item item) {
        item.setId(null);
        item.setCreateTime(LocalDateTime.now());
        item.setUpdateTime(LocalDateTime.now());
        itemService.save(item);
        ItemDTO dto = new ItemDTO();
        BeanUtils.copyProperties(item, dto);
        return dto;
    }

    @Operation(summary = "批量扣减库存")
    @PutMapping("/stock/deduct")
    public boolean deductStock(@RequestBody List<StockDTO> list) {
        return itemService.deductStock(list);
    }

    @Operation(summary = "批量回补库存（取消订单）")
    @PutMapping("/stock/restore")
    public boolean restoreStock(@RequestBody List<StockDTO> list) {
        return itemService.restoreStock(list);
    }
}
