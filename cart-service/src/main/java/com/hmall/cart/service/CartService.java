package com.hmall.cart.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hmall.cart.dto.CartForm;
import com.hmall.cart.entity.Cart;
import com.hmall.cart.vo.CartVO;

import java.util.List;

public interface CartService extends IService<Cart> {

    List<CartVO> queryMyCarts(Long userId);

    void addCart(Long userId, CartForm form);

    void updateNum(Long userId, CartForm form);

    void deleteByIds(Long userId, List<Long> ids);

    void deleteByItemIds(Long userId, List<Long> itemIds);
}
