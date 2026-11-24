package com.hmall.order.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hmall.common.dto.ItemDTO;
import com.hmall.common.dto.OrderDTO;
import com.hmall.common.dto.OrderDetailDTO;
import com.hmall.common.dto.StockDTO;
import com.hmall.common.utils.CollUtils;
import com.hmall.order.dto.CreateOrderDTO;
import com.hmall.order.dto.SeckillCreateOrderDTO;
import com.hmall.order.entity.Order;
import com.hmall.order.entity.OrderDetail;
import com.hmall.order.exception.BizException;
import com.hmall.order.mapper.OrderDetailMapper;
import com.hmall.order.mapper.OrderMapper;
import com.hmall.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl extends ServiceImpl<OrderMapper, Order> implements OrderService {

    private final RestTemplate restTemplate;
    private final OrderDetailMapper detailMapper;

    @Value("${hmall.remote.item-url}")
    private String itemUrl;
    @Value("${hmall.remote.cart-url}")
    private String cartUrl;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDTO createOrder(Long userId, CreateOrderDTO dto) {
        // 1. 归一化「商品 -> 数量」：购物车里买 2 件就必须按 2 件算钱、扣库存。
        //    同一个 itemId 重复出现时合并累加，避免一次请求扣两次库存
        Map<Long, Integer> quantities = OrderServiceImpl.normalizeItems(dto);
        List<Long> ids = new ArrayList<>(quantities.keySet());

        // 2. 远程查询商品，价格与库存一律以服务端为准，不信任前端传来的金额
        List<ItemDTO> items = queryItems(ids);
        if (CollUtils.isEmpty(items)) {
            throw new BizException("商品不存在或已下架");
        }
        Map<Long, ItemDTO> itemMap = items.stream()
                .collect(Collectors.toMap(ItemDTO::getId, Function.identity(), (a, b) -> a));
        validateItems(quantities, itemMap);
        BigDecimal total = OrderServiceImpl.calculateTotal(quantities, itemMap);

        // 3. 创建订单（主表 + 明细，同一个本地事务）
        Order order = new Order();
        order.setUserId(userId);
        order.setTotalFee(total);
        order.setPayType(1);
        order.setStatus(1);
        order.setAddress(dto.getAddress());
        order.setCreateTime(LocalDateTime.now());
        order.setUpdateTime(LocalDateTime.now());
        save(order);

        List<OrderDetail> details = new ArrayList<>();
        List<StockDTO> stocks = new ArrayList<>();
        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            ItemDTO item = itemMap.get(entry.getKey());
            int num = entry.getValue();
            OrderDetail d = new OrderDetail();
            d.setOrderId(order.getId());
            d.setItemId(item.getId());
            d.setName(item.getName());
            d.setPrice(item.getPrice());
            d.setNum(num);
            d.setImage(item.getImage());
            detailMapper.insert(d);
            details.add(d);
            stocks.add(new StockDTO(item.getId(), num));
        }

        // 4. 远程扣减库存（条件更新，失败抛异常让本地事务回滚）
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", String.valueOf(userId));
        HttpEntity<List<StockDTO>> entity = new HttpEntity<>(stocks, headers);
        ResponseEntity<Boolean> resp = restTemplate.exchange(
                itemUrl + "/items/stock/deduct", HttpMethod.PUT, entity, Boolean.class);
        if (!resp.getStatusCode().is2xxSuccessful() || !Boolean.TRUE.equals(resp.getBody())) {
            throw new BizException("库存扣减失败，下单已取消");
        }

        // 5. 远程清理购物车中已下单的商品
        try {
            restTemplate.exchange(
                    cartUrl + "/carts/items?itemIds={ids}", HttpMethod.DELETE,
                    new HttpEntity<>(headers), Void.class,
                    Map.of("ids", CollUtils.join(ids, ",")));
        } catch (Exception e) {
            // 清购物车失败不回滚订单：用户已下单成功，商品页面按订单状态过滤即可
            log.warn("清理购物车失败，orderId={}, {}", order.getId(), e.getMessage());
        }
        return toDTO(order, details);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDTO createSeckillOrder(Long userId, SeckillCreateOrderDTO dto) {
        if (dto == null || dto.getItemId() == null) {
            throw new BizException("秒杀商品不能为空");
        }
        if (dto.getSeckillPrice() == null || dto.getSeckillPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BizException("秒杀价格不合法");
        }
        // 查商品只为了拿名称/图/卖点等展示字段，金额一律用秒杀价，不扣商品日常库存
        List<ItemDTO> items = queryItems(Collections.singletonList(dto.getItemId()));
        if (CollUtils.isEmpty(items)) {
            throw new BizException("商品不存在或已下架");
        }
        ItemDTO item = items.get(0);

        Order order = new Order();
        order.setUserId(userId);
        order.setTotalFee(dto.getSeckillPrice());
        order.setPayType(1);
        order.setStatus(1);
        order.setOrderType(2);              // 秒杀单：取消/超时取消时不回补商品库存
        order.setAddress(dto.getAddress());
        order.setCreateTime(LocalDateTime.now());
        order.setUpdateTime(LocalDateTime.now());
        save(order);

        OrderDetail detail = new OrderDetail();
        detail.setOrderId(order.getId());
        detail.setItemId(item.getId());
        detail.setName(item.getName());
        detail.setPrice(dto.getSeckillPrice());
        detail.setNum(1);
        detail.setImage(item.getImage());
        detailMapper.insert(detail);

        log.info("秒杀订单 {} 已创建，商品 {} 秒杀价 {}", order.getId(), item.getName(), dto.getSeckillPrice());
        return toDTO(order, Collections.singletonList(detail));
    }

    /**
     * 把新版 items 与旧版 itemIds 统一成「itemId -> 数量」，并做数量合法性校验。
     * 抽成无副作用的静态方法，方便在不启动 Spring 容器的单测里覆盖各种入参。
     */
    static Map<Long, Integer> normalizeItems(CreateOrderDTO dto) {
        if (dto == null) {
            throw new BizException("下单商品不能为空");
        }
        List<CreateOrderDTO.OrderItem> source = dto.getItems();
        if (CollUtils.isEmpty(source)) {
            if (CollUtils.isEmpty(dto.getItemIds())) {
                throw new BizException("下单商品不能为空");
            }
            // 兼容只传 itemIds 的老调用（requests.http / 早期客户端）：每件按 1 处理
            source = dto.getItemIds().stream()
                    .map(id -> new CreateOrderDTO.OrderItem(id, 1))
                    .collect(Collectors.toList());
        }
        Map<Long, Integer> merged = new LinkedHashMap<>();
        for (CreateOrderDTO.OrderItem it : source) {
            if (it == null || it.getItemId() == null) {
                throw new BizException("下单商品 id 不能为空");
            }
            int num = it.getNum() == null ? 1 : it.getNum();
            if (num <= 0) {
                throw new BizException("商品数量必须大于 0: itemId=" + it.getItemId());
            }
            merged.merge(it.getItemId(), num, Integer::sum);
        }
        if (merged.isEmpty()) {
            throw new BizException("下单商品不能为空");
        }
        return merged;
    }

    /** 上架状态与库存校验，失败抛业务异常让整个下单事务回滚 */
    static void validateItems(Map<Long, Integer> quantities, Map<Long, ItemDTO> itemMap) {
        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            ItemDTO item = itemMap.get(entry.getKey());
            if (item == null) {
                throw new BizException("商品不存在或已下架: id=" + entry.getKey());
            }
            if (item.getStatus() != null && item.getStatus() == 0) {
                throw new BizException("商品已下架: " + item.getName());
            }
            int num = entry.getValue();
            if (item.getStock() == null || item.getStock() < num) {
                throw new BizException("商品库存不足: " + item.getName() + "（需要 " + num + " 件）");
            }
        }
    }

    /** 纯函数：按「商品 -> 数量」和服务端价格算总价，前端传来的金额一概不信 */
    static BigDecimal calculateTotal(Map<Long, Integer> quantities, Map<Long, ItemDTO> itemMap) {
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            ItemDTO item = itemMap.get(entry.getKey());
            if (item == null) {
                throw new BizException("商品不存在或已下架: id=" + entry.getKey());
            }
            BigDecimal price = item.getPrice() == null ? BigDecimal.ZERO : item.getPrice();
            total = total.add(price.multiply(BigDecimal.valueOf(entry.getValue())));
        }
        return total;
    }

    private List<ItemDTO> queryItems(List<Long> ids) {
        ResponseEntity<List<ItemDTO>> resp = restTemplate.exchange(
                itemUrl + "/items?ids={ids}", HttpMethod.GET, null,
                new ParameterizedTypeReference<List<ItemDTO>>() {
                }, Map.of("ids", CollUtils.join(ids, ",")));
        if (!resp.getStatusCode().is2xxSuccessful()) {
            throw new BizException("商品服务调用失败");
        }
        return resp.getBody();
    }

    @Override
    public OrderDTO queryOrder(Long id) {
        Order order = getById(id);
        if (order == null) {
            throw new BizException("订单不存在: id=" + id);
        }
        List<OrderDetail> details = detailMapper.selectList(
                com.baomidou.mybatisplus.core.toolkit.Wrappers.<OrderDetail>lambdaQuery()
                        .eq(OrderDetail::getOrderId, id));
        return toDTO(order, details);
    }

    @Override
    public List<OrderDTO> queryMyOrders(Long userId, int limit) {
        int size = limit <= 0 ? 20 : Math.min(limit, 100);
        List<Order> orders = list(Wrappers.<Order>lambdaQuery()
                .eq(Order::getUserId, userId)
                .orderByDesc(Order::getId)
                .last("limit " + size));
        if (CollUtils.isEmpty(orders)) {
            return Collections.emptyList();
        }
        // 一次性把明细查出来再按订单分组，避免 N+1 查询
        List<Long> orderIds = orders.stream().map(Order::getId).collect(Collectors.toList());
        List<OrderDetail> allDetails = detailMapper.selectList(
                Wrappers.<OrderDetail>lambdaQuery().in(OrderDetail::getOrderId, orderIds));
        Map<Long, List<OrderDetail>> grouped = allDetails.stream()
                .collect(Collectors.groupingBy(OrderDetail::getOrderId));
        return orders.stream()
                .map(o -> toDTO(o, grouped.getOrDefault(o.getId(), Collections.emptyList())))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDTO cancelOrder(Long userId, Long id) {
        Order order = getById(id);
        if (order == null) {
            throw new BizException("订单不存在: id=" + id, 404);
        }
        if (order.getUserId() != null && !order.getUserId().equals(userId)) {
            throw new BizException("无权操作他人的订单", 403);
        }
        if (order.getStatus() != null && order.getStatus() == 2) {
            throw new BizException("订单已支付，无法取消");
        }
        if (order.getStatus() != null && order.getStatus() == 3) {
            throw new BizException("订单已取消，无需重复操作");
        }
        // 条件更新：只有仍在「待支付」的订单才会被这次请求改掉。
        // 用户连点两次「取消」时只有一次能拿到 rows=1，库存就不会被重复回补
        LocalDateTime now = LocalDateTime.now();
        int rows = baseMapper.update(null, Wrappers.<Order>lambdaUpdate()
                .set(Order::getStatus, 3)
                .set(Order::getUpdateTime, now)
                .eq(Order::getId, id)
                .eq(Order::getStatus, 1));
        if (rows == 0) {
            throw new BizException("订单状态已变更，请刷新后重试", 409);
        }
        // 回补库存。放在本地改状态之后：远程失败就抛异常把本地事务回滚，
        // 订单退回「待支付」，不会留下"订单已取消但库存没还回来"的脏数据
        // 秒杀单（orderType=2）不扣过商品日常库存，取消时也不回补（秒杀库存独立预扣在 item-service）
        List<OrderDetail> details = detailMapper.selectList(
                Wrappers.<OrderDetail>lambdaQuery().eq(OrderDetail::getOrderId, id));
        if (!CollUtils.isEmpty(details) && (order.getOrderType() == null || order.getOrderType() != 2)) {
            List<StockDTO> stocks = details.stream()
                    .map(d -> new StockDTO(d.getItemId(), d.getNum()))
                    .collect(Collectors.toList());
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Id", String.valueOf(userId));
            try {
                ResponseEntity<Boolean> resp = restTemplate.exchange(
                        itemUrl + "/items/stock/restore", HttpMethod.PUT,
                        new HttpEntity<>(stocks, headers), Boolean.class);
                if (!resp.getStatusCode().is2xxSuccessful() || !Boolean.TRUE.equals(resp.getBody())) {
                    throw new BizException("库存回补失败，订单取消失败");
                }
            } catch (BizException e) {
                throw e;
            } catch (Exception e) {
                log.error("取消订单 {} 回补库存失败: {}", id, e.getMessage());
                throw new BizException("商品服务暂不可用，请稍后重试");
            }
        }
        order.setStatus(3);
        order.setUpdateTime(now);
        log.info("订单 {} 已取消，回补 {} 种商品库存", id, details == null ? 0 : details.size());
        return toDTO(order, details);
    }

    @Override
    public void updateStatus(Long id, Integer status) {
        Order order = getById(id);
        if (order == null) {
            throw new BizException("订单不存在: id=" + id);
        }
        if (order.getStatus() != null && order.getStatus() == 2 && status != null && status == 2) {
            return; // 幂等：已经是已支付，重复通知直接返回
        }
        if (order.getStatus() != null && order.getStatus() == 3 && status != null && status == 2) {
            throw new BizException("订单已取消，不能置为已支付");
        }
        order.setStatus(status);
        if (status != null && status == 2) {
            order.setPayTime(LocalDateTime.now());
        }
        order.setUpdateTime(LocalDateTime.now());
        updateById(order);
    }

    private OrderDTO toDTO(Order order, List<OrderDetail> details) {
        OrderDTO dto = new OrderDTO();
        BeanUtils.copyProperties(order, dto);
        List<OrderDetailDTO> dtos = details.stream().map(d -> {
            OrderDetailDTO od = new OrderDetailDTO();
            BeanUtils.copyProperties(d, od);
            return od;
        }).collect(Collectors.toList());
        dto.setDetails(dtos);
        return dto;
    }
}
