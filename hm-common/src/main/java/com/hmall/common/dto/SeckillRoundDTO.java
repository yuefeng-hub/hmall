package com.hmall.common.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 秒杀场次信息：前端顶部的「第 N 场 / 20:10–20:20 / 距本场结束」都由它驱动。
 *
 * <p>场次不落库，由服务端按「当前分钟 / 每场分钟数」实时算出来：
 * 用户刷新页面永远落在某个进行中的场次里，服务长时间不重启也不会「活动过期」。
 */
@Data
public class SeckillRoundDTO {
    /** 第几轮（从 1970 起的场次数，一直递增，仅用于判断是否换场） */
    private Long roundNo;
    /** 今天的第几场（1 开始），给用户看「第 42 场」 */
    private Integer roundSeq;
    /** 当前开哪一组（0..groupCount-1） */
    private Integer groupNo;
    /** 一共几组轮换 */
    private Integer groupCount;
    /** 每场多少分钟 */
    private Integer roundMinutes;
    /** 本场开始时间 */
    private LocalDateTime startTime;
    /** 本场结束时间 */
    private LocalDateTime endTime;
    /** 距本场结束还有多少秒（前端本地倒计时，归零就重新拉列表） */
    private Integer secondsLeft;
    /** 下一组几号，用来显示「下一场：办公数码」 */
    private Integer nextGroupNo;
    /** 本组活动条数 */
    private Integer activityCount;
}
