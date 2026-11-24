package com.hmall.item.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hmall.common.dto.SeckillActivityDTO;
import com.hmall.common.dto.SeckillBenchDTO;
import com.hmall.common.dto.SeckillResultDTO;
import com.hmall.common.dto.SeckillRoundDTO;
import com.hmall.item.entity.SeckillActivity;

import java.util.List;

public interface SeckillService extends IService<SeckillActivity> {

    /** 当前场次信息：第几场、几点到几点、还剩多少秒 */
    SeckillRoundDTO currentRound();

    /**
     * 本场进行中的秒杀活动列表（首页秒杀楼层用）。
     * 带上 {@code userId} 才能标出「本场我已经抢到哪几件」，否则按钮永远是「马上抢」。
     */
    List<SeckillActivityDTO> listActive(Long userId);

    /** 单个秒杀活动详情（抢购页用），带当前用户本轮是否已抢过 */
    SeckillActivityDTO detail(Long activityId, Long userId);

    /**
     * 抢购：原子扣减秒杀库存 + 唯一索引防重复，成功后在 order-service 建普通订单。
     * 高并发正确性靠两点保证：
     *   1. 扣库存用单条 UPDATE ... WHERE stock>0，并发下也不会超卖；
     *   2. seckill_order 的 (activity_id,user_id,round_no) 唯一索引，一人一轮只能抢一单。
     */
    SeckillResultDTO seckill(Long activityId, Long userId);

    /**
     * 高并发演示：服务端开线程池同时打 {@code concurrency} 个抢购请求（虚拟用户），
     * 统计成功 / 售罄 / 重复拦截 / 耗时 / QPS。默认跑完把虚拟记录和库存还原，可反复演示。
     */
    SeckillBenchDTO bench(Long activityId, int concurrency, boolean autoReset);

    /** 重置本场：清掉本轮所有抢购记录，库存回到 init_stock，让演示能重来一遍 */
    int resetRound(Long activityId);
}
