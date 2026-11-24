package com.hmall.item.controller;

import com.hmall.common.dto.SeckillActivityDTO;
import com.hmall.common.dto.SeckillBenchDTO;
import com.hmall.common.dto.SeckillResultDTO;
import com.hmall.common.dto.SeckillRoundDTO;
import com.hmall.item.service.SeckillService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "秒杀服务")
@RestController
@RequestMapping("/seckill")
@RequiredArgsConstructor
public class SeckillController {

    private final SeckillService seckillService;

    @Operation(summary = "当前场次（第几场 / 几点到几点 / 还剩几秒 / 下一场是哪一组）")
    @GetMapping("/round")
    public SeckillRoundDTO round() {
        return seckillService.currentRound();
    }

    @Operation(summary = "本场秒杀活动列表（首页秒杀楼层，按场次自动轮换，带本轮是否已抢）")
    @GetMapping("/list")
    public List<SeckillActivityDTO> listActive(
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {
        return seckillService.listActive(userId);
    }

    @Operation(summary = "秒杀活动详情（含本轮是否已抢过）")
    @GetMapping("/{id}")
    public SeckillActivityDTO detail(@PathVariable("id") Long id,
                                     @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {
        return seckillService.detail(id, userId);
    }

    @Operation(summary = "抢购（防超卖 + 防重复，成功返回普通订单 id）")
    @PostMapping("/{id}/grab")
    public SeckillResultDTO grab(@PathVariable("id") Long id,
                                 @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {
        return seckillService.seckill(id, userId);
    }

    @Operation(summary = "高并发压测：服务端真打 N 个并发抢购，返回成功/售罄/重复/耗时/QPS")
    @PostMapping("/{id}/bench")
    public SeckillBenchDTO bench(@PathVariable("id") Long id,
                                 @RequestParam(value = "concurrency", defaultValue = "100") int concurrency,
                                 @RequestParam(value = "autoReset", defaultValue = "true") boolean autoReset) {
        return seckillService.bench(id, concurrency, autoReset);
    }

    @Operation(summary = "重置本场：清掉本轮抢购记录，库存回到初始值")
    @PostMapping("/{id}/reset")
    public Integer reset(@PathVariable("id") Long id) {
        return seckillService.resetRound(id);
    }
}
