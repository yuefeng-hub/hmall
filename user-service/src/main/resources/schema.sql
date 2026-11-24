CREATE TABLE IF NOT EXISTS users (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32)   NOT NULL,
    password VARCHAR(64)   NOT NULL,
    balance  DECIMAL(10,2) NOT NULL DEFAULT 0,
    status   VARCHAR(16)   DEFAULT '正常'
);

-- 邮箱：后加的列。老库里 users 表已经存在，CREATE TABLE IF NOT EXISTS 不会生效，
-- 所以必须单独 ADD COLUMN IF NOT EXISTS，否则第一次启动就会报「列不存在」
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100);

-- 唯一索引：一个邮箱只能绑一个账号。
-- H2 的 UNIQUE 索引视多个 NULL 为互不相同，所以历史账号（email 为空）不会被互相冲突
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_email ON users (email);

-- 邮箱验证码：每次发码插一行，用 used 标记是否已消费，实现「一次性」
CREATE TABLE IF NOT EXISTS email_code (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(100) NOT NULL,
    code        VARCHAR(8)   NOT NULL,
    purpose     VARCHAR(16)  NOT NULL,
    used        TINYINT      NOT NULL DEFAULT 0,
    expired_at  TIMESTAMP    NOT NULL,
    create_time TIMESTAMP    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_code ON email_code (email, purpose, create_time);

-- 充值流水：每笔充值记一条，供「最近充值」列表展示
CREATE TABLE IF NOT EXISTS recharge_record (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT        NOT NULL,
    recharge_no VARCHAR(32)   NOT NULL,
    amount      DECIMAL(10,2) NOT NULL,
    channel     VARCHAR(16)   NOT NULL,
    status      TINYINT       NOT NULL DEFAULT 1,
    create_time TIMESTAMP     NOT NULL
);

-- 登录令牌：落库后服务重启也不会把用户踢回登录页。
-- 不用 JWT，token 就是随机串；过期时间存在库里，resolve 时判断并顺手删掉
CREATE TABLE IF NOT EXISTS user_token (
    token       VARCHAR(64) PRIMARY KEY,
    user_id     BIGINT        NOT NULL,
    expires_at  TIMESTAMP     NOT NULL,
    create_time TIMESTAMP     NOT NULL
);
