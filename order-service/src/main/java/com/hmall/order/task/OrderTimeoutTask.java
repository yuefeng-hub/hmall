package com.hmall.order.task;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.hmall.common.utils.CollUtils;
import com.hmall.order.entity.Order;
import com.hmall.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 超时未支付订单自动取消：扫描「待支付且创建时间早于 deadline」的订单，
 * 复用 {@link OrderService#cancelOrder} 逐笔取消并回补库存。
 *
 * <p>订单落 H2 文件库之后，服务重启不会丢单 —— 定时任务也因此能接着扫历史待支付单，
 * 不会出现「订单永远卡在待支付、库存一直被占着」的情况。
 *
 * <p>一条失败不影响其它订单，下一轮调度会重试；与用户手动支付的并发由
 * cancelOrder 里的 {@code where status=1} 条件更新兜底。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderTimeoutTask {

    private final OrderService orderService;

    /** 关掉后完全不扫描，方便做演示或跑测试 */
    @Value("${hmall.order.timeout-enabled:true}")
    private boolean enabled;

    /** 超过多少分钟仍未支付就自动取消，默认 30 分钟；设为 0 可用于验证 */
    @Value("${hmall.order.timeout-minutes:30}")
    private long timeoutMinutes;

    @Scheduled(
            fixedDelayString = "${hmall.order.cancel-scan-ms:60000}",
            initialDelayString = "${hmall.order.cancel-scan-ms:60000}")
    public void cancelTimeoutOrders() {
        if (!enabled || timeoutMinutes < 0) {
            return;
        }
        LocalDateTime deadline = LocalDateTime.now().minusMinutes(timeoutMinutes);
        List<Order> expired = orderService.list(Wrappers.<Order>lambdaQuery()
                .eq(Order::getStatus, 1)
                .lt(Order::getCreateTime, deadline)
                .orderByAsc(Order::getId)
                .last("limit 100"));
        if (CollUtils.isEmpty(expired)) {
            return;
        }
        log.info("发现 {} 笔超过 {} 分钟未支付的订单，开始自动取消", expired.size(), timeoutMinutes);
        for (Order order : expired) {
            try {
                orderService.cancelOrder(order.getUserId(), order.getId());
                log.info("超时订单 {} 已自动取消，库存已回补", order.getId());
            } catch (Exception e) {
                // 某一笔失败（例如商品服务抖动）不影响其它订单，下轮会重试
                log.warn("超时订单 {} 自动取消失败: {}", order.getId(), e.getMessage());
            }
        }
    }
}
