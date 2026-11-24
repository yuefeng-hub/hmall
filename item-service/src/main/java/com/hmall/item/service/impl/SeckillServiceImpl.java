package com.hmall.item.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hmall.common.dto.SeckillActivityDTO;
import com.hmall.common.dto.SeckillResultDTO;
import com.hmall.common.utils.CollUtils;
import com.hmall.item.entity.Item;
import com.hmall.item.entity.SeckillActivity;
import com.hmall.item.entity.SeckillOrder;
import com.hmall.item.exception.BizException;
import com.hmall.item.mapper.ItemMapper;
import com.hmall.item.mapper.SeckillActivityMapper;
import com.hmall.item.mapper.SeckillOrderMapper;
import com.hmall.item.service.SeckillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 秒杀核心。高并发正确性靠两条数据库级机制保证，不依赖 Redis / 锁：
 * <ol>
 *   <li>防超卖：扣秒杀库存用单条 {@code UPDATE ... WHERE stock>0 AND status=1}，
 *       并发下数据库行锁串行化，谁拿到 rows=1 谁就抢到最后一件；</li>
 *   <li>防重复：seckill_order 的 (activity_id, user_id) 唯一索引，一人一场只能抢一单，
 *       并发下重复请求会命中唯一约束抛 DuplicateKeyException。</li>
 * </ol>
 * 抢购顺序：短事务「扣库存 + 插唯一记录」→ 事务外回调 order-service 建单 → 失败补偿回补库存。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeckillServiceImpl extends ServiceImpl<SeckillActivityMapper, SeckillActivity> implements SeckillService {

    private final SeckillOrderMapper seckillOrderMapper;
    private final ItemMapper itemMapper;
    private final SeckillStockService stockService;
    private final RestTemplate restTemplate;

    @Value("${hmall.remote.order-url}")
    private String orderUrl;

    @Override
    public List<SeckillActivityDTO> listActive() {
        LocalDateTime now = LocalDateTime.now();
        List<SeckillActivity> acts = lambdaQuery()
                .eq(SeckillActivity::getStatus, 1)
                .le(SeckillActivity::getStartTime, now)
                .ge(SeckillActivity::getEndTime, now)
                .orderByAsc(SeckillActivity::getEndTime)
                .list();
        if (CollUtils.isEmpty(acts)) {
            return Collections.emptyList();
        }
        Map<Long, Item> itemMap = itemMapper.selectBatchIds(acts.stream()
                        .map(SeckillActivity::getItemId).distinct().collect(Collectors.toList()))
                .stream().collect(Collectors.toMap(Item::getId, Function.identity(), (a, b) -> a));
        return acts.stream().map(a -> toDTO(a, itemMap.get(a.getItemId()), null)).collect(Collectors.toList());
    }

    @Override
    public SeckillActivityDTO detail(Long activityId, Long userId) {
        SeckillActivity act = getById(activityId);
        if (act == null) {
            throw new BizException("秒杀活动不存在", 404);
        }
        Item item = itemMapper.selectById(act.getItemId());
        boolean grabbed = userId != null && seckillOrderMapper.selectCount(
                Wrappers.<SeckillOrder>lambdaQuery()
                        .eq(SeckillOrder::getActivityId, activityId)
                        .eq(SeckillOrder::getUserId, userId)) > 0;
        return toDTO(act, item, grabbed);
    }

    /**
     * 抢购入口。
     *
     * <p>高并发关键设计：数据库事务只包住「扣库存 + 插唯一记录」两个本地快操作，
     * 锁持有时间极短；远程建单放在事务之外，失败走补偿（回补库存 + 删唯一记录）。
     * 如果把远程调用也放进事务，H2 行锁会被长时间占用，120 并发下直接锁超时。
     */
    @Override
    public SeckillResultDTO seckill(Long activityId, Long userId) {
        SeckillActivity act = getById(activityId);
        if (act == null) {
            throw new BizException("秒杀活动不存在", 404);
        }
        if (act.getStatus() == null || act.getStatus() != 1) {
            return new SeckillResultDTO(false, null, null, "活动已结束");
        }
        LocalDateTime now = LocalDateTime.now();
        if (act.getStartTime() != null && now.isBefore(act.getStartTime())) {
            return new SeckillResultDTO(false, null, null, "秒杀尚未开始");
        }
        if (act.getEndTime() != null && now.isAfter(act.getEndTime())) {
            return new SeckillResultDTO(false, null, null, "秒杀已结束");
        }

        Item item = itemMapper.selectById(act.getItemId());
        if (item == null || (item.getStatus() != null && item.getStatus() == 0)) {
            throw new BizException("商品已下架");
        }

        // 1. 短事务：原子扣库存（挡超卖）+ 插唯一记录（挡重复）
        try {
            stockService.reserve(activityId, userId, now);
        } catch (DuplicateKeyException e) {
            // reserve 事务已回滚（已扣的库存一并回滚），无需补偿
            return new SeckillResultDTO(false, null, null, "你已经抢过了，每人限购一件");
        } catch (SeckillStockService.SoldOutException e) {
            return new SeckillResultDTO(false, null, null, "手慢了，已被抢光");
        }

        // 2. 事务外：回调 order-service 建单，失败走补偿
        Long orderId;
        try {
            orderId = createRemoteOrder(userId, item.getId(), act.getSeckillPrice(), act.getTitle());
        } catch (Exception e) {
            log.error("秒杀 {} 建单失败，回补库存: {}", activityId, e.getMessage());
            stockService.compensate(activityId, userId);
            return new SeckillResultDTO(false, null, null, "下单服务繁忙，请稍后重试");
        }

        // 3. 回填订单号
        SeckillOrder so = new SeckillOrder();
        so.setActivityId(activityId);
        so.setUserId(userId);
        so.setOrderId(orderId);
        seckillOrderMapper.update(so, Wrappers.<SeckillOrder>lambdaUpdate()
                .eq(SeckillOrder::getActivityId, activityId)
                .eq(SeckillOrder::getUserId, userId));

        return new SeckillResultDTO(true, orderId, act.getSeckillPrice(), null);
    }

    private Long createRemoteOrder(Long userId, Long itemId, BigDecimal seckillPrice, String title) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", String.valueOf(userId));
        Map<String, Object> body = new HashMap<>();
        body.put("itemId", itemId);
        body.put("seckillPrice", seckillPrice);
        body.put("address", title == null ? "秒杀订单" : title);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> resp = restTemplate.exchange(
                orderUrl + "/orders/seckill", HttpMethod.POST, entity, Map.class);
        if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
            throw new RuntimeException("订单服务返回异常");
        }
        Object id = resp.getBody().get("id");
        return id == null ? null : Long.valueOf(String.valueOf(id));
    }

    private SeckillActivityDTO toDTO(SeckillActivity act, Item item, Boolean grabbed) {
        SeckillActivityDTO dto = new SeckillActivityDTO();
        BeanUtils.copyProperties(act, dto);
        if (item != null) {
            dto.setName(item.getName());
            dto.setSubtitle(item.getSubtitle());
            dto.setImage(item.getImage());
            dto.setBrand(item.getBrand());
            dto.setPrice(item.getPrice());
        }
        dto.setRemain(act.getStock());
        dto.setGrabbed(grabbed);
        return dto;
    }
}
