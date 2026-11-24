package com.hmall.item.controller;

import com.hmall.common.dto.SeckillActivityDTO;
import com.hmall.common.dto.SeckillResultDTO;
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

    @Operation(summary = "进行中的秒杀活动列表（首页秒杀楼层）")
    @GetMapping("/list")
    public List<SeckillActivityDTO> listActive() {
        return seckillService.listActive();
    }

    @Operation(summary = "秒杀活动详情（含是否已抢过）")
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
}
