SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS hm_item  DEFAULT CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS hm_cart  DEFAULT CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS hm_order DEFAULT CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS hm_pay   DEFAULT CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS hm_user  DEFAULT CHARACTER SET utf8mb4;

-- ============ hm_item ============
USE hm_item;
CREATE TABLE IF NOT EXISTS item (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(64)    NOT NULL,
    subtitle      VARCHAR(128),
    price         DECIMAL(10,2)  NOT NULL,
    stock         INT            NOT NULL DEFAULT 0,
    image         VARCHAR(255),
    category      VARCHAR(32),
    brand         VARCHAR(32),
    sales         INT            DEFAULT 0,
    comment_count INT            DEFAULT 0,
    good_rate     INT            DEFAULT 98,
    tag           VARCHAR(16),
    status        TINYINT        NOT NULL DEFAULT 1 COMMENT '1 上架 0 下架',
    create_time   DATETIME       DEFAULT CURRENT_TIMESTAMP,
    update_time   DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 幂等：重复执行本脚本时跳过已存在的行，别把改过的价格/库存/余额覆盖回初始值
-- 商品种子（MySQL 版，INSERT IGNORE 保证重复执行不撞主键）
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (1, '小米 14 Pro 16GB+512GB 钛金属', '2K 全等深微曲屏 · 徕卡光学镜头 · 骁龙 8 Gen3', 3999.00, 100, 'images/p1.jpg', '手机通讯', '小米', 186300, 52100, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (11, 'Apple iPhone 15 Pro 256GB 原色钛金属', 'A17 Pro 芯片 · 钛金属边框 · 支持 USB-C', 7999.00, 60, 'images/p11.jpg', '手机通讯', 'Apple', 98234, 31200, 99, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (12, '华为 Mate 60 Pro 12GB+512GB 雅川青', '卫星通话 · 玄武钢化昆仑玻璃 · 超长续航', 6999.00, 45, 'images/p12.jpg', '手机通讯', '华为', 76520, 24100, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (13, 'Redmi K70 16GB+512GB 墨羽', '第二代骁龙 8 · 2K 中国屏 · 120W 秒充', 2499.00, 120, 'images/p13.jpg', '手机通讯', '小米', 156800, 45200, 97, '秒杀', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (14, 'OPPO Find X7 16GB+256GB 大漠银月', '天玑 9300 · 哈苏人像四摄 · 100W 闪充', 4999.00, 40, 'images/p14.jpg', '手机通讯', 'OPPO', 43210, 12800, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (15, 'vivo X100 16GB+512GB 落日橙', '蔡司超级长焦 · 天玑 9300 · 蓝海电池', 4299.00, 55, 'images/p15.jpg', '手机通讯', 'vivo', 52130, 15600, 98, '热卖', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (16, '荣耀 Magic6 16GB+512GB 绒黑色', '鹰眼相机 · 青海湖电池 · 巨犀玻璃', 4399.00, 38, 'images/p16.jpg', '手机通讯', '荣耀', 38760, 11200, 97, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (17, '一加 12 16GB+512GB 岩板绿', '2K 东方屏 · 骁龙 8 Gen3 · 100W 超级闪充', 4299.00, 42, 'images/p17.jpg', '手机通讯', '一加', 29870, 8900, 97, '新品', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (18, '三星 Galaxy S24 8GB+256GB 钛灰', '骁龙 8 Gen3 · Galaxy AI · 120Hz 自适应屏', 5999.00, 25, 'images/p18.jpg', '手机通讯', '三星', 18760, 5400, 96, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (3, '黑爵 AK820 机械键盘 三模热插拔', 'Gasket 结构 · PBT 键帽 · 支持有线/2.4G/蓝牙', 329.00, 80, 'images/p3.jpg', '电脑办公', '黑爵', 67400, 21300, 97, '热卖', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (4, 'AOC Q27G3S 27 英寸 2K 电竞显示器', '180Hz 高刷 · 1ms 响应 · HDR400', 1499.00, 50, 'images/p4.jpg', '电脑办公', 'AOC', 34500, 12400, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (5, '罗技 M590 多设备静音无线鼠标', '双模连接 · 静音按键 · 一键跨屏切换', 249.00, 150, 'images/p5.jpg', '电脑办公', '罗技', 89200, 26800, 98, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (7, '西部数据 Elements 2TB 移动硬盘', 'USB3.0 高速传输 · 即插即用 · 三年质保', 699.00, 60, 'images/p7.jpg', '电脑办公', '西部数据', 43200, 15600, 97, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (19, '联想拯救者 Y9000P 2024 i9/RTX4060', '16 英寸 2.5K 240Hz · 满血 4060 · 霜刃散热', 9499.00, 30, 'images/p19.jpg', '电脑办公', '联想', 23400, 7600, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (20, '华为 MateBook 14 酷睿 Ultra 5', '3:2 2.8K 触控全面屏 · 1.31kg 轻办公', 5999.00, 35, 'images/p20.jpg', '电脑办公', '华为', 19800, 6200, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (21, 'Apple MacBook Air 13 英寸 M3 8+256G', 'M3 芯片 · 18 小时续航 · 1.24kg', 8999.00, 20, 'images/p21.jpg', '电脑办公', 'Apple', 31200, 9800, 99, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (22, '戴尔 XPS 13 9340 酷睿 Ultra 7', '13.4 英寸 3K OLED 触控屏 · 全金属机身', 8999.00, 18, 'images/p22.jpg', '电脑办公', '戴尔', 8900, 2600, 97, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (23, 'ThinkPad X1 Carbon AI 2024', '14 英寸 2.8K OLED · 商务旗舰 · 军标认证', 10999.00, 12, 'images/p23.jpg', '电脑办公', '联想', 6700, 2100, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (24, '惠普战 66 六代 锐龙 R7', '16 英寸高色域屏 · 全金属机身 · 双内存插槽', 4999.00, 50, 'images/p24.jpg', '电脑办公', '惠普', 27600, 8400, 97, '热卖', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (47, '雷蛇黑寡妇 V4 机械键盘', '绿轴段落手感 · RGB 幻彩 · 铝合金面板', 899.00, 45, 'images/p47.jpg', '电脑办公', '雷蛇', 12300, 4200, 96, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (25, '美的 1.5 匹新一级变频空调挂机', '智能自清洁 · 静音省电 · 以旧换新', 2799.00, 80, 'images/p25.jpg', '家用电器', '美的', 45200, 13400, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (26, '海尔 501L 十字对开门冰箱', '一级能效 · 干湿分储 · 母婴空间', 4299.00, 35, 'images/p26.jpg', '家用电器', '海尔', 12800, 4200, 97, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (27, '小天鹅 10 公斤滚筒洗衣机', '水魔方洗烘一体 · 除螨除菌 · 变频静音', 2499.00, 60, 'images/p27.jpg', '家用电器', '小天鹅', 23400, 7800, 98, '热卖', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (28, '戴森 V12 Detect Slim 无线吸尘器', '激光探测微尘 · 整机过滤 · 轻量手持', 3799.00, 25, 'images/p28.jpg', '家用电器', '戴森', 9800, 3400, 99, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (29, '小米电视 S Pro 65 英寸 Mini LED', '4K 144Hz · 澎湃 OS · 远场语音', 2799.00, 70, 'images/p29.jpg', '家用电器', '小米', 34500, 11200, 97, '秒杀', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (30, '九阳破壁豆浆机 DJ13B', '免滤免煮 · 一键清洗 · 12 小时预约', 399.00, 200, 'images/p30.jpg', '家用电器', '九阳', 56700, 18900, 96, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (31, '格力 1.5 匹云锦三代变频挂机', '新一级能效 · 双级增焓压缩机 · 56℃ 高温自清洁', 2999.00, 55, 'images/p31.jpg', '家用电器', '格力', 31200, 9800, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (32, '老板 27A3S 侧吸抽油烟机', '大吸力静音 · 免拆洗 · 挥手智控', 3299.00, 30, 'images/p32.jpg', '家用电器', '老板', 8700, 2600, 97, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (2, '华为 FreeBuds Pro 3 真无线降噪耳机', '双单元三分频 · 智慧动态降噪 · 星闪连接', 599.00, 200, 'images/p2.jpg', '影音娱乐', '华为', 76500, 24300, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (8, '索尼 WH-1000XM5 头戴式降噪耳机', '八麦克风降噪 · 30 小时续航 · Hi-Res 认证', 2499.00, 30, 'images/p8.jpg', '影音娱乐', '索尼', 42300, 14800, 99, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (33, '索尼 PS5 Slim 光驱版游戏主机', '1TB 高速 SSD · 支持 4K 120Hz · 光追', 3899.00, 40, 'images/p33.jpg', '影音娱乐', '索尼', 18900, 6700, 99, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (34, 'JBL GO4 音乐金砖四代蓝牙音箱', '便携防水 · 16 小时续航 · 蓝牙 5.3', 799.00, 120, 'images/p34.jpg', '影音娱乐', 'JBL', 42300, 14500, 97, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (35, '漫步者 R1700BT 蓝牙书架音箱', '木质箱体 · 三分频设计 · 遥控调节', 599.00, 90, 'images/p35.jpg', '影音娱乐', '漫步者', 23400, 7600, 98, '热卖', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (36, '森海塞尔 HD600 开放式头戴耳机', '发烧级 · 经典参考级音质 · 可换线设计', 2299.00, 20, 'images/p36.jpg', '影音娱乐', '森海塞尔', 5600, 1800, 99, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (37, '大疆 Osmo Pocket 3 口袋云台相机', '1 英寸底 · 2 英寸旋转屏 · 三轴增稳', 3499.00, 35, 'images/p37.jpg', '影音娱乐', '大疆', 15600, 5200, 99, '新品', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (39, 'Apple AirPods Pro 2 USB-C', '主动降噪 · 自适应通透 · 6 小时聆听', 1899.00, 80, 'images/p39.jpg', '影音娱乐', 'Apple', 67800, 23400, 99, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (48, '索尼 A7M4 全画幅微单相机', '3300 万像素 · 4K 60P · 五轴防抖', 15999.00, 8, 'images/p48.jpg', '影音娱乐', '索尼', 3200, 1100, 99, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (9, '华为 WATCH GT4 46mm 智能手表', '八通道心率 · 双频 GPS · 14 天长续航', 1299.00, 45, 'images/p9.jpg', '智能穿戴', '华为', 56700, 18900, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (38, 'Apple Watch S9 45mm GPS 版', 'S9 芯片 · 双指互点 · 全天候视网膜屏', 2999.00, 28, 'images/p38.jpg', '智能穿戴', 'Apple', 21400, 7300, 99, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (40, '华为手环 9 NFC 版', '1.47 英寸 AMOLED · 睡眠监测 · 14 天续航', 299.00, 300, 'images/p40.jpg', '智能穿戴', '华为', 89200, 26700, 97, '秒杀', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (41, '小米手环 8 Pro', '大屏高清 · 150+ 运动模式 · 双 PD 快充', 399.00, 250, 'images/p41.jpg', '智能穿戴', '小米', 76500, 21300, 96, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (42, '佳明 Forerunner 265 跑步腕表', 'AMOLED 屏 · 多频 GPS · 训练指导', 2999.00, 15, 'images/p42.jpg', '智能穿戴', '佳明', 4300, 1500, 98, '自营', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (6, '绿联铝合金笔记本支架', '六档调节 · 散热镂空 · 承重 10kg', 129.00, 300, 'images/p6.jpg', '数码配件', '绿联', 98700, 31200, 97, '热卖', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (10, '小米移动电源 3 20000mAh 快充版', '双向 22.5W 快充 · 双 USB 输出 · 聚合物电芯', 199.00, 500, 'images/p10.jpg', '数码配件', '小米', 134000, 42300, 97, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (43, '倍思 65W 氮化镓充电器', '双 C 口 · 迷你便携 · 兼容手机笔记本', 149.00, 400, 'images/p43.jpg', '数码配件', '倍思', 123000, 34500, 96, '热卖', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (44, '绿联 Type-C 十合一扩展坞', '4K HDMI · 千兆网口 · PD100W 供电', 199.00, 300, 'images/p44.jpg', '数码配件', '绿联', 56700, 18200, 97, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (45, '闪迪 128GB TF 存储卡', '高速读写 · 行车记录仪专用 · 耐高温', 89.00, 500, 'images/p45.jpg', '数码配件', '闪迪', 98700, 28900, 96, '', 1);
INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, sales, comment_count, good_rate, tag, status) VALUES (46, '罗技 C920 Pro 高清摄像头', '1080P 全高清 · 双麦克风降噪 · 自动对焦', 499.00, 150, 'images/p46.jpg', '数码配件', '罗技', 23400, 7800, 97, '', 1);

-- 老库升级：早期版本的商品图是程序化生成的 SVG，文件已不存在，这里换成真实产品摄影路径。
-- 幂等，可重复执行（与 H2 的 data.sql 末尾那条迁移语义一致）。
UPDATE item SET image = REPLACE(image, '.svg', '.jpg') WHERE image LIKE '%.svg';

-- ---- 秒杀活动（限时秒杀）----
-- slot_no：场次分组。服务端按「当前分钟 / round-minutes % group-count」算出当前组，
--          只取该组活动，场次于是自己滚动轮换，不依赖写死的 start_time/end_time
CREATE TABLE IF NOT EXISTS seckill_activity (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id       BIGINT        NOT NULL,
    seckill_price DECIMAL(10,2) NOT NULL,
    stock         INT           NOT NULL DEFAULT 0,
    init_stock    INT           DEFAULT 0,
    slot_no       INT           DEFAULT 0,
    start_time    DATETIME,
    end_time      DATETIME,
    status        TINYINT       NOT NULL DEFAULT 1,
    title         VARCHAR(128),
    create_time   DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_seckill_item (item_id),
    KEY idx_seckill_slot (slot_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 唯一键含 round_no：(activity_id, user_id, round_no) = 一人一轮一单，下一轮可以再抢
CREATE TABLE IF NOT EXISTS seckill_order (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    activity_id BIGINT  NOT NULL,
    user_id     BIGINT  NOT NULL,
    round_no    BIGINT  DEFAULT 0,
    order_id    BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_seckill_round (activity_id, user_id, round_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 老版本那 5 条活动（101-105）已过期，下架
UPDATE seckill_activity SET status = 0 WHERE id BETWEEN 101 AND 105;

-- 3 组 × 3 商品，每 10 分钟换一组（round-minutes / group-count 见 application.yml）
INSERT IGNORE INTO seckill_activity (id, item_id, seckill_price, stock, init_stock, slot_no, status, title)
VALUES
  -- 组 0：手机 · 影音
  (201, 13, 999.00,  50,  50,  0, 1, 'Redmi K70 旗舰秒杀'),
  (202, 2,  199.00,  80,  80,  0, 1, '华为 FreeBuds Pro 3 半价'),
  (203, 39, 899.00,  40,  40,  0, 1, 'AirPods Pro 2 直降一千'),
  -- 组 1：办公 · 数码
  (204, 4,  749.00,  35,  35,  1, 1, 'AOC 27 英寸 2K 电竞屏'),
  (205, 20, 4299.00, 15,  15,  1, 1, '华为 MateBook 14 Ultra'),
  (206, 6,  39.00,   120, 120, 1, 1, '绿联铝合金支架 3 折'),
  -- 组 2：家电 · 穿戴
  (207, 29, 1399.00, 25,  25,  2, 1, '小米电视 S Pro 65 英寸'),
  (208, 9,  649.00,  45,  45,  2, 1, '华为 WATCH GT4 五折'),
  (209, 28, 1999.00, 12,  12,  2, 1, '戴森 V12 无线吸尘器');

UPDATE seckill_activity SET init_stock = stock WHERE init_stock IS NULL OR init_stock = 0;

-- ============ hm_cart ============
USE hm_cart;
CREATE TABLE IF NOT EXISTS cart (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    item_id     BIGINT NOT NULL,
    num         INT    NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_cart_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ hm_order ============
USE hm_order;
CREATE TABLE IF NOT EXISTS orders (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT        NOT NULL,
    total_fee   DECIMAL(10,2) NOT NULL,
    pay_type    TINYINT       DEFAULT 1,
    status      TINYINT       NOT NULL DEFAULT 1 COMMENT '1 待支付 2 已支付 3 已取消',
    order_type  TINYINT       DEFAULT 1 COMMENT '1 普通 2 秒杀（秒杀单不扣商品库存、取消不回补）',
    address     VARCHAR(255),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    pay_time    DATETIME,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_order_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_detail (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT        NOT NULL,
    item_id  BIGINT        NOT NULL,
    name     VARCHAR(64),
    price    DECIMAL(10,2),
    num      INT,
    image    VARCHAR(255),
    KEY idx_detail_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ hm_pay ============
USE hm_pay;
CREATE TABLE IF NOT EXISTS pay_order (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    pay_order_no VARCHAR(64)   NOT NULL,
    order_id     BIGINT        NOT NULL,
    user_id      BIGINT        NOT NULL,
    amount       DECIMAL(10,2) NOT NULL,
    status       TINYINT       NOT NULL DEFAULT 0 COMMENT '0 待支付 1 已支付 2 已失败',
    pay_time     DATETIME,
    create_time  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pay_no (pay_order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ hm_user ============
USE hm_user;
CREATE TABLE IF NOT EXISTS users (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32)   NOT NULL,
    password VARCHAR(64)   NOT NULL COMMENT '支付密码，MD5',
    email    VARCHAR(100)  COMMENT '绑定邮箱，用于验证码注册与登录',
    balance  DECIMAL(10,2) NOT NULL DEFAULT 0,
    status   VARCHAR(16)   DEFAULT '正常',
    UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO users (id, username, password, balance, status) VALUES
 (1, 'zhangsan', 'e10adc3949ba59abbe56e057f20f883e', 5000.00, '正常'),
 (2, 'lisi',     'e10adc3949ba59abbe56e057f20f883e', 3000.00, '正常'),
 (3, 'wangwu',   'e10adc3949ba59abbe56e057f20f883e', 1000.00, '正常');

-- 演示账号补邮箱（只补空值，不覆盖你自己注册的邮箱）
UPDATE users SET email = 'zhangsan@hmall.com' WHERE id = 1 AND (email IS NULL OR email = '');
UPDATE users SET email = 'lisi@hmall.com'     WHERE id = 2 AND (email IS NULL OR email = '');
UPDATE users SET email = 'wangwu@hmall.com'   WHERE id = 3 AND (email IS NULL OR email = '');

-- 邮箱验证码
CREATE TABLE IF NOT EXISTS email_code (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(100) NOT NULL,
    code        VARCHAR(8)   NOT NULL,
    purpose     VARCHAR(16)  NOT NULL COMMENT 'LOGIN / REGISTER',
    used        TINYINT      NOT NULL DEFAULT 0,
    expired_at  DATETIME     NOT NULL,
    create_time DATETIME     NOT NULL,
    KEY idx_email_code (email, purpose, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 充值流水
CREATE TABLE IF NOT EXISTS recharge_record (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT        NOT NULL,
    recharge_no VARCHAR(32)   NOT NULL,
    amount      DECIMAL(10,2) NOT NULL,
    channel     VARCHAR(16)   NOT NULL COMMENT 'alipay / wechat / bank',
    status      TINYINT       NOT NULL DEFAULT 1 COMMENT '1 成功',
    create_time DATETIME      NOT NULL,
    KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 登录令牌（重启不失效）
CREATE TABLE IF NOT EXISTS user_token (
    token       VARCHAR(64) PRIMARY KEY,
    user_id     BIGINT        NOT NULL,
    expires_at  DATETIME      NOT NULL,
    create_time DATETIME      NOT NULL,
    KEY idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
