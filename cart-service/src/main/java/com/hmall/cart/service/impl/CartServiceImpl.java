package com.hmall.cart.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hmall.cart.dto.CartForm;
import com.hmall.cart.entity.Cart;
import com.hmall.cart.exception.BizException;
import com.hmall.cart.mapper.CartMapper;
import com.hmall.cart.service.CartService;
import com.hmall.cart.vo.CartVO;
import com.hmall.common.dto.ItemDTO;
import com.hmall.common.utils.CollUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
public class CartServiceImpl extends ServiceImpl<CartMapper, Cart> implements CartService {

    private final RestTemplate restTemplate;

    @Value("${hmall.remote.item-url}")
    private String itemUrl;

    public CartServiceImpl(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    public List<CartVO> queryMyCarts(Long userId) {
        List<Cart> carts = lambdaQuery()
                .eq(Cart::getUserId, userId)
                .orderByDesc(Cart::getCreateTime)
                .list();
        if (CollUtils.isEmpty(carts)) {
            return new ArrayList<>();
        }
        List<CartVO> vos = carts.stream().map(c -> {
            CartVO vo = new CartVO();
            vo.setId(c.getId());
            vo.setItemId(c.getItemId());
            vo.setNum(c.getNum());
            return vo;
        }).collect(Collectors.toList());
        // 拆分之后商品信息不在本地，必须远程补齐
        handleCartItems(vos);
        return vos;
    }

    /**
     * 用 RestTemplate 调商品服务，把购物车里缺失的商品字段补上。
     * 与课程代码一致：exchange + ParameterizedTypeReference 才能正确反序列化 List<ItemDTO>。
     */
    private void handleCartItems(List<CartVO> vos) {
        Set<Long> itemIds = vos.stream().map(CartVO::getItemId).collect(Collectors.toSet());
        if (CollUtils.isEmpty(itemIds)) {
            return;
        }
        try {
            ResponseEntity<List<ItemDTO>> resp = restTemplate.exchange(
                    itemUrl + "/items?ids={ids}",
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<List<ItemDTO>>() {
                    },
                    Map.of("ids", CollUtils.join(itemIds, ","))
            );
            if (!resp.getStatusCode().is2xxSuccessful() || CollUtils.isEmpty(resp.getBody())) {
                log.warn("查询商品信息失败，itemIds={}", itemIds);
                return;
            }
            List<ItemDTO> items = resp.getBody();
            Map<Long, ItemDTO> itemMap = items.stream()
                    .collect(Collectors.toMap(ItemDTO::getId, Function.identity()));
            for (CartVO v : vos) {
                ItemDTO item = itemMap.get(v.getItemId());
                if (item == null) {
                    continue;
                }
                v.setName(item.getName());
                v.setImage(item.getImage());
                v.setPrice(item.getPrice());
                v.setNewPrice(item.getPrice());
                v.setStock(item.getStock());
                v.setStatus(item.getStatus());
            }
        } catch (Exception e) {
            // 远程调用失败时不影响购物车列表本身，字段留空并打印日志
            log.error("调用商品服务异常: {}", e.getMessage());
        }
    }

    @Override
    public void addCart(Long userId, CartForm form) {
        if (form == null || form.getItemId() == null || form.getNum() == null || form.getNum() <= 0) {
            throw new BizException("商品 id 与数量不能为空，且数量必须大于 0");
        }
        Cart exist = lambdaQuery()
                .eq(Cart::getUserId, userId)
                .eq(Cart::getItemId, form.getItemId())
                .one();
        if (exist == null) {
            Cart cart = new Cart();
            cart.setUserId(userId);
            cart.setItemId(form.getItemId());
            cart.setNum(form.getNum());
            cart.setCreateTime(LocalDateTime.now());
            cart.setUpdateTime(LocalDateTime.now());
            save(cart);
        } else {
            exist.setNum(exist.getNum() + form.getNum());
            exist.setUpdateTime(LocalDateTime.now());
            updateById(exist);
        }
    }

    @Override
    public void updateNum(Long userId, CartForm form) {
        if (form == null || form.getId() == null) {
            throw new BizException("购物车记录 id 不能为空");
        }
        Cart cart = getById(form.getId());
        if (cart == null || cart.getUserId() == null || !cart.getUserId().equals(userId)) {
            throw new BizException("购物车记录不存在: id=" + form.getId());
        }
        if (form.getNum() == null || form.getNum() <= 0) {
            throw new BizException("数量必须大于 0");
        }
        cart.setNum(form.getNum());
        cart.setUpdateTime(LocalDateTime.now());
        updateById(cart);
    }

    @Override
    public void deleteByIds(Long userId, List<Long> ids) {
        if (CollUtils.isEmpty(ids)) {
            return;
        }
        lambdaUpdate()
                .eq(Cart::getUserId, userId)
                .in(Cart::getId, ids)
                .remove();
    }

    @Override
    public void deleteByItemIds(Long userId, List<Long> itemIds) {
        if (CollUtils.isEmpty(itemIds)) {
            return;
        }
        lambdaUpdate()
                .eq(Cart::getUserId, userId)
                .in(Cart::getItemId, itemIds)
                .remove();
    }
}
