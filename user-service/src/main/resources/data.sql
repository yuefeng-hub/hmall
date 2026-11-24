-- 只在用户不存在时插入，避免文件库重启时把余额覆盖回初始值（也避免主键冲突）
INSERT INTO users (id, username, password, balance, status)
SELECT 1, 'zhangsan', 'e10adc3949ba59abbe56e057f20f883e', 5000.00, '正常'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 1);

INSERT INTO users (id, username, password, balance, status)
SELECT 2, 'lisi', 'e10adc3949ba59abbe56e057f20f883e', 3000.00, '正常'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 2);

INSERT INTO users (id, username, password, balance, status)
SELECT 3, 'wangwu', 'e10adc3949ba59abbe56e057f20f883e', 1000.00, '正常'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 3);

-- 演示账号补一个邮箱，方便验证「邮箱验证码登录」：这三行只在 email 还是空的时候执行一次，
-- 不会覆盖你自己注册时填的邮箱
UPDATE users SET email = 'zhangsan@hmall.com' WHERE id = 1 AND (email IS NULL OR email = '');
UPDATE users SET email = 'lisi@hmall.com'     WHERE id = 2 AND (email IS NULL OR email = '');
UPDATE users SET email = 'wangwu@hmall.com'   WHERE id = 3 AND (email IS NULL OR email = '');
