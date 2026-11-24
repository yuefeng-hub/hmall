package com.hmall.common.dto;

import lombok.Data;

/**
 * 高并发压测结果：服务端用线程池同时打 N 个抢购请求，统计真实战况。
 *
 * <p>不是前端假的进度动画——每个并发都会真的走「插唯一记录 + 原子扣库存」这条路径，
 * 成功数严格等于本场库存（多一件就是超卖），其余全部落到售罄或重复拦截上。
 */
@Data
public class SeckillBenchDTO {
    /** 压的是哪个活动 */
    private Long activityId;
    private String title;
    /** 请求的并发数 */
    private Integer concurrency;
    /** 抢到的件数（应等于 min(并发, 初始库存)，多一件就是超卖） */
    private Integer success;
    /** 因售罄被拦下的请求数 */
    private Integer soldOut;
    /** 因「一人一轮一单」被唯一索引拦下的重复请求 */
    private Integer duplicate;
    /** 锁超时等异常（H2 行锁排队过久时会出现在这里） */
    private Integer error;
    /** 总耗时（毫秒） */
    private Long elapsedMs;
    /** 吞吐 QPS */
    private Integer qps;
    private Long p50Ms;
    private Long p95Ms;
    private Long maxMs;
    /** 压测前 / 后的剩余库存 */
    private Integer stockBefore;
    private Integer stockAfter;
    /** 是否已自动回滚（清掉虚拟用户记录 + 库存还原） */
    private Boolean reset;
    /** 给前端的补充说明 */
    private String message;
}
