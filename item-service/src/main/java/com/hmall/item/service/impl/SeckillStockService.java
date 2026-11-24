package com.hmall.item.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.hmall.item.entity.SeckillOrder;
import com.hmall.item.mapper.SeckillActivityMapper;
import com.hmall.item.mapper.SeckillOrderMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 秒杀库存操作（独立成一个 Service，保证 @Transactional 生效）。
 *
 * <p>为什么单独拆出来：SeckillServiceImpl 里若自己调用自己的 @Transactional 方法，
 * 是同类内部调用，不会经过 Spring AOP 代理，事务会静默失效——扣库存与插记录
 * 不再有原子性，DuplicateKeyException 时已扣的库存回滚不掉。
 *
 * <p>这里把「扣库存 + 插唯一记录」这两个必须原子的本地写操作集中到一个短事务里，
 * 锁持有时间极短，是秒杀并发正确性的地基。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeckillStockService {

    private final SeckillActivityMapper activityMapper;
    private final SeckillOrderMapper seckillOrderMapper;

    /**
     * 短事务：先插唯一记录（挡重复）→ 再原子扣库存（挡超卖）。
     *
     * <p>顺序很关键：必须先插记录再扣库存。若反过来（先扣库存），同一用户并发
     * 重复请求会各自把库存扣成功，再插记录时才发现唯一索引冲突，事务回滚把库存
     * 也回滚了，结果一个都没抢到。先插记录则唯一索引天然只放行一个请求。
     *
     * <p>唯一键是 (activity_id, user_id, round_no)：同一批活动每 round-minutes 分钟
     * 再来一轮，带上 round_no 才能让用户下一轮重新有资格抢。
     *
     * <p>扣库存 rows==0 时抛 {@link SoldOutException} 回滚（连刚插的记录一起回滚，
     * 不会留下「抢不到却占着名额」的脏记录）。
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean reserve(Long activityId, Long userId, LocalDateTime now, long roundNo) {
        // 1. 先落唯一记录：同一用户本轮并发重复请求，这里只有第一个能插成功，
        //    其余命中 (activity_id, user_id, round_no) 唯一索引抛 DuplicateKeyException
        SeckillOrder so = new SeckillOrder();
        so.setActivityId(activityId);
        so.setUserId(userId);
        so.setRoundNo(roundNo);
        so.setCreateTime(now);
        seckillOrderMapper.insert(so);

        // 2. 再原子扣库存：这是全场唯一热点行，H2 行锁串行化
        int rows = activityMapper.deductSeckillStock(activityId);
        if (rows == 0) {
            throw new SoldOutException();   // 售罄，回滚本事务（含刚插的记录）
        }
        return true;
    }

    /** 建单失败补偿：回补秒杀库存 + 删唯一记录，让用户能重试。 */
    @Transactional(rollbackFor = Exception.class)
    public void compensate(Long activityId, Long userId, long roundNo) {
        seckillOrderMapper.delete(Wrappers.<SeckillOrder>lambdaQuery()
                .eq(SeckillOrder::getActivityId, activityId)
                .eq(SeckillOrder::getUserId, userId)
                .eq(SeckillOrder::getRoundNo, roundNo));
        activityMapper.restoreSeckillStock(activityId);
    }

    /** 售罄信号异常，仅用于回滚 reserve 事务，不对外暴露。 */
    static class SoldOutException extends RuntimeException {
        SoldOutException() {
            super("已售罄");
        }
    }
}
