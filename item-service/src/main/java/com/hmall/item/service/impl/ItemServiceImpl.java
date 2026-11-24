package com.hmall.item.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hmall.common.dto.ItemDTO;
import com.hmall.common.dto.StockDTO;
import com.hmall.common.utils.CollUtils;
import com.hmall.item.entity.Item;
import com.hmall.item.exception.BizException;
import com.hmall.item.mapper.ItemMapper;
import com.hmall.item.service.ItemService;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ItemServiceImpl extends ServiceImpl<ItemMapper, Item> implements ItemService {

    @Override
    public List<ItemDTO> queryByIds(List<Long> ids) {
        if (CollUtils.isEmpty(ids)) {
            return new ArrayList<>();
        }
        List<Item> items = lambdaQuery().in(Item::getId, ids).list();
        return items.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public ItemDTO queryById(Long id) {
        Item item = getById(id);
        if (item == null) {
            throw new BizException("商品不存在: id=" + id, 404);
        }
        return toDTO(item);
    }

    @Override
    public List<ItemDTO> search(String category, String keyword, int limit) {
        // 上限 100：避免前端传 size=99999 把整库捞出来
        int size = limit <= 0 ? 60 : Math.min(limit, 100);

        LambdaQueryWrapper<Item> qw = Wrappers.lambdaQuery();
        qw.eq(Item::getStatus, 1);
        if (StringUtils.hasText(category) && !"全部".equals(category.trim())) {
            qw.eq(Item::getCategory, category.trim());
        }
        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim();
            // 三个字段做 OR 匹配，外面套 and() 保证不会把上面的分类条件冲掉
            qw.and(w -> w.like(Item::getName, kw)
                    .or().like(Item::getBrand, kw)
                    .or().like(Item::getSubtitle, kw));
        }
        // 按销量倒序，同销量按 id 升序，保证每次返回顺序稳定
        qw.orderByDesc(Item::getSales).orderByAsc(Item::getId);
        qw.last("limit " + size);

        return baseMapper.selectList(qw).stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public List<String> categories() {
        List<Item> items = lambdaQuery().eq(Item::getStatus, 1).list();
        // 用 LinkedHashMap 统计后按数量倒序，同数量保持首次出现顺序
        java.util.Map<String, Integer> counter = new java.util.LinkedHashMap<>();
        for (Item item : items) {
            String c = item.getCategory();
            if (StringUtils.hasText(c)) {
                counter.put(c, counter.getOrDefault(c, 0) + 1);
            }
        }
        return counter.entrySet().stream()
                .sorted((a, b) -> b.getValue() - a.getValue())
                .map(java.util.Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deductStock(List<StockDTO> list) {
        if (CollUtils.isEmpty(list)) {
            throw new BizException("库存扣减参数为空");
        }
        for (StockDTO s : list) {
            if (s.getNum() == null || s.getNum() <= 0) {
                throw new BizException("商品数量必须大于 0: itemId=" + s.getItemId());
            }
            int rows = baseMapper.deductStock(s.getItemId(), s.getNum());
            if (rows == 0) {
                // 抛异常让整个事务回滚，避免"扣了一半"
                throw new BizException("库存不足: itemId=" + s.getItemId());
            }
        }
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean restoreStock(List<StockDTO> list) {
        if (CollUtils.isEmpty(list)) {
            throw new BizException("库存回补参数为空");
        }
        for (StockDTO s : list) {
            if (s.getNum() == null || s.getNum() <= 0) {
                throw new BizException("回补数量必须大于 0: itemId=" + s.getItemId());
            }
            int rows = baseMapper.restoreStock(s.getItemId(), s.getNum());
            if (rows == 0) {
                // 商品被删了才会走到这，抛异常让整批回滚，别补一半
                throw new BizException("商品不存在，库存回补失败: itemId=" + s.getItemId());
            }
        }
        return true;
    }

    private ItemDTO toDTO(Item item) {
        ItemDTO dto = new ItemDTO();
        BeanUtils.copyProperties(item, dto);
        return dto;
    }
}
