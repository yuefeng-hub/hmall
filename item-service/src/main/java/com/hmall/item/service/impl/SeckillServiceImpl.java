package com.hmall.item.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hmall.common.dto.SeckillActivityDTO;
import com.hmall.common.dto.SeckillBenchDTO;
import com.hmall.common.dto.SeckillResultDTO;
import com.hmall.common.dto.SeckillRoundDTO;
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
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 秒杀核心。高并发正确性靠两条数据库级机制保证，不依赖 Redis / 锁：
 * <ol>
 *   <li>防超卖：扣秒杀库存用单条 {@code UPDATE ... WHERE stock>0 AND status=1}，
 *       并发下数据库行锁串行化，谁拿到 rows=1 谁就抢到最后一件；</li>
 *   <li>防重复：seckill_order 的 (activity_id, user_id, round_no) 唯一索引，
 *       一人一轮只能抢一单，并发下重复请求会命中唯一约束抛 DuplicateKeyException。</li>
 * </ol>
 *
 * <p><b>场次怎么轮转</b>：活动表里每条记录带 {@code slot_no}（分在第几组），
 * 服务端用「当前时间 / 每场分钟数 % 组数」算出该开哪一组，只把这一组取出来。
 * 因此场次是「按时间自己滚动」的，不依赖库里写死的 start_time/end_time ——
 * 早期版本把时间窗写成了「插入当天 0 点~次日 0 点」，服务放两天再打开，首页秒杀就空了。
 *
 * <p><b>抢购顺序</b>：短事务「扣库存 + 插唯一记录」→ 事务外回调 order-service 建单 → 失败补偿回补库存。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeckillServiceImpl extends ServiceImpl<SeckillActivityMapper, SeckillActivity> implements SeckillService {

    /** 压测用的虚拟用户 id 起点，和真实用户（个位数~几千）完全隔开，方便一键清理 */
    private static final long VIRTUAL_USER_BASE = 9_000_000_000L;
    /** 压测并发上限：再高 H2 的行锁排队会大面积超时，反而看不出「不超卖」这个结论 */
    private static final int MAX_CONCURRENCY = 200;

    private final SeckillOrderMapper seckillOrderMapper;
    private final ItemMapper itemMapper;
    private final SeckillStockService stockService;
    private final RestTemplate restTemplate;

    @Value("${hmall.remote.order-url}")
    private String orderUrl;

    /** 每场多少分钟（演示默认 10 分钟，够看清切场；真实业务一般是 2 小时） */
    @Value("${hmall.seckill.round-minutes:10}")
    private int roundMinutes;

    /** 一共几组商品轮换 */
    @Value("${hmall.seckill.group-count:3}")
    private int groupCount;

    // ==================== 场次计算 ====================

    /** 本场开始时间 */
    private LocalDateTime roundStart() {
        LocalDateTime now = LocalDateTime.now();
        int minuteOfDay = now.getHour() * 60 + now.getMinute();
        return now.toLocalDate().atStartOfDay().plusMinutes(minuteOfDay - minuteOfDay % roundMinutes);
    }

    /**
     * 场次序号：用 epoch 秒直接除，跨天递增不重复，可以直接当 seckill_order.round_no。
     * 不能用「当天第几场」，否则第二天和第一天的场次号撞车，唯一索引会把老记录当成重复。
     */
    private long roundNo() {
        return System.currentTimeMillis() / 1000L / (roundMinutes * 60L);
    }

    private int groupOf(long roundNo) {
        return (int) Math.floorMod(roundNo, (long) groupCount);
    }

    @Override
    public SeckillRoundDTO currentRound() {
        LocalDateTime start = roundStart();
        LocalDateTime end = start.plusMinutes(roundMinutes);
        long roundNo = roundNo();
        int groupNo = groupOf(roundNo);

        SeckillRoundDTO dto = new SeckillRoundDTO();
        dto.setRoundNo(roundNo);
        dto.setRoundSeq((start.getHour() * 60 + start.getMinute()) / roundMinutes + 1);
        dto.setGroupNo(groupNo);
        dto.setGroupCount(groupCount);
        dto.setRoundMinutes(roundMinutes);
        dto.setStartTime(start);
        dto.setEndTime(end);
        dto.setSecondsLeft((int) Math.max(0, Duration.between(LocalDateTime.now(), end).getSeconds()));
        dto.setNextGroupNo((groupNo + 1) % groupCount);
        // 注意 count() 返回 Long，不能直接 (int) 强转，要先 intValue()
        Long actCount = lambdaQuery()
                .eq(SeckillActivity::getStatus, 1)
                .eq(SeckillActivity::getSlotNo, groupNo)
                .count();
        dto.setActivityCount(actCount == null ? 0 : actCount.intValue());
        return dto;
    }

    // ==================== 查询 ====================

    @Override
    public List<SeckillActivityDTO> listActive() {
        int groupNo = groupOf(roundNo());
        List<SeckillActivity> acts = lambdaQuery()
                .eq(SeckillActivity::getStatus, 1)
                .eq(SeckillActivity::getSlotNo, groupNo)
                .orderByAsc(SeckillActivity::getSeckillPrice)
                .list();
        if (CollUtils.isEmpty(acts)) {
            return Collections.emptyList();
        }
        Map<Long, Item> itemMap = itemMapper.selectBatchIds(acts.stream()
                        .map(SeckillActivity::getItemId).distinct().collect(Collectors.toList()))
                .stream().collect(Collectors.toMap(Item::getId, Function.identity(), (a, b) -> a));
        LocalDateTime start = roundStart();
        LocalDateTime end = start.plusMinutes(roundMinutes);
        long roundNo = roundNo();
        return acts.stream()
                .map(a -> toDTO(a, itemMap.get(a.getItemId()), null, roundNo, start, end))
                .collect(Collectors.toList());
    }

    @Override
    public SeckillActivityDTO detail(Long activityId, Long userId) {
        SeckillActivity act = getById(activityId);
        if (act == null) {
            throw new BizException("秒杀活动不存在", 404);
        }
        Item item = itemMapper.selectById(act.getItemId());
        long roundNo = roundNo();
        boolean grabbed = userId != null && seckillOrderMapper.selectCount(
                Wrappers.<SeckillOrder>lambdaQuery()
                        .eq(SeckillOrder::getActivityId, activityId)
                        .eq(SeckillOrder::getUserId, userId)
                        .eq(SeckillOrder::getRoundNo, roundNo)) > 0;
        LocalDateTime start = roundStart();
        return toDTO(act, item, grabbed, roundNo, start, start.plusMinutes(roundMinutes));
    }

    // ==================== 抢购 ====================

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
        long roundNo = roundNo();
        // 不在本场的活动不能抢：前端只展示本场，但接口不能只信前端
        if (act.getSlotNo() == null || act.getSlotNo() != groupOf(roundNo)) {
            return new SeckillResultDTO(false, null, null, "本场已结束，等下一场再来");
        }

        Item item = itemMapper.selectById(act.getItemId());
        if (item == null || (item.getStatus() != null && item.getStatus() == 0)) {
            throw new BizException("商品已下架");
        }

        // 1. 短事务：原子扣库存（挡超卖）+ 插唯一记录（挡重复）
        try {
            stockService.reserve(activityId, userId, LocalDateTime.now(), roundNo);
        } catch (DuplicateKeyException e) {
            // reserve 事务已回滚（已扣的库存一并回滚），无需补偿
            return new SeckillResultDTO(false, null, null, "本场你已经抢到了，下一场再来");
        } catch (SeckillStockService.SoldOutException e) {
            return new SeckillResultDTO(false, null, null, "手慢了，已被抢光");
        }

        // 2. 事务外：回调 order-service 建单，失败走补偿
        Long orderId;
        try {
            orderId = createRemoteOrder(userId, item.getId(), act.getSeckillPrice(), act.getTitle());
        } catch (Exception e) {
            log.error("秒杀 {} 建单失败，回补库存: {}", activityId, e.getMessage());
            stockService.compensate(activityId, userId, roundNo);
            return new SeckillResultDTO(false, null, null, "下单服务繁忙，请稍后重试");
        }

        // 3. 回填订单号
        SeckillOrder so = new SeckillOrder();
        so.setActivityId(activityId);
        so.setUserId(userId);
        so.setRoundNo(roundNo);
        so.setOrderId(orderId);
        seckillOrderMapper.update(so, Wrappers.<SeckillOrder>lambdaUpdate()
                .eq(SeckillOrder::getActivityId, activityId)
                .eq(SeckillOrder::getUserId, userId)
                .eq(SeckillOrder::getRoundNo, roundNo));

        return new SeckillResultDTO(true, orderId, act.getSeckillPrice(), null);
    }

    // ==================== 高并发演示 ====================

    /**
     * 真的打并发，不是前端假动画：每个并发都用不同的虚拟用户走一遍
     * 「插唯一记录 + 原子扣库存」，所以成功数严格等于本场库存 —— 多一件就说明超卖了。
     *
     * @param concurrency 并发数，钳到 [1, 200]
     * @param autoReset   跑完是否把虚拟用户记录删掉、库存还原（默认 true，方便反复演示）
     */
    @Override
    public SeckillBenchDTO bench(Long activityId, int concurrency, boolean autoReset) {
        SeckillActivity act = getById(activityId);
        if (act == null) {
            throw new BizException("秒杀活动不存在", 404);
        }
        final int total = Math.max(1, Math.min(concurrency, MAX_CONCURRENCY));
        final long roundNo = roundNo();
        final int stockBefore = act.getStock() == null ? 0 : act.getStock();

        final AtomicInteger ok = new AtomicInteger();
        final AtomicInteger soldOut = new AtomicInteger();
        final AtomicInteger dup = new AtomicInteger();
        final AtomicInteger error = new AtomicInteger();
        final List<Long> latencies = Collections.synchronizedList(new ArrayList<Long>(total));

        // 线程池必须能同时容纳全部并发：如果池子比 total 小，
        // 排在队列里的任务永远等不到「一起起跑」的闸门，会死锁
        ExecutorService pool = Executors.newFixedThreadPool(total);
        final CountDownLatch ready = new CountDownLatch(total);
        final CountDownLatch fire = new CountDownLatch(1);

        long t0 = System.nanoTime();
        for (int i = 0; i < total; i++) {
            final long uid = VIRTUAL_USER_BASE + i;
            pool.submit(() -> {
                ready.countDown();
                try {
                    fire.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
                long s = System.nanoTime();
                try {
                    stockService.reserve(activityId, uid, LocalDateTime.now(), roundNo);
                    ok.incrementAndGet();
                } catch (DuplicateKeyException e) {
                    dup.incrementAndGet();
                } catch (SeckillStockService.SoldOutException e) {
                    soldOut.incrementAndGet();
                } catch (Exception e) {
                    error.incrementAndGet();
                    log.warn("压测请求异常: {}", e.getMessage());
                } finally {
                    latencies.add((System.nanoTime() - s) / 1_000_000);
                }
            });
        }

        try {
            ready.await();          // 等所有线程就位
            fire.countDown();       // 同一瞬间放行，形成真实并发冲击
            pool.shutdown();
            pool.awaitTermination(60, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        long elapsed = Math.max(1, (System.nanoTime() - t0) / 1_000_000);

        SeckillBenchDTO dto = new SeckillBenchDTO();
        dto.setActivityId(activityId);
        dto.setTitle(act.getTitle());
        dto.setConcurrency(total);
        dto.setSuccess(ok.get());
        dto.setSoldOut(soldOut.get());
        dto.setDuplicate(dup.get());
        dto.setError(error.get());
        dto.setElapsedMs(elapsed);
        dto.setQps((int) (total * 1000L / elapsed));

        long[] arr = latencies.stream().mapToLong(Long::longValue).sorted().toArray();
        if (arr.length > 0) {
            dto.setP50Ms(arr[(int) Math.min(arr.length - 1, arr.length * 0.50)]);
            dto.setP95Ms(arr[(int) Math.min(arr.length - 1, arr.length * 0.95)]);
            dto.setMaxMs(arr[arr.length - 1]);
        } else {
            dto.setP50Ms(0L);
            dto.setP95Ms(0L);
            dto.setMaxMs(0L);
        }

        if (autoReset) {
            wipeVirtual(activityId, roundNo);
            SeckillActivity after = getById(activityId);
            dto.setStockAfter(after == null ? 0 : after.getStock());
            dto.setReset(Boolean.TRUE);
            dto.setMessage("演示数据已自动回滚：抢到的 " + ok.get() + " 件已退回库存，可反复演示");
        } else {
            SeckillActivity after = getById(activityId);
            dto.setStockAfter(after == null ? 0 : after.getStock());
            dto.setReset(Boolean.FALSE);
            dto.setMessage("本场真实售出 " + ok.get() + " 件，库存剩 " + dto.getStockAfter());
        }
        dto.setStockBefore(stockBefore);
        log.info("秒杀压测 activity={} 并发={} 成功={} 售罄={} 重复={} 异常={} 耗时={}ms",
                activityId, total, ok.get(), soldOut.get(), dup.get(), error.get(), elapsed);
        return dto;
    }

    @Override
    public int resetRound(Long activityId) {
        SeckillActivity act = getById(activityId);
        if (act == null) {
            throw new BizException("秒杀活动不存在", 404);
        }
        long roundNo = roundNo();
        int removed = seckillOrderMapper.delete(Wrappers.<SeckillOrder>lambdaQuery()
                .eq(SeckillOrder::getActivityId, activityId)
                .eq(SeckillOrder::getRoundNo, roundNo));
        // 库存回到 init_stock（不是 +1，避免重复点重置把库存堆高）
        baseMapper.resetStock(activityId);
        log.info("重置秒杀 {} 本轮记录 {} 条，库存回到 {}", activityId, removed, act.getInitStock());
        return removed;
    }

    /** 只清理本轮虚拟用户的记录并还原库存，不碰真实用户抢到的单 */
    private void wipeVirtual(Long activityId, long roundNo) {
        seckillOrderMapper.delete(Wrappers.<SeckillOrder>lambdaQuery()
                .eq(SeckillOrder::getActivityId, activityId)
                .eq(SeckillOrder::getRoundNo, roundNo)
                .ge(SeckillOrder::getUserId, VIRTUAL_USER_BASE));
        baseMapper.resetStock(activityId);
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

    private SeckillActivityDTO toDTO(SeckillActivity act, Item item, Boolean grabbed,
                                     long roundNo, LocalDateTime start, LocalDateTime end) {
        SeckillActivityDTO dto = new SeckillActivityDTO();
        BeanUtils.copyProperties(act, dto);
        if (item != null) {
            dto.setName(item.getName());
            dto.setSubtitle(item.getSubtitle());
            dto.setImage(item.getImage());
            dto.setBrand(item.getBrand());
            dto.setPrice(item.getPrice());
        }
        int stock = act.getStock() == null ? 0 : act.getStock();
        int init = act.getInitStock() == null || act.getInitStock() <= 0 ? stock : act.getInitStock();
        dto.setStock(stock);
        dto.setRemain(stock);
        dto.setInitStock(init);
        dto.setSold(Math.max(0, init - stock));
        dto.setRoundNo(roundNo);
        dto.setSlotNo(act.getSlotNo());
        // 库里的 start/end 是历史遗留值，展示一律用实时算出来的本场时间
        dto.setStartTime(start);
        dto.setEndTime(end);
        dto.setGrabbed(grabbed);
        return dto;
    }
}
