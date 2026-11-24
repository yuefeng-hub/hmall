package com.hmall.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.hmall.user.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    /** 余额充足才扣减，避免并发下扣成负数 */
    @Update("update users set balance = balance - #{amount} " +
            "where id = #{userId} and balance >= #{amount}")
    int deductBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount);

    /** 充值：数据库侧自增，避免「读-改-写」在并发下丢更新 */
    @Update("update users set balance = balance + #{amount} where id = #{userId}")
    int rechargeBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount);
}
