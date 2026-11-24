package com.hmall.order.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hmall.common.dto.OrderDTO;
import com.hmall.order.dto.CreateOrderDTO;
import com.hmall.order.dto.SeckillCreateOrderDTO;
import com.hmall.order.entity.Order;

import java.util.List;

public interface OrderService extends IService<Order> {

    OrderDTO createOrder(Long userId, CreateOrderDTO dto);

    /**
     * 秒杀下单：金额按秒杀价结算，不扣商品日常库存（秒杀库存已在 item-service 原子扣过）。
     * 秒杀单 order_type=2，取消/超时取消时也不回补商品库存。
     */
    OrderDTO createSeckillOrder(Long userId, SeckillCreateOrderDTO dto);

    OrderDTO queryOrder(Long id);

    /** 我的订单列表（按下单时间倒序，含明细） */
    List<OrderDTO> queryMyOrders(Long userId, int limit);

    /** 取消订单：仅待支付可取消，取消后回补库存 */
    OrderDTO cancelOrder(Long userId, Long id);

    void updateStatus(Long id, Integer status);
}
