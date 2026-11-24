-- ============================================================
-- 秒杀活动种子数据（幂等：只在活动 id 不存在时插入）
-- 活动窗口：今天 0 点 ~ 明天 0 点（持续一整天），保证任何时候启动都在进行中，
-- 倒计时显示合理的 HH:MM:SS。想重新演示秒杀扣库存，跑 bash scripts/reset-data.sh -y 即可重置。
-- ============================================================

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, start_time, end_time, status, title)
SELECT 101, 13, 999.00, 50, CURRENT_DATE, DATEADD('DAY', 1, CURRENT_DATE), 1, 'Redmi K70 秒杀 · 5 折限量'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 101);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, start_time, end_time, status, title)
SELECT 102, 2, 299.00, 30, CURRENT_DATE, DATEADD('DAY', 1, CURRENT_DATE), 1, '华为 FreeBuds Pro 3 半价秒杀'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 102);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, start_time, end_time, status, title)
SELECT 103, 29, 1399.00, 20, CURRENT_DATE, DATEADD('DAY', 1, CURRENT_DATE), 1, '小米电视 S Pro 65 英寸秒杀'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 103);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, start_time, end_time, status, title)
SELECT 104, 9, 649.00, 40, CURRENT_DATE, DATEADD('DAY', 1, CURRENT_DATE), 1, '华为 WATCH GT4 秒杀'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 104);

INSERT INTO seckill_activity (id, item_id, seckill_price, stock, start_time, end_time, status, title)
SELECT 105, 6, 39.00, 100, CURRENT_DATE, DATEADD('DAY', 1, CURRENT_DATE), 1, '绿联笔记本支架秒杀'
WHERE NOT EXISTS (SELECT 1 FROM seckill_activity WHERE id = 105);
