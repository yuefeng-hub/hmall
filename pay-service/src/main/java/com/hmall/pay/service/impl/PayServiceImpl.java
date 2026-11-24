package com.hmall.pay.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hmall.common.dto.OrderDTO;
import com.hmall.common.dto.PayOrderDTO;
import com.hmall.pay.entity.PayOrder;
import com.hmall.pay.exception.BizException;
import com.hmall.pay.mapper.PayOrderMapper;
import com.hmall.pay.service.PayService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
public class PayServiceImpl extends ServiceImpl<PayOrderMapper, PayOrder> implements PayService {

    private final RestTemplate restTemplate;

    @Value("${hmall.remote.order-url}")
    private String orderUrl;
    @Value("${hmall.remote.user-url}")
    private String userUrl;

    public PayServiceImpl(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    public PayOrderDTO createPayOrder(Long userId, Long orderId) {
        // 金额从订单服务查，不由前端传入
        OrderDTO order = restTemplate.getForObject(orderUrl + "/orders/{id}", OrderDTO.class, orderId);
        if (order == null) {
            throw new BizException("订单不存在: id=" + orderId);
        }
        if (order.getStatus() == null || order.getStatus() != 1) {
            throw new BizException(order.getStatus() != null && order.getStatus() == 2
                    ? "订单已支付，无需重复支付"
                    : "订单已取消，无法支付");
        }
        // 复用该订单下未支付的支付单：用户关掉支付弹窗后再点「去支付」时不能生成第二张单，
        // 否则两张单各扣一次款，就成了重复扣费
        PayOrder pending = lambdaQuery()
                .eq(PayOrder::getOrderId, orderId)
                .eq(PayOrder::getUserId, userId)
                .eq(PayOrder::getStatus, 0)
                .orderByDesc(PayOrder::getId)
                .last("limit 1")
                .one();
        if (pending != null) {
            return toDTO(pending);
        }

        PayOrder pay = new PayOrder();
        pay.setPayOrderNo(genPayOrderNo());
        pay.setOrderId(orderId);
        pay.setUserId(userId);
        pay.setAmount(order.getTotalFee());
        pay.setStatus(0);
        pay.setCreateTime(LocalDateTime.now());
        save(pay);
        return toDTO(pay);
    }

    @Override
    public PayOrderDTO pay(String payOrderNo, String password, Long userId) {
        PayOrder pay = lambdaQuery().eq(PayOrder::getPayOrderNo, payOrderNo).one();
        if (pay == null) {
            throw new BizException("支付单不存在: " + payOrderNo);
        }
        if (pay.getStatus() != null && pay.getStatus() == 1) {
            return toDTO(pay); // 幂等：已支付直接返回
        }
        if (pay.getStatus() != null && pay.getStatus() == 2) {
            throw new BizException("支付单已失败，请重新发起支付：" + payOrderNo);
        }
        // 0. 扣款前再确认一次订单状态：万一手里是一张旧支付单，而订单已经被别的支付单付过了，
        //    直接返回不再扣钱（这是防重复扣费的最后一道闸）；订单被取消了则直接拒绝
        OrderDTO order = fetchOrder(pay.getOrderId());
        if (order != null) {
            if (order.getStatus() != null && order.getStatus() == 2) {
                log.warn("订单 {} 已支付，支付单 {} 不再扣款", pay.getOrderId(), payOrderNo);
                if (pay.getStatus() == null || pay.getStatus() != 1) {
                    pay.setStatus(1);
                    pay.setPayTime(LocalDateTime.now());
                    updateById(pay);
                }
                return toDTO(pay);
            }
            if (order.getStatus() == null || order.getStatus() != 1) {
                throw new BizException("订单已取消，无法支付");
            }
        }
        // 1. 校验密码（用户数据只归用户服务管）
        Boolean pwOk = restTemplate.getForObject(
                userUrl + "/users/{id}/check-password?pw={pw}", Boolean.class, userId, password);
        if (!Boolean.TRUE.equals(pwOk)) {
            throw new BizException("支付密码错误");
        }
        // 2. 扣减余额（用户服务内部做"余额充足才扣"的条件更新）
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", String.valueOf(userId));
        Boolean deducted = restTemplate.exchange(
                userUrl + "/users/{id}/balance/deduct?amount={amount}", HttpMethod.PUT,
                new HttpEntity<>(headers), Boolean.class,
                Map.of("id", userId, "amount", pay.getAmount())).getBody();
        if (!Boolean.TRUE.equals(deducted)) {
            throw new BizException("余额不足");
        }
        // 3. 更新支付单
        pay.setStatus(1);
        pay.setPayTime(LocalDateTime.now());
        updateById(pay);

        // 4. 通知订单服务改状态（跨库，失败只记日志，由对账补偿）
        try {
            restTemplate.exchange(
                    orderUrl + "/orders/{id}/status?status=2", HttpMethod.PUT,
                    new HttpEntity<>(headers), Void.class,
                    Map.of("id", pay.getOrderId()));
        } catch (Exception e) {
            log.error("支付成功但通知订单服务失败，orderId={}，需对账补偿：{}",
                    pay.getOrderId(), e.getMessage());
        }
        return toDTO(pay);
    }

    @Override
    public PayOrderDTO queryByNo(String payOrderNo) {
        PayOrder pay = lambdaQuery().eq(PayOrder::getPayOrderNo, payOrderNo).one();
        if (pay == null) {
            throw new BizException("支付单不存在: " + payOrderNo);
        }
        return toDTO(pay);
    }

    /**
     * 查订单当前状态。订单服务暂时不可用时返回 null 放行 —— 不能让下游抖动把支付卡死，
     * 真正兜底的是「余额条件扣减」和支付单自身的幂等状态。
     */
    private OrderDTO fetchOrder(Long orderId) {
        try {
            return restTemplate.getForObject(orderUrl + "/orders/{id}", OrderDTO.class, orderId);
        } catch (Exception e) {
            log.warn("查询订单 {} 状态失败，按未支付继续：{}", orderId, e.getMessage());
            return null;
        }
    }

    private String genPayOrderNo() {
        return "P" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + ThreadLocalRandom.current().nextInt(1000, 9999);
    }

    private PayOrderDTO toDTO(PayOrder pay) {
        PayOrderDTO dto = new PayOrderDTO();
        BeanUtils.copyProperties(pay, dto);
        return dto;
    }
}
