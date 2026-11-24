CREATE TABLE IF NOT EXISTS orders (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT         NOT NULL,
    total_fee   DECIMAL(10,2)  NOT NULL,
    pay_type    TINYINT        DEFAULT 1,
    status      TINYINT        NOT NULL DEFAULT 1,
    order_type  TINYINT        DEFAULT 1,
    address     VARCHAR(255),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pay_time    TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 老库升级：order_type 是秒杀功能新增的列
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TINYINT DEFAULT 1;

CREATE TABLE IF NOT EXISTS order_detail (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT        NOT NULL,
    item_id  BIGINT        NOT NULL,
    name     VARCHAR(64),
    price    DECIMAL(10,2),
    num      INT,
    image    VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_detail_order ON order_detail (order_id);
