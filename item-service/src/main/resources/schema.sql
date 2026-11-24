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
    status        TINYINT        NOT NULL DEFAULT 1,
    create_time   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    update_time   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

-- 老库升级：上面的 CREATE TABLE IF NOT EXISTS 对已存在的表不生效，
-- 所以每个新增列都要单独 ADD COLUMN IF NOT EXISTS，否则启动时查新字段直接报列不存在
ALTER TABLE item ADD COLUMN IF NOT EXISTS subtitle      VARCHAR(128);
ALTER TABLE item ADD COLUMN IF NOT EXISTS brand         VARCHAR(32);
ALTER TABLE item ADD COLUMN IF NOT EXISTS sales         INT DEFAULT 0;
ALTER TABLE item ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;
ALTER TABLE item ADD COLUMN IF NOT EXISTS good_rate     INT DEFAULT 98;
ALTER TABLE item ADD COLUMN IF NOT EXISTS tag           VARCHAR(16);

-- ============================================================
-- 秒杀活动：限时秒杀的高并发处理
-- ============================================================
-- 秒杀库存独立于商品日常库存，扣完即止；扣减用「单条 UPDATE + stock>0 条件」保证不超卖
CREATE TABLE IF NOT EXISTS seckill_activity (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id       BIGINT        NOT NULL,
    seckill_price DECIMAL(10,2) NOT NULL,
    stock         INT           NOT NULL DEFAULT 0,
    start_time    TIMESTAMP,
    end_time      TIMESTAMP,
    status        TINYINT       NOT NULL DEFAULT 1,
    title         VARCHAR(128),
    create_time   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_seckill_item ON seckill_activity (item_id);

-- 秒杀订单：(activity_id, user_id) 唯一索引 = 一人一场只能抢到一单，杜绝重复抢购
CREATE TABLE IF NOT EXISTS seckill_order (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    activity_id BIGINT  NOT NULL,
    user_id     BIGINT  NOT NULL,
    order_id    BIGINT,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_seckill_user UNIQUE (activity_id, user_id)
);
