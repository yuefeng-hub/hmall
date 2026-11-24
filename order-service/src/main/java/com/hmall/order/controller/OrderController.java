package com.hmall.order.controller;

import com.hmall.common.dto.OrderDTO;
import com.hmall.order.dto.CreateOrderDTO;
import com.hmall.order.dto.SeckillCreateOrderDTO;
import com.hmall.order.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "订单服务")
@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @Operation(summary = "创建订单（建单 + 扣库存 + 清购物车）")
    @PostMapping
    public OrderDTO createOrder(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                                @RequestBody CreateOrderDTO dto) {
        return orderService.createOrder(userId, dto);
    }

    @Operation(summary = "秒杀下单（item-service 抢购成功后回调，按秒杀价结算）")
    @PostMapping("/seckill")
    public OrderDTO createSeckillOrder(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                                       @RequestBody SeckillCreateOrderDTO dto) {
        return orderService.createSeckillOrder(userId, dto);
    }

    @Operation(summary = "我的订单列表（按下单时间倒序）")
    @GetMapping
    public List<OrderDTO> queryMyOrders(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                                        @RequestParam(value = "limit", defaultValue = "20") int limit) {
        return orderService.queryMyOrders(userId, limit);
    }

    @Operation(summary = "查询订单详情")
    @GetMapping("/{id}")
    public OrderDTO queryOrder(@PathVariable("id") Long id) {
        return orderService.queryOrder(id);
    }

    @Operation(summary = "取消订单（仅待支付可取消，回补库存）")
    @PutMapping("/{id}/cancel")
    public OrderDTO cancelOrder(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                                @PathVariable("id") Long id) {
        return orderService.cancelOrder(userId, id);
    }

    @Operation(summary = "修改订单状态（支付服务回调）")
    @PutMapping("/{id}/status")
    public void updateStatus(@PathVariable("id") Long id, @RequestParam("status") Integer status) {
        orderService.updateStatus(id, status);
    }
}
