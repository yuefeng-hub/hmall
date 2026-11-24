package com.hmall.pay.task;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.hmall.common.dto.OrderDTO;
import com.hmall.common.utils.CollUtils;
import com.hmall.pay.entity.PayOrder;
import com.hmall.pay.service.PayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 支付对账补偿：处理「钱扣了，但订单服务没改成已支付」的跨库不一致。
 *
 * <p>pay() 里第 4 步回调订单服务是跨库调用，失败只记 error 日志（本地事务管不到另一个服务）。
 * 这个任务定时重放回调，让状态最终一致 —— 课程里说的「本地事务 + 补偿」里的补偿落地在这一步。
 *
 * <p>两种异常区分对待：
 * <ul>
 *   <li>订单仍是待支付 → 重放 {@code PUT /orders/{id}/status?status=2}，order-service 内部幂等；</li>
 *   <li>订单已取消 → 钱已经扣了却不能强行把订单改成已支付，打 error 日志要求人工处理/退款，
 *       避免自动补偿掩盖资金差错。</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PayReconcileTask {

    private final PayService payService;
    private final RestTemplate restTemplate;

    @Value("${hmall.remote.order-url}")
    private String orderUrl;

    /** 关掉后完全不扫描 */
    @Value("${hmall.pay.reconcile-enabled:true}")
    private boolean enabled;

    /** 只回看最近多少分钟内支付成功的单，避免每次全表扫 */
    @Value("${hmall.pay.reconcile-lookback-minutes:120}")
    private long lookbackMinutes;

    @Scheduled(
            fixedDelayString = "${hmall.pay.reconcile-scan-ms:60000}",
            initialDelayString = "${hmall.pay.reconcile-scan-ms:60000}")
    public void reconcile() {
        if (!enabled) {
            return;
        }
        LocalDateTime since = LocalDateTime.now().minusMinutes(lookbackMinutes);
        List<PayOrder> paid = payService.list(Wrappers.<PayOrder>lambdaQuery()
                .eq(PayOrder::getStatus, 1)
                .ge(PayOrder::getPayTime, since)
                .orderByAsc(PayOrder::getId)
                .last("limit 100"));
        if (CollUtils.isEmpty(paid)) {
            return;
        }
        int fixed = 0;
        int manual = 0;
        for (PayOrder pay : paid) {
            try {
                OrderDTO order = restTemplate.getForObject(
                        orderUrl + "/orders/{id}", OrderDTO.class, pay.getOrderId());
                if (order == null) {
                    log.warn("对账：支付单 {} 查不到订单 {}，下轮重试", pay.getPayOrderNo(), pay.getOrderId());
                    continue;
                }
                Integer status = order.getStatus();
                if (status != null && status == 2) {
                    continue; // 已一致，什么都不用做
                }
                if (status != null && status == 3) {
                    // 钱扣了、订单却已取消：不能靠自动补偿硬改，必须人工介入
                    log.error("对账异常：支付单 {} 已扣款 {} 元，但订单 {} 已取消，需人工处理/退款",
                            pay.getPayOrderNo(), pay.getAmount(), pay.getOrderId());
                    manual++;
                    continue;
                }
                HttpHeaders headers = new HttpHeaders();
                headers.set("X-User-Id", String.valueOf(pay.getUserId()));
                restTemplate.exchange(
                        orderUrl + "/orders/{id}/status?status=2", HttpMethod.PUT,
                        new HttpEntity<>(headers), Void.class,
                        Map.of("id", pay.getOrderId()));
                log.info("对账补偿：支付单 {} 对应订单 {} 已补置为已支付", pay.getPayOrderNo(), pay.getOrderId());
                fixed++;
            } catch (Exception e) {
                log.warn("对账补偿失败，支付单 {}：{}", pay.getPayOrderNo(), e.getMessage());
            }
        }
        if (fixed > 0 || manual > 0) {
            log.info("对账完成：补偿 {} 笔，需人工处理 {} 笔", fixed, manual);
        }
    }
}
