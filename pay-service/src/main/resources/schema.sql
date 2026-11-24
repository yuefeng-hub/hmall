CREATE TABLE IF NOT EXISTS pay_order (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    pay_order_no VARCHAR(64)   NOT NULL,
    order_id     BIGINT        NOT NULL,
    user_id      BIGINT        NOT NULL,
    amount       DECIMAL(10,2) NOT NULL,
    status       TINYINT       NOT NULL DEFAULT 0,
    pay_time     TIMESTAMP,
    create_time  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_pay_no ON pay_order (pay_order_no);
