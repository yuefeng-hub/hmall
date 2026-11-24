package com.hmall.pay.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hmall.common.dto.PayOrderDTO;
import com.hmall.pay.entity.PayOrder;

public interface PayService extends IService<PayOrder> {

    PayOrderDTO createPayOrder(Long userId, Long orderId);

    PayOrderDTO pay(String payOrderNo, String password, Long userId);

    PayOrderDTO queryByNo(String payOrderNo);
}
