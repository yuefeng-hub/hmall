-- ============================================================
-- 秒杀活动种子数据（幂等：只在 id 不存在时插入）
--
-- 【场次规则】活动按 slot_no 分成若干组，服务端每 round-minutes 分钟换一组，
-- 组内商品同时开抢、到点一起结束，下一组自动接上。整个过程不依赖 start_time/end_time，
-- 所以隔几天再启动服务也永远有正在进行中的场次（老版本写死「插入当天」，
-- 过期之后首页秒杀楼层就是空的）。
--   round-minutes 与组数在 application.yml 的 hmall.seckill.* 里配，默认 10 分钟 / 3 组。
--
-- 【重置库存】抢光了想再演示：POST /seckill/{id}/reset，或点首页「重置本场库存」。
-- ============================================================

-- 老版本那 5 条活动（101-105）已经过期，下架掉，避免和新的场次数据混在一起
UPDATE seckill_activity SET status = 0 WHERE id BETWEEN 101 AND 105;

-- ---------- 组 0：手机 · 影音 ----------
INSERT INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
SELECT 201, 13, 999.00, 50, 50, 0, 1, 'Redmi K70 旗舰秒杀'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 201);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
SELECT 202, 2, 199.00, 80, 80, 0, 1, '华为 FreeBuds Pro 3 半价'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 202);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
SELECT 203, 39, 899.00, 40, 40, 0, 1, 'AirPods Pro 2 直降一千'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 203);

-- ---------- 组 1：办公 · 数码 ----------
INSERT INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
SELECT 204, 4, 749.00, 35, 35, 1, 1, 'AOC 27 英寸 2K 电竞屏'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 204);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
SELECT 205, 20, 4299.00, 15, 15, 1, 1, '华为 MateBook 14 Ultra'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 205);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
SELECT 206, 6, 39.00, 120, 120, 1, 1, '绿联铝合金支架 3 折'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 206);

-- ---------- 组 2：家电 · 穿戴 ----------
INSERT INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
SELECT 207, 29, 1399.00, 25, 25, 2, 1, '小米电视 S Pro 65 英寸'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 207);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
SELECT 208, 9, 649.00, 45, 45, 2, 1, '华为 WATCH GT4 五折'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 208);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
SELECT 209, 28, 1999.00, 12, 12, 2, 1, '戴森 V12 无线吸尘器'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 209);

-- 老库补数据：这几条之前是靠 start_time/end_time 判定的，没有 slot_no / init_stock
UPDATE seckill_activity SET init_stock = stock WHERE init_stock IS NULL OR init_stock = 0;
