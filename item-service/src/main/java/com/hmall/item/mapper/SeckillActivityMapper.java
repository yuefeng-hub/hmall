package com.hmall.item.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hmall.item.entity.SeckillActivity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface SeckillActivityMapper extends BaseMapper<SeckillActivity> {

    /**
     * 原子扣减秒杀库存：只有「活动进行中且库存 > 0」时才扣，一条 SQL 同时解决超卖与时间窗校验。
     * 返回 0 表示已售罄 / 活动不在进行中 / 活动不存在。
     * 这是秒杀防超卖的核心——不先 select 再 update，避免并发下的读后写竞态。
     */
    @Update("update seckill_activity set stock = stock - 1 " +
            "where id = #{activityId} and stock > 0 and status = 1")
    int deductSeckillStock(@Param("activityId") Long activityId);

    /** 建单失败补偿：把误扣的秒杀库存加回去（纯加法，不会失败） */
    @Update("update seckill_activity set stock = stock + 1 where id = #{activityId}")
    int restoreSeckillStock(@Param("activityId") Long activityId);

    /**
     * 重置库存到本场初始值。用赋值而不是加法，重复点「重置」也不会把库存越堆越高。
     * init_stock = 0 的老数据跳过，否则会把库存直接清成 0。
     */
    @Update("update seckill_activity set stock = init_stock where id = #{activityId} and init_stock > 0")
    int resetStock(@Param("activityId") Long activityId);
}
