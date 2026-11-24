package com.hmall.item.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.hmall.common.dto.SeckillActivityDTO;
import com.hmall.common.dto.SeckillResultDTO;
import com.hmall.item.entity.SeckillActivity;

import java.util.List;

public interface SeckillService extends IService<SeckillActivity> {

    /** 进行中的秒杀活动列表（首页秒杀楼层用），带商品展示字段与剩余库存 */
    List<SeckillActivityDTO> listActive();

    /** 单个秒杀活动详情（抢购页用），带是否已抢过标记 */
    SeckillActivityDTO detail(Long activityId, Long userId);

    /**
     * 抢购：原子扣减秒杀库存 + 唯一索引防重复，成功后在 order-service 建普通订单。
     * 高并发正确性靠两点保证：
     *   1. 扣库存用单条 UPDATE ... WHERE stock>0，并发下也不会超卖；
     *   2. seckill_order 的 (activity_id,user_id) 唯一索引，一人一场只能抢一单。
     */
    SeckillResultDTO seckill(Long activityId, Long userId);
}
