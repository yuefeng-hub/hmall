package com.hmall.pay.controller;

import com.hmall.common.dto.PayOrderDTO;
import com.hmall.pay.service.PayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "支付服务")
@RestController
@RequestMapping("/pay-orders")
@RequiredArgsConstructor
public class PayController {

    private final PayService payService;

    @Operation(summary = "创建支付单（余额支付）")
    @PostMapping
    public PayOrderDTO createPayOrder(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                                      @RequestBody Map<String, Long> body) {
        return payService.createPayOrder(userId, body.get("orderId"));
    }

    @Operation(summary = "确认支付：校验密码 + 扣余额 + 改支付单 + 改订单状态")
    @PutMapping
    public PayOrderDTO pay(@RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
                           @RequestParam("payOrderNo") String payOrderNo,
                           @RequestParam("pw") String password) {
        return payService.pay(payOrderNo, password, userId);
    }

    @Operation(summary = "查询支付单")
    @GetMapping("/{payOrderNo}")
    public PayOrderDTO query(@PathVariable("payOrderNo") String payOrderNo) {
        return payService.queryByNo(payOrderNo);
    }
}
