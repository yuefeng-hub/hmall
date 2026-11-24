package com.hmall.item.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hmall.item.entity.Item;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ItemMapper extends BaseMapper<Item> {

    /**
     * 条件扣减库存：只有库存足够时才更新，一条 SQL 同时解决超卖与幂等。
     * 返回 0 表示库存不足或商品不存在。
     */
    @Update("update item set stock = stock - #{num}, update_time = now() " +
            "where id = #{itemId} and stock >= #{num}")
    int deductStock(@Param("itemId") Long itemId, @Param("num") Integer num);

    /**
     * 回补库存：取消订单时把原先扣掉的量加回去。
     * 这里是纯加法，不存在"够不够"的判断，所以条件只有商品是否存在。
     */
    @Update("update item set stock = stock + #{num}, update_time = now() where id = #{itemId}")
    int restoreStock(@Param("itemId") Long itemId, @Param("num") Integer num);
}
