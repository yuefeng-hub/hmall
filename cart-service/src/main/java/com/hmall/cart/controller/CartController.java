package com.hmall.cart.controller;

import com.hmall.cart.dto.CartForm;
import com.hmall.cart.service.CartService;
import com.hmall.cart.vo.CartVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "购物车服务")
@RestController
@RequestMapping("/carts")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @Operation(summary = "查询我的购物车（商品信息由 item-service 远程补齐）")
    @GetMapping
    public List<CartVO> queryMyCarts(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {
        return cartService.queryMyCarts(userId);
    }

    @Operation(summary = "加入购物车")
    @PostMapping
    public void addCart(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                        @RequestBody CartForm form) {
        cartService.addCart(userId, form);
    }

    @Operation(summary = "修改购物车数量")
    @PutMapping
    public void updateNum(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                          @RequestBody CartForm form) {
        cartService.updateNum(userId, form);
    }

    @Operation(summary = "按购物车 id 批量删除")
    @DeleteMapping
    public void deleteByIds(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                            @RequestParam("ids") List<Long> ids) {
        cartService.deleteByIds(userId, ids);
    }

    @Operation(summary = "按商品 id 批量删除（下单后清理购物车用）")
    @DeleteMapping("/items")
    public void deleteByItemIds(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                                @RequestParam("itemIds") List<Long> itemIds) {
        cartService.deleteByItemIds(userId, itemIds);
    }
}
