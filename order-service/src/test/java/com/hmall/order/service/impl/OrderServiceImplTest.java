package com.hmall.order.service.impl;

import com.hmall.common.dto.ItemDTO;
import com.hmall.order.dto.CreateOrderDTO;
import com.hmall.order.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 下单数量与金额的回归测试。
 *
 * <p>这几个用例专门盯着一个真实修过的 bug：购物车里买 2 件，旧代码把数量写死成 1，
 * 金额、明细、扣库存全按 1 件算，而当时的冒烟测试还把这个错误结果当成了正确基线。
 * 全部是纯函数测试，不启动 Spring 容器、不碰数据库，跑得很快。
 */
class OrderServiceImplTest {

    private static ItemDTO item(long id, String price, int stock, int status) {
        ItemDTO dto = new ItemDTO();
        dto.setId(id);
        dto.setName("商品" + id);
        dto.setPrice(price == null ? null : new BigDecimal(price));
        dto.setStock(stock);
        dto.setStatus(status);
        return dto;
    }

    private static CreateOrderDTO withItems(CreateOrderDTO.OrderItem... items) {
        CreateOrderDTO dto = new CreateOrderDTO();
        dto.setItems(Arrays.asList(items));
        return dto;
    }

    // ---------- 数量归一化 ----------

    @Test
    @DisplayName("新版 items 的数量原样保留，不再被压成 1")
    void normalizeItemsKeepsQuantities() {
        Map<Long, Integer> q = OrderServiceImpl.normalizeItems(withItems(
                new CreateOrderDTO.OrderItem(1L, 1),
                new CreateOrderDTO.OrderItem(2L, 2)));
        assertEquals(2, q.size());
        assertEquals(1, q.get(1L));
        assertEquals(2, q.get(2L));
    }

    @Test
    @DisplayName("重复的 itemId 合并累加，避免一次请求扣两次库存")
    void normalizeItemsMergesDuplicates() {
        Map<Long, Integer> q = OrderServiceImpl.normalizeItems(withItems(
                new CreateOrderDTO.OrderItem(1L, 2),
                new CreateOrderDTO.OrderItem(1L, 3)));
        assertEquals(1, q.size());
        assertEquals(5, q.get(1L));
    }

    @Test
    @DisplayName("旧版 itemIds 仍兼容，每件按 1 处理")
    void normalizeItemsFallsBackToLegacyIds() {
        CreateOrderDTO dto = new CreateOrderDTO();
        dto.setItemIds(Arrays.asList(1L, 2L));
        Map<Long, Integer> q = OrderServiceImpl.normalizeItems(dto);
        assertEquals(1, q.get(1L));
        assertEquals(1, q.get(2L));
    }

    @Test
    @DisplayName("num 缺省按 1，num<=0 直接拒绝")
    void normalizeItemsRejectsBadQuantity() {
        assertEquals(1, OrderServiceImpl.normalizeItems(
                withItems(new CreateOrderDTO.OrderItem(1L, null))).get(1L));

        BizException zero = assertThrows(BizException.class, () -> OrderServiceImpl.normalizeItems(
                withItems(new CreateOrderDTO.OrderItem(1L, 0))));
        assertTrue(zero.getMessage().contains("商品数量必须大于 0"));

        assertThrows(BizException.class, () -> OrderServiceImpl.normalizeItems(
                withItems(new CreateOrderDTO.OrderItem(1L, -1))));
    }

    @Test
    @DisplayName("空请求 / 缺 itemId / null DTO 都要给出可读提示")
    void normalizeItemsRejectsEmptyRequest() {
        assertThrows(BizException.class, () -> OrderServiceImpl.normalizeItems(null));
        assertThrows(BizException.class, () -> OrderServiceImpl.normalizeItems(new CreateOrderDTO()));
        CreateOrderDTO blank = new CreateOrderDTO();
        blank.setItemIds(Collections.emptyList());
        assertThrows(BizException.class, () -> OrderServiceImpl.normalizeItems(blank));
        assertThrows(BizException.class, () -> OrderServiceImpl.normalizeItems(
                withItems(new CreateOrderDTO.OrderItem(null, 1))));
    }

    // ---------- 金额计算 ----------

    @Test
    @DisplayName("金额按 单价×数量 累加：3999 + 599×2 = 5197")
    void calculateTotalMultipliesByQuantity() {
        Map<Long, Integer> q = new HashMap<>();
        q.put(1L, 1);
        q.put(2L, 2);
        Map<Long, ItemDTO> items = Map.of(
                1L, item(1, "3999.00", 100, 1),
                2L, item(2, "599.00", 200, 1));
        assertEquals(0, new BigDecimal("5197.00")
                .compareTo(OrderServiceImpl.calculateTotal(q, items)));
    }

    @Test
    @DisplayName("价格为空按 0 计，空购物车金额为 0")
    void calculateTotalHandlesNullPrice() {
        Map<Long, Integer> q = Map.of(1L, 3);
        Map<Long, ItemDTO> items = Map.of(1L, item(1, null, 100, 1));
        assertEquals(0, BigDecimal.ZERO.compareTo(OrderServiceImpl.calculateTotal(q, items)));
        assertEquals(0, BigDecimal.ZERO.compareTo(
                OrderServiceImpl.calculateTotal(Collections.emptyMap(), Collections.emptyMap())));
    }

    @Test
    @DisplayName("商品查不到就抛业务异常，不能悄悄算成 0 元订单")
    void calculateTotalRejectsMissingItem() {
        Map<Long, Integer> q = Map.of(9L, 1);
        BizException ex = assertThrows(BizException.class,
                () -> OrderServiceImpl.calculateTotal(q, Collections.emptyMap()));
        assertTrue(ex.getMessage().contains("商品不存在或已下架"));
    }

    // ---------- 校验 ----------

    @Test
    @DisplayName("库存按实际数量校验：只剩 1 件时买 2 件应被拒绝")
    void validateItemsChecksStockAgainstQuantity() {
        Map<Long, Integer> q = Map.of(1L, 2);
        Map<Long, ItemDTO> items = Map.of(1L, item(1, "10.00", 1, 1));
        BizException ex = assertThrows(BizException.class,
                () -> OrderServiceImpl.validateItems(q, items));
        assertTrue(ex.getMessage().contains("库存不足"));

        // 数量改成 1 就放行
        assertDoesNotThrow(() -> OrderServiceImpl.validateItems(
                Map.of(1L, 1), items));
    }

    @Test
    @DisplayName("已下架商品不允许下单")
    void validateItemsRejectsOfflineItem() {
        Map<Long, Integer> q = Map.of(1L, 1);
        Map<Long, ItemDTO> items = Map.of(1L, item(1, "10.00", 100, 0));
        BizException ex = assertThrows(BizException.class,
                () -> OrderServiceImpl.validateItems(q, items));
        assertTrue(ex.getMessage().contains("已下架"));
    }
}
