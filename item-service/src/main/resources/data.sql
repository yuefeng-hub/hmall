-- ============================================================
-- 商品种子数据（由 scripts/gen-seed.py 生成，别手工改这个文件）
-- 规则：只在「该 id 不存在」时插入；已存在的行只补新增字段，
--       绝不动 price / stock —— 用户买过、改过的数据不能被重启覆盖。
-- ============================================================

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 1, '小米 14 Pro 16GB+512GB 钛金属', '2K 全等深微曲屏 · 徕卡光学镜头 · 骁龙 8 Gen3', 3999.00, 100, 'images/p1.jpg', '手机通讯', '小米', 186300, 52100, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 1);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 11, 'Apple iPhone 15 Pro 256GB 原色钛金属', 'A17 Pro 芯片 · 钛金属边框 · 支持 USB-C', 7999.00, 60, 'images/p11.jpg', '手机通讯', 'Apple', 98234, 31200, 99, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 11);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 12, '华为 Mate 60 Pro 12GB+512GB 雅川青', '卫星通话 · 玄武钢化昆仑玻璃 · 超长续航', 6999.00, 45, 'images/p12.jpg', '手机通讯', '华为', 76520, 24100, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 12);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 13, 'Redmi K70 16GB+512GB 墨羽', '第二代骁龙 8 · 2K 中国屏 · 120W 秒充', 2499.00, 120, 'images/p13.jpg', '手机通讯', '小米', 156800, 45200, 97, '秒杀', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 13);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 14, 'OPPO Find X7 16GB+256GB 大漠银月', '天玑 9300 · 哈苏人像四摄 · 100W 闪充', 4999.00, 40, 'images/p14.jpg', '手机通讯', 'OPPO', 43210, 12800, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 14);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 15, 'vivo X100 16GB+512GB 落日橙', '蔡司超级长焦 · 天玑 9300 · 蓝海电池', 4299.00, 55, 'images/p15.jpg', '手机通讯', 'vivo', 52130, 15600, 98, '热卖', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 15);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 16, '荣耀 Magic6 16GB+512GB 绒黑色', '鹰眼相机 · 青海湖电池 · 巨犀玻璃', 4399.00, 38, 'images/p16.jpg', '手机通讯', '荣耀', 38760, 11200, 97, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 16);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 17, '一加 12 16GB+512GB 岩板绿', '2K 东方屏 · 骁龙 8 Gen3 · 100W 超级闪充', 4299.00, 42, 'images/p17.jpg', '手机通讯', '一加', 29870, 8900, 97, '新品', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 17);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 18, '三星 Galaxy S24 8GB+256GB 钛灰', '骁龙 8 Gen3 · Galaxy AI · 120Hz 自适应屏', 5999.00, 25, 'images/p18.jpg', '手机通讯', '三星', 18760, 5400, 96, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 18);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 3, '黑爵 AK820 机械键盘 三模热插拔', 'Gasket 结构 · PBT 键帽 · 支持有线/2.4G/蓝牙', 329.00, 80, 'images/p3.jpg', '电脑办公', '黑爵', 67400, 21300, 97, '热卖', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 3);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 4, 'AOC Q27G3S 27 英寸 2K 电竞显示器', '180Hz 高刷 · 1ms 响应 · HDR400', 1499.00, 50, 'images/p4.jpg', '电脑办公', 'AOC', 34500, 12400, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 4);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 5, '罗技 M590 多设备静音无线鼠标', '双模连接 · 静音按键 · 一键跨屏切换', 249.00, 150, 'images/p5.jpg', '电脑办公', '罗技', 89200, 26800, 98, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 5);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 7, '西部数据 Elements 2TB 移动硬盘', 'USB3.0 高速传输 · 即插即用 · 三年质保', 699.00, 60, 'images/p7.jpg', '电脑办公', '西部数据', 43200, 15600, 97, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 7);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 19, '联想拯救者 Y9000P 2024 i9/RTX4060', '16 英寸 2.5K 240Hz · 满血 4060 · 霜刃散热', 9499.00, 30, 'images/p19.jpg', '电脑办公', '联想', 23400, 7600, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 19);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 20, '华为 MateBook 14 酷睿 Ultra 5', '3:2 2.8K 触控全面屏 · 1.31kg 轻办公', 5999.00, 35, 'images/p20.jpg', '电脑办公', '华为', 19800, 6200, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 20);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 21, 'Apple MacBook Air 13 英寸 M3 8+256G', 'M3 芯片 · 18 小时续航 · 1.24kg', 8999.00, 20, 'images/p21.jpg', '电脑办公', 'Apple', 31200, 9800, 99, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 21);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 22, '戴尔 XPS 13 9340 酷睿 Ultra 7', '13.4 英寸 3K OLED 触控屏 · 全金属机身', 8999.00, 18, 'images/p22.jpg', '电脑办公', '戴尔', 8900, 2600, 97, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 22);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 23, 'ThinkPad X1 Carbon AI 2024', '14 英寸 2.8K OLED · 商务旗舰 · 军标认证', 10999.00, 12, 'images/p23.jpg', '电脑办公', '联想', 6700, 2100, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 23);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 24, '惠普战 66 六代 锐龙 R7', '16 英寸高色域屏 · 全金属机身 · 双内存插槽', 4999.00, 50, 'images/p24.jpg', '电脑办公', '惠普', 27600, 8400, 97, '热卖', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 24);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 47, '雷蛇黑寡妇 V4 机械键盘', '绿轴段落手感 · RGB 幻彩 · 铝合金面板', 899.00, 45, 'images/p47.jpg', '电脑办公', '雷蛇', 12300, 4200, 96, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 47);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 25, '美的 1.5 匹新一级变频空调挂机', '智能自清洁 · 静音省电 · 以旧换新', 2799.00, 80, 'images/p25.jpg', '家用电器', '美的', 45200, 13400, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 25);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 26, '海尔 501L 十字对开门冰箱', '一级能效 · 干湿分储 · 母婴空间', 4299.00, 35, 'images/p26.jpg', '家用电器', '海尔', 12800, 4200, 97, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 26);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 27, '小天鹅 10 公斤滚筒洗衣机', '水魔方洗烘一体 · 除螨除菌 · 变频静音', 2499.00, 60, 'images/p27.jpg', '家用电器', '小天鹅', 23400, 7800, 98, '热卖', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 27);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 28, '戴森 V12 Detect Slim 无线吸尘器', '激光探测微尘 · 整机过滤 · 轻量手持', 3799.00, 25, 'images/p28.jpg', '家用电器', '戴森', 9800, 3400, 99, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 28);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 29, '小米电视 S Pro 65 英寸 Mini LED', '4K 144Hz · 澎湃 OS · 远场语音', 2799.00, 70, 'images/p29.jpg', '家用电器', '小米', 34500, 11200, 97, '秒杀', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 29);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 30, '九阳破壁豆浆机 DJ13B', '免滤免煮 · 一键清洗 · 12 小时预约', 399.00, 200, 'images/p30.jpg', '家用电器', '九阳', 56700, 18900, 96, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 30);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 31, '格力 1.5 匹云锦三代变频挂机', '新一级能效 · 双级增焓压缩机 · 56℃ 高温自清洁', 2999.00, 55, 'images/p31.jpg', '家用电器', '格力', 31200, 9800, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 31);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 32, '老板 27A3S 侧吸抽油烟机', '大吸力静音 · 免拆洗 · 挥手智控', 3299.00, 30, 'images/p32.jpg', '家用电器', '老板', 8700, 2600, 97, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 32);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 2, '华为 FreeBuds Pro 3 真无线降噪耳机', '双单元三分频 · 智慧动态降噪 · 星闪连接', 599.00, 200, 'images/p2.jpg', '影音娱乐', '华为', 76500, 24300, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 2);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 8, '索尼 WH-1000XM5 头戴式降噪耳机', '八麦克风降噪 · 30 小时续航 · Hi-Res 认证', 2499.00, 30, 'images/p8.jpg', '影音娱乐', '索尼', 42300, 14800, 99, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 8);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 33, '索尼 PS5 Slim 光驱版游戏主机', '1TB 高速 SSD · 支持 4K 120Hz · 光追', 3899.00, 40, 'images/p33.jpg', '影音娱乐', '索尼', 18900, 6700, 99, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 33);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 34, 'JBL GO4 音乐金砖四代蓝牙音箱', '便携防水 · 16 小时续航 · 蓝牙 5.3', 799.00, 120, 'images/p34.jpg', '影音娱乐', 'JBL', 42300, 14500, 97, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 34);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 35, '漫步者 R1700BT 蓝牙书架音箱', '木质箱体 · 三分频设计 · 遥控调节', 599.00, 90, 'images/p35.jpg', '影音娱乐', '漫步者', 23400, 7600, 98, '热卖', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 35);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 36, '森海塞尔 HD600 开放式头戴耳机', '发烧级 · 经典参考级音质 · 可换线设计', 2299.00, 20, 'images/p36.jpg', '影音娱乐', '森海塞尔', 5600, 1800, 99, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 36);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 37, '大疆 Osmo Pocket 3 口袋云台相机', '1 英寸底 · 2 英寸旋转屏 · 三轴增稳', 3499.00, 35, 'images/p37.jpg', '影音娱乐', '大疆', 15600, 5200, 99, '新品', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 37);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 39, 'Apple AirPods Pro 2 USB-C', '主动降噪 · 自适应通透 · 6 小时聆听', 1899.00, 80, 'images/p39.jpg', '影音娱乐', 'Apple', 67800, 23400, 99, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 39);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 48, '索尼 A7M4 全画幅微单相机', '3300 万像素 · 4K 60P · 五轴防抖', 15999.00, 8, 'images/p48.jpg', '影音娱乐', '索尼', 3200, 1100, 99, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 48);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 9, '华为 WATCH GT4 46mm 智能手表', '八通道心率 · 双频 GPS · 14 天长续航', 1299.00, 45, 'images/p9.jpg', '智能穿戴', '华为', 56700, 18900, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 9);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 38, 'Apple Watch S9 45mm GPS 版', 'S9 芯片 · 双指互点 · 全天候视网膜屏', 2999.00, 28, 'images/p38.jpg', '智能穿戴', 'Apple', 21400, 7300, 99, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 38);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 40, '华为手环 9 NFC 版', '1.47 英寸 AMOLED · 睡眠监测 · 14 天续航', 299.00, 300, 'images/p40.jpg', '智能穿戴', '华为', 89200, 26700, 97, '秒杀', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 40);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 41, '小米手环 8 Pro', '大屏高清 · 150+ 运动模式 · 双 PD 快充', 399.00, 250, 'images/p41.jpg', '智能穿戴', '小米', 76500, 21300, 96, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 41);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 42, '佳明 Forerunner 265 跑步腕表', 'AMOLED 屏 · 多频 GPS · 训练指导', 2999.00, 15, 'images/p42.jpg', '智能穿戴', '佳明', 4300, 1500, 98, '自营', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 42);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 6, '绿联铝合金笔记本支架', '六档调节 · 散热镂空 · 承重 10kg', 129.00, 300, 'images/p6.jpg', '数码配件', '绿联', 98700, 31200, 97, '热卖', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 6);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 10, '小米移动电源 3 20000mAh 快充版', '双向 22.5W 快充 · 双 USB 输出 · 聚合物电芯', 199.00, 500, 'images/p10.jpg', '数码配件', '小米', 134000, 42300, 97, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 10);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 43, '倍思 65W 氮化镓充电器', '双 C 口 · 迷你便携 · 兼容手机笔记本', 149.00, 400, 'images/p43.jpg', '数码配件', '倍思', 123000, 34500, 96, '热卖', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 43);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 44, '绿联 Type-C 十合一扩展坞', '4K HDMI · 千兆网口 · PD100W 供电', 199.00, 300, 'images/p44.jpg', '数码配件', '绿联', 56700, 18200, 97, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 44);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 45, '闪迪 128GB TF 存储卡', '高速读写 · 行车记录仪专用 · 耐高温', 89.00, 500, 'images/p45.jpg', '数码配件', '闪迪', 98700, 28900, 96, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 45);

INSERT INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status)
SELECT 46, '罗技 C920 Pro 高清摄像头', '1080P 全高清 · 双麦克风降噪 · 自动对焦', 499.00, 150, 'images/p46.jpg', '数码配件', '罗技', 23400, 7800, 97, '', 1
WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = 46);

-- 老库补齐：早期版本 item 表没有这些列，加列后原有 10 行全是 NULL。
-- 用 brand IS NULL 做判据，保证只在「从没补过」时执行一次。
UPDATE item SET name='小米 14 Pro 16GB+512GB 钛金属', subtitle='2K 全等深微曲屏 · 徕卡光学镜头 · 骁龙 8 Gen3', image='images/p1.jpg', category='手机通讯', brand='小米', sales=186300, comment_count=52100, good_rate=98, tag='自营'
WHERE id=1 AND (brand IS NULL OR brand='');
UPDATE item SET name='Apple iPhone 15 Pro 256GB 原色钛金属', subtitle='A17 Pro 芯片 · 钛金属边框 · 支持 USB-C', image='images/p11.jpg', category='手机通讯', brand='Apple', sales=98234, comment_count=31200, good_rate=99, tag='自营'
WHERE id=11 AND (brand IS NULL OR brand='');
UPDATE item SET name='华为 Mate 60 Pro 12GB+512GB 雅川青', subtitle='卫星通话 · 玄武钢化昆仑玻璃 · 超长续航', image='images/p12.jpg', category='手机通讯', brand='华为', sales=76520, comment_count=24100, good_rate=98, tag='自营'
WHERE id=12 AND (brand IS NULL OR brand='');
UPDATE item SET name='Redmi K70 16GB+512GB 墨羽', subtitle='第二代骁龙 8 · 2K 中国屏 · 120W 秒充', image='images/p13.jpg', category='手机通讯', brand='小米', sales=156800, comment_count=45200, good_rate=97, tag='秒杀'
WHERE id=13 AND (brand IS NULL OR brand='');
UPDATE item SET name='OPPO Find X7 16GB+256GB 大漠银月', subtitle='天玑 9300 · 哈苏人像四摄 · 100W 闪充', image='images/p14.jpg', category='手机通讯', brand='OPPO', sales=43210, comment_count=12800, good_rate=98, tag='自营'
WHERE id=14 AND (brand IS NULL OR brand='');
UPDATE item SET name='vivo X100 16GB+512GB 落日橙', subtitle='蔡司超级长焦 · 天玑 9300 · 蓝海电池', image='images/p15.jpg', category='手机通讯', brand='vivo', sales=52130, comment_count=15600, good_rate=98, tag='热卖'
WHERE id=15 AND (brand IS NULL OR brand='');
UPDATE item SET name='荣耀 Magic6 16GB+512GB 绒黑色', subtitle='鹰眼相机 · 青海湖电池 · 巨犀玻璃', image='images/p16.jpg', category='手机通讯', brand='荣耀', sales=38760, comment_count=11200, good_rate=97, tag=''
WHERE id=16 AND (brand IS NULL OR brand='');
UPDATE item SET name='一加 12 16GB+512GB 岩板绿', subtitle='2K 东方屏 · 骁龙 8 Gen3 · 100W 超级闪充', image='images/p17.jpg', category='手机通讯', brand='一加', sales=29870, comment_count=8900, good_rate=97, tag='新品'
WHERE id=17 AND (brand IS NULL OR brand='');
UPDATE item SET name='三星 Galaxy S24 8GB+256GB 钛灰', subtitle='骁龙 8 Gen3 · Galaxy AI · 120Hz 自适应屏', image='images/p18.jpg', category='手机通讯', brand='三星', sales=18760, comment_count=5400, good_rate=96, tag='自营'
WHERE id=18 AND (brand IS NULL OR brand='');
UPDATE item SET name='黑爵 AK820 机械键盘 三模热插拔', subtitle='Gasket 结构 · PBT 键帽 · 支持有线/2.4G/蓝牙', image='images/p3.jpg', category='电脑办公', brand='黑爵', sales=67400, comment_count=21300, good_rate=97, tag='热卖'
WHERE id=3 AND (brand IS NULL OR brand='');
UPDATE item SET name='AOC Q27G3S 27 英寸 2K 电竞显示器', subtitle='180Hz 高刷 · 1ms 响应 · HDR400', image='images/p4.jpg', category='电脑办公', brand='AOC', sales=34500, comment_count=12400, good_rate=98, tag='自营'
WHERE id=4 AND (brand IS NULL OR brand='');
UPDATE item SET name='罗技 M590 多设备静音无线鼠标', subtitle='双模连接 · 静音按键 · 一键跨屏切换', image='images/p5.jpg', category='电脑办公', brand='罗技', sales=89200, comment_count=26800, good_rate=98, tag=''
WHERE id=5 AND (brand IS NULL OR brand='');
UPDATE item SET name='西部数据 Elements 2TB 移动硬盘', subtitle='USB3.0 高速传输 · 即插即用 · 三年质保', image='images/p7.jpg', category='电脑办公', brand='西部数据', sales=43200, comment_count=15600, good_rate=97, tag='自营'
WHERE id=7 AND (brand IS NULL OR brand='');
UPDATE item SET name='联想拯救者 Y9000P 2024 i9/RTX4060', subtitle='16 英寸 2.5K 240Hz · 满血 4060 · 霜刃散热', image='images/p19.jpg', category='电脑办公', brand='联想', sales=23400, comment_count=7600, good_rate=98, tag='自营'
WHERE id=19 AND (brand IS NULL OR brand='');
UPDATE item SET name='华为 MateBook 14 酷睿 Ultra 5', subtitle='3:2 2.8K 触控全面屏 · 1.31kg 轻办公', image='images/p20.jpg', category='电脑办公', brand='华为', sales=19800, comment_count=6200, good_rate=98, tag='自营'
WHERE id=20 AND (brand IS NULL OR brand='');
UPDATE item SET name='Apple MacBook Air 13 英寸 M3 8+256G', subtitle='M3 芯片 · 18 小时续航 · 1.24kg', image='images/p21.jpg', category='电脑办公', brand='Apple', sales=31200, comment_count=9800, good_rate=99, tag='自营'
WHERE id=21 AND (brand IS NULL OR brand='');
UPDATE item SET name='戴尔 XPS 13 9340 酷睿 Ultra 7', subtitle='13.4 英寸 3K OLED 触控屏 · 全金属机身', image='images/p22.jpg', category='电脑办公', brand='戴尔', sales=8900, comment_count=2600, good_rate=97, tag=''
WHERE id=22 AND (brand IS NULL OR brand='');
UPDATE item SET name='ThinkPad X1 Carbon AI 2024', subtitle='14 英寸 2.8K OLED · 商务旗舰 · 军标认证', image='images/p23.jpg', category='电脑办公', brand='联想', sales=6700, comment_count=2100, good_rate=98, tag='自营'
WHERE id=23 AND (brand IS NULL OR brand='');
UPDATE item SET name='惠普战 66 六代 锐龙 R7', subtitle='16 英寸高色域屏 · 全金属机身 · 双内存插槽', image='images/p24.jpg', category='电脑办公', brand='惠普', sales=27600, comment_count=8400, good_rate=97, tag='热卖'
WHERE id=24 AND (brand IS NULL OR brand='');
UPDATE item SET name='雷蛇黑寡妇 V4 机械键盘', subtitle='绿轴段落手感 · RGB 幻彩 · 铝合金面板', image='images/p47.jpg', category='电脑办公', brand='雷蛇', sales=12300, comment_count=4200, good_rate=96, tag=''
WHERE id=47 AND (brand IS NULL OR brand='');
UPDATE item SET name='美的 1.5 匹新一级变频空调挂机', subtitle='智能自清洁 · 静音省电 · 以旧换新', image='images/p25.jpg', category='家用电器', brand='美的', sales=45200, comment_count=13400, good_rate=98, tag='自营'
WHERE id=25 AND (brand IS NULL OR brand='');
UPDATE item SET name='海尔 501L 十字对开门冰箱', subtitle='一级能效 · 干湿分储 · 母婴空间', image='images/p26.jpg', category='家用电器', brand='海尔', sales=12800, comment_count=4200, good_rate=97, tag='自营'
WHERE id=26 AND (brand IS NULL OR brand='');
UPDATE item SET name='小天鹅 10 公斤滚筒洗衣机', subtitle='水魔方洗烘一体 · 除螨除菌 · 变频静音', image='images/p27.jpg', category='家用电器', brand='小天鹅', sales=23400, comment_count=7800, good_rate=98, tag='热卖'
WHERE id=27 AND (brand IS NULL OR brand='');
UPDATE item SET name='戴森 V12 Detect Slim 无线吸尘器', subtitle='激光探测微尘 · 整机过滤 · 轻量手持', image='images/p28.jpg', category='家用电器', brand='戴森', sales=9800, comment_count=3400, good_rate=99, tag='自营'
WHERE id=28 AND (brand IS NULL OR brand='');
UPDATE item SET name='小米电视 S Pro 65 英寸 Mini LED', subtitle='4K 144Hz · 澎湃 OS · 远场语音', image='images/p29.jpg', category='家用电器', brand='小米', sales=34500, comment_count=11200, good_rate=97, tag='秒杀'
WHERE id=29 AND (brand IS NULL OR brand='');
UPDATE item SET name='九阳破壁豆浆机 DJ13B', subtitle='免滤免煮 · 一键清洗 · 12 小时预约', image='images/p30.jpg', category='家用电器', brand='九阳', sales=56700, comment_count=18900, good_rate=96, tag=''
WHERE id=30 AND (brand IS NULL OR brand='');
UPDATE item SET name='格力 1.5 匹云锦三代变频挂机', subtitle='新一级能效 · 双级增焓压缩机 · 56℃ 高温自清洁', image='images/p31.jpg', category='家用电器', brand='格力', sales=31200, comment_count=9800, good_rate=98, tag='自营'
WHERE id=31 AND (brand IS NULL OR brand='');
UPDATE item SET name='老板 27A3S 侧吸抽油烟机', subtitle='大吸力静音 · 免拆洗 · 挥手智控', image='images/p32.jpg', category='家用电器', brand='老板', sales=8700, comment_count=2600, good_rate=97, tag=''
WHERE id=32 AND (brand IS NULL OR brand='');
UPDATE item SET name='华为 FreeBuds Pro 3 真无线降噪耳机', subtitle='双单元三分频 · 智慧动态降噪 · 星闪连接', image='images/p2.jpg', category='影音娱乐', brand='华为', sales=76500, comment_count=24300, good_rate=98, tag='自营'
WHERE id=2 AND (brand IS NULL OR brand='');
UPDATE item SET name='索尼 WH-1000XM5 头戴式降噪耳机', subtitle='八麦克风降噪 · 30 小时续航 · Hi-Res 认证', image='images/p8.jpg', category='影音娱乐', brand='索尼', sales=42300, comment_count=14800, good_rate=99, tag='自营'
WHERE id=8 AND (brand IS NULL OR brand='');
UPDATE item SET name='索尼 PS5 Slim 光驱版游戏主机', subtitle='1TB 高速 SSD · 支持 4K 120Hz · 光追', image='images/p33.jpg', category='影音娱乐', brand='索尼', sales=18900, comment_count=6700, good_rate=99, tag='自营'
WHERE id=33 AND (brand IS NULL OR brand='');
UPDATE item SET name='JBL GO4 音乐金砖四代蓝牙音箱', subtitle='便携防水 · 16 小时续航 · 蓝牙 5.3', image='images/p34.jpg', category='影音娱乐', brand='JBL', sales=42300, comment_count=14500, good_rate=97, tag=''
WHERE id=34 AND (brand IS NULL OR brand='');
UPDATE item SET name='漫步者 R1700BT 蓝牙书架音箱', subtitle='木质箱体 · 三分频设计 · 遥控调节', image='images/p35.jpg', category='影音娱乐', brand='漫步者', sales=23400, comment_count=7600, good_rate=98, tag='热卖'
WHERE id=35 AND (brand IS NULL OR brand='');
UPDATE item SET name='森海塞尔 HD600 开放式头戴耳机', subtitle='发烧级 · 经典参考级音质 · 可换线设计', image='images/p36.jpg', category='影音娱乐', brand='森海塞尔', sales=5600, comment_count=1800, good_rate=99, tag='自营'
WHERE id=36 AND (brand IS NULL OR brand='');
UPDATE item SET name='大疆 Osmo Pocket 3 口袋云台相机', subtitle='1 英寸底 · 2 英寸旋转屏 · 三轴增稳', image='images/p37.jpg', category='影音娱乐', brand='大疆', sales=15600, comment_count=5200, good_rate=99, tag='新品'
WHERE id=37 AND (brand IS NULL OR brand='');
UPDATE item SET name='Apple AirPods Pro 2 USB-C', subtitle='主动降噪 · 自适应通透 · 6 小时聆听', image='images/p39.jpg', category='影音娱乐', brand='Apple', sales=67800, comment_count=23400, good_rate=99, tag='自营'
WHERE id=39 AND (brand IS NULL OR brand='');
UPDATE item SET name='索尼 A7M4 全画幅微单相机', subtitle='3300 万像素 · 4K 60P · 五轴防抖', image='images/p48.jpg', category='影音娱乐', brand='索尼', sales=3200, comment_count=1100, good_rate=99, tag='自营'
WHERE id=48 AND (brand IS NULL OR brand='');
UPDATE item SET name='华为 WATCH GT4 46mm 智能手表', subtitle='八通道心率 · 双频 GPS · 14 天长续航', image='images/p9.jpg', category='智能穿戴', brand='华为', sales=56700, comment_count=18900, good_rate=98, tag='自营'
WHERE id=9 AND (brand IS NULL OR brand='');
UPDATE item SET name='Apple Watch S9 45mm GPS 版', subtitle='S9 芯片 · 双指互点 · 全天候视网膜屏', image='images/p38.jpg', category='智能穿戴', brand='Apple', sales=21400, comment_count=7300, good_rate=99, tag='自营'
WHERE id=38 AND (brand IS NULL OR brand='');
UPDATE item SET name='华为手环 9 NFC 版', subtitle='1.47 英寸 AMOLED · 睡眠监测 · 14 天续航', image='images/p40.jpg', category='智能穿戴', brand='华为', sales=89200, comment_count=26700, good_rate=97, tag='秒杀'
WHERE id=40 AND (brand IS NULL OR brand='');
UPDATE item SET name='小米手环 8 Pro', subtitle='大屏高清 · 150+ 运动模式 · 双 PD 快充', image='images/p41.jpg', category='智能穿戴', brand='小米', sales=76500, comment_count=21300, good_rate=96, tag=''
WHERE id=41 AND (brand IS NULL OR brand='');
UPDATE item SET name='佳明 Forerunner 265 跑步腕表', subtitle='AMOLED 屏 · 多频 GPS · 训练指导', image='images/p42.jpg', category='智能穿戴', brand='佳明', sales=4300, comment_count=1500, good_rate=98, tag='自营'
WHERE id=42 AND (brand IS NULL OR brand='');
UPDATE item SET name='绿联铝合金笔记本支架', subtitle='六档调节 · 散热镂空 · 承重 10kg', image='images/p6.jpg', category='数码配件', brand='绿联', sales=98700, comment_count=31200, good_rate=97, tag='热卖'
WHERE id=6 AND (brand IS NULL OR brand='');
UPDATE item SET name='小米移动电源 3 20000mAh 快充版', subtitle='双向 22.5W 快充 · 双 USB 输出 · 聚合物电芯', image='images/p10.jpg', category='数码配件', brand='小米', sales=134000, comment_count=42300, good_rate=97, tag=''
WHERE id=10 AND (brand IS NULL OR brand='');
UPDATE item SET name='倍思 65W 氮化镓充电器', subtitle='双 C 口 · 迷你便携 · 兼容手机笔记本', image='images/p43.jpg', category='数码配件', brand='倍思', sales=123000, comment_count=34500, good_rate=96, tag='热卖'
WHERE id=43 AND (brand IS NULL OR brand='');
UPDATE item SET name='绿联 Type-C 十合一扩展坞', subtitle='4K HDMI · 千兆网口 · PD100W 供电', image='images/p44.jpg', category='数码配件', brand='绿联', sales=56700, comment_count=18200, good_rate=97, tag=''
WHERE id=44 AND (brand IS NULL OR brand='');
UPDATE item SET name='闪迪 128GB TF 存储卡', subtitle='高速读写 · 行车记录仪专用 · 耐高温', image='images/p45.jpg', category='数码配件', brand='闪迪', sales=98700, comment_count=28900, good_rate=96, tag=''
WHERE id=45 AND (brand IS NULL OR brand='');
UPDATE item SET name='罗技 C920 Pro 高清摄像头', subtitle='1080P 全高清 · 双麦克风降噪 · 自动对焦', image='images/p46.jpg', category='数码配件', brand='罗技', sales=23400, comment_count=7800, good_rate=97, tag=''
WHERE id=46 AND (brand IS NULL OR brand='');

-- 商品图从程序化生成的 SVG 换成真实产品摄影（纯字符串替换，可重复执行）
UPDATE item SET image = REPLACE(image, '.svg', '.jpg') WHERE image LIKE '%.svg';
