# hmall 黑马商城 · 微服务完整工程

对应课程《01-服务拆分-服务治理》的可运行工程：5 个微服务 + 公共模块，把课上讲的
**服务拆分、RestTemplate 服务调用、Nacos 服务注册与发现、@LoadBalanced 负载均衡** 全部落成代码，
并额外把 **下单、支付** 两条跨服务链路做通了。

已在 **JDK 11** 和 **JDK 25** 两个环境下分别 `mvn clean package` 编译通过，并在 JDK 25 下真实启动 5 个服务、跑通全部业务链路。

## 一、工程结构

```
hmall
├── pom.xml                 聚合工程（Spring Boot 2.7.18 + Spring Cloud 2021.0.8 + Alibaba 2021.0.5.0）
├── hm-common               共享 DTO 与工具（ItemDTO / OrderDTO / UserDTO / PayOrderDTO / CollUtils）
├── item-service    8081    商品：批量查询、扣减库存（条件更新防超卖）
├── cart-service    8082    购物车：增删改查，商品字段通过 RestTemplate 远程补齐
├── order-service   8083    订单：建单 + 扣库存 + 清购物车 + 我的订单列表
├── pay-service     8084    支付：创建支付单、校验密码、扣余额、回调订单
├── user-service    8085    用户：登录鉴权、余额、充值流水、密码校验
├── frontend/               纯静态前端：登录页 + 商城 + 充值页（直连 8081~8085）
├── db/all.sql              MySQL 建库建表 + 种子数据
├── docker-compose.yml      MySQL 8.0.31 + Nacos 2.1.0（课程原版环境）
├── scripts/                一键编译、启动、停止、冒烟测试
└── requests.http           IDEA HTTP Client 接口用例
```

模块职责与课程一致：单一职责、独立库（H2 模式下每个服务一个独立文件库，MySQL 模式下是 5 个独立 database）。

## 二、两种运行模式

| 模式 | 依赖 | 用途 | 启动方式 |
|---|---|---|---|
| **A 本地免依赖**（默认） | 只要 JDK 11 | 先跑通业务链路，不折腾环境 | `bash scripts/start-local.sh` |
| **B 课程原版**（nacos profile） | Docker + MySQL + Nacos | 验证服务注册、发现、负载均衡 | `docker compose up -d` 后 `bash scripts/start-nacos.sh` |

两套模式共用同一份代码，差别只在 profile：

- A 模式：**H2 文件库**（数据落盘在项目根 `data/`，重启不丢）+ `hmall.remote.item-url=http://localhost:8081` 这类直连地址，Nacos 关闭（`spring.cloud.nacos.discovery.enabled=false`）。
- B 模式：MySQL + Nacos，地址改成 **服务名**（`http://item-service`），RestTemplate 换成带 `@LoadBalanced` 的那个 Bean。

## 三、30 秒跑起来（模式 A）

```bash
# 1. 编译打包（首次会下载依赖，约 1~3 分钟）
bash scripts/build.sh

# 2. 启动 5 个服务
bash scripts/start-local.sh

# 3. 跑通完整链路：商品 -> 购物车 -> 下单 -> 支付 -> 幂等校验 -> 登录/充值
#    失败会以非 0 退出码结束，可直接接 CI
bash scripts/smoke-test.sh

# 4. 用完停止
bash scripts/stop-local.sh
```

或者直接在 IDEA 里依次启动 5 个 Application 类（端口已写在各自的 `application.yml`，无需额外配置）。

启动后可访问每个服务的 Swagger：`http://localhost:8081/swagger-ui.html`（8082~8085 同）。

### 打开前端页面

前端是纯静态页，不需要构建、不需要 node：

```bash
# 双击 frontend/open-shop.bat，或者直接打开
frontend/login.html
```

也可以起个静态服务（浏览器拦截 file:// 的 fetch 时用）：

```bash
python scripts/serve-frontend.py 8090   # 然后访问 http://localhost:8090/login.html
```

> 用自带的 `scripts/serve-frontend.py` 而不是 `python -m http.server`：后者是单线程的，
> 首页一次要拉 48 张商品图，HTTP/1.1 keep-alive 下会互相阻塞，20 秒都加载不完，
> 截图和端到端验证会大面积误判成「破图」。

页面流程：**登录/注册 → 商城首页 → 商品详情 → 购物车 → 我的订单 → 我的钱包（充值）**。

界面按京东的版式重做了一版：顶部工具条 + 红色搜索主导航 + 左侧分类导航 + 轮播 banner + 推荐楼层。
首页有 48 件商品，支持**关键词搜索**（名称/品牌/卖点）和**左侧分类筛选**，卡片上带价格、卖点、
已售量、评价数和营销标签（自营 / 秒杀 / 热卖 / 新品）。

点任意商品卡片进 `frontend/detail.html?id=N`：大图 + 价格区 + 销量/评价/好评率/库存四格 + 数量加减 +
加入购物车 / 立即购买 + 规格参数表 + 同类推荐（同分类、排除自己，最多 6 件）。价格与库存全部实时取自
item-service，页面不做任何本地金额计算。

### 商品图与轮播图

商品图是**真实产品摄影**（白底、专业打光、统一 3/4 视角），不是矢量占位图：
48 件商品各一张 `frontend/images/p{id}.jpg`（800×800），首页轮播三张
`frontend/images/banner{1,2,3}.jpg`（真实场景照，左侧留白给文案）。
每张图同时输出一份同名 `.webp`，前端优先用 webp，jpg 只作兜底。

```bash
python scripts/gen-images.py     # 从源图裁切/缩放，生成上面 51 张（每张 jpg + webp）
```

脚本干四件事，改图只需要改 `SRC` 映射表：

1. **去水印**：生成图右下角带 AI 水印，垂直裁掉底部 11.2%、再水平居中裁掉等宽两侧，
   得到正方形且背景渐变连续（直接补画布会留下明显横条）
2. **统一尺寸**：商品图 800×800、轮播宽 1400，JPEG q88 progressive
3. **双格式输出**：同一张图另存 WebP(q82)，商品图 2.9 MB → 1.3 MB、轮播 0.3 MB → 0.1 MB
4. **按商品 id 命名**：`p{id}.jpg`，数据库 `item.image` 直接存这个路径（库里的 `.jpg` 路径不变）

**前端的三级降级**（`session.js` 里统一实现，`app.js` / `detail.js` 都调它）：

| 场景 | 写法 |
| --- | --- |
| 商品图 `<img>` | `Hmall.picAttr(id)` → `src=xxx.webp`，`onerror` 里换 `.jpg`，再失败换占位 SVG |
| 轮播背景 | CSS `background-image: url(x.jpg)` 先兜底，紧跟 `image-set(url(x.webp) type("image/webp"), ...)` |

两条声明顺序不能反：不认识 `image-set()` 的老内核会整条丢弃，只剩前面的 jpg。

> 改 `pic()` 后如果页面还是拉旧图，注意 headless 验证脚本要开
> `Network.setCacheDisabled`，图片同名覆盖时缓存很容易让人误判。

> 48 件商品一共 41 种不同图片：笔记本 6 台各一张、空调有壁挂和柜机两种、手表有圆表/方表/运动表三种。
> 仍会重复的只有手机（9 台只有 6 种机型图，必然有 3 组各 2 件同图）、
> TWS/头戴耳机/机械键盘/手环（各 2 件同图）。这是刻意的取舍：
> 同类推荐一屏 6 件，只要不出现「两张一模一样」就不会出戏，没必要为每件商品单独生成。
> 想给某件商品换图，把 `SRC` 里对应 id 指向新源图再跑一次即可。
>
> 老库升级不用手工迁移：`data.sql` 末尾有一条
> `UPDATE item SET image = REPLACE(image, '.svg', '.jpg') WHERE image LIKE '%.svg';`，
> 把早期版本的程序化 SVG 路径自动换掉，可重复执行。

登录页有三种方式：**密码登录**（用户名或邮箱）、**邮箱验证码登录**、**免费注册**（邮箱验证码，送 500 元）。
演示账号 `zhangsan / 123456`（余额 5000）、`lisi`、`wangwu`，登录页上点一下自动填入。
演示账号也绑了邮箱（`zhangsan@hmall.com` 等），可以用来试邮箱验证码登录。

> `frontend/session.js` 统一管理登录态：把 token 和 userId 存 localStorage，之后每个请求自动带上
> `X-User-Id`（业务服务认身份）和 `X-Token`（用户服务验会话）。令牌失效会收到 401，前端自动清会话并跳回登录页。
>
> 后端端口被占用而做了整体平移时，前端也能跟着切：`http://localhost:8090/login.html?base=18080`
> 会把接口基址切成 `18080`，之后 5 个服务自动指向 `18081~18085`，设置记在 localStorage 里，不用逐页带参数。

### 数据会保留吗

会。模式 A 用的是 **H2 文件库**，不再是 `jdbc:h2:mem` 内存库：

| 内容 | 落盘位置 |
|---|---|
| 商品、库存 | `data/hm_item.mv.db` |
| 购物车 | `data/hm_cart.mv.db` |
| 订单、订单明细、状态 | `data/hm_order.mv.db` |
| 支付单 | `data/hm_pay.mv.db` |
| 用户、余额、充值流水、登录令牌 | `data/hm_user.mv.db` |

关掉服务再启动，订单、余额、库存、**登录状态**都原样保留：令牌也落在同一份 H2 文件库的
`user_token` 表里（`token / user_id / expires_at / create_time`），仍是 24 小时有效期，
签发时顺手清理过期行，`logout` 直接删行。重启后前端 localStorage 里的会话不会被 401 踢回登录页。每次启动都会重跑建表与种子脚本，
但 `schema.sql` 全是 `CREATE TABLE IF NOT EXISTS`，`data.sql` 改成「该 id 不存在才插入」，
所以既不会撞主键，也不会把你改过的余额/库存覆盖回初始值。

想恢复成干净的初始数据（课程演示、重跑测试）：

```bash
bash scripts/stop-local.sh              # 先停服务，H2 文件被占用时删不干净
bash scripts/reset-data.sh              # 预览会删哪些文件
bash scripts/reset-data.sh -y           # 确认删除 data/，下次启动自动重建
```

高级用法：`HMALL_DATA_DIR=D:/temp/hmall-test bash scripts/start-local.sh` 可把数据放到别处；
用 `BASE_PORT=18080` 平移端口时，数据自动改放 `data-18080/`，避免两套实例抢同一个 H2 文件
（H2 不允许两个进程同时打开同一个库）。所有这些目录都已加进 `.gitignore`。

**在 IDEA 里直接点运行**：不用加任何参数，`./data` 是 H2 认可的合法路径，目录 H2 会自己建。
但 IDEA 多模块项目的工作目录可能是各模块目录，5 个库会分散在各自模块下的 `data/` 里
（不影响持久化，只是位置不集中）。想统一放在项目根，给 5 个 Run Configuration 的
Program arguments 都加上 `--hmall.data.dir=D:/CUBE/hmall/data` 即可。
注意改完配置要**重启服务**才会生效——正在跑的进程用的还是旧的内存库。

### 订单超时自动取消

`order-service` 有个定时任务（`OrderTimeoutTask`），默认每 60 秒扫一次，把「待支付且创建超过 30 分钟」
的订单逐笔走 `cancelOrder` 取消并回补库存。订单落盘之后服务重启不丢单，这个任务能接着扫历史待支付单，
不会出现「库存被一张没人付的单永远占着」。

| 配置 | 默认值 | 说明 |
|---|---|---|
| `hmall.order.timeout-enabled` | `true` | 关掉后完全不扫描 |
| `hmall.order.timeout-minutes` | `30` | 超时阈值，设 `0` 便于验证 |
| `hmall.order.cancel-scan-ms` | `60000` | 扫描间隔（毫秒） |

一次最多扫 100 笔；单笔失败只记 warn 日志、下一轮重试；与用户手动支付的并发由
`cancelOrder` 里的 `where status=1` 条件更新兜底，不会重复回补库存。

想立刻看到效果（启动脚本支持透传 Spring 参数，其它服务会忽略不认识的属性）：

```bash
EXTRA_ARGS="--hmall.order.timeout-minutes=0 --hmall.order.cancel-scan-ms=3000" \
  BASE_PORT=18080 bash scripts/start-local.sh
```

启动几秒后，库里所有待支付订单都会变成「已取消」，商品库存同步回升。

### 支付对账补偿

跨库事务没有银弹：`pay()` 扣完余额后回调订单服务改状态，这一步失败只能记 error 日志，
否则就要引入 Seata/TCC。`PayReconcileTask` 负责把这个「最终一致」补上：定时回看最近 2 小时
支付成功的单，逐笔查订单状态——

| 订单状态 | 处理 |
|---|---|
| 已是「已支付」 | 跳过（幂等，什么都不做） |
| 仍是「待支付」 | 重放 `PUT /orders/{id}/status?status=2`，补置为已支付 |
| 已是「已取消」 | **不自动改状态**，打 error 日志要求人工处理/退款 —— 钱扣了却把订单硬改成已支付会掩盖资金差错 |
| 查不到 / 调用失败 | 记 warn，下一轮重试 |

配置：`hmall.pay.reconcile-enabled`(true) / `reconcile-lookback-minutes`(120) / `reconcile-scan-ms`(60000)。

验证「回调丢失」不用真的断网：正常支付一笔后手动
`PUT /orders/{id}/status?status=1` 把订单改回待支付，再用
`EXTRA_ARGS="--hmall.pay.reconcile-scan-ms=3000"` 重启，几秒后订单会自动回到「已支付」。

## 四、邮箱验证码注册与登录（QQ SMTP）

`user-service` 接入了 `spring-boot-starter-mail`，注册和邮箱登录都走 6 位验证码。

**没配授权码也能用**：此时是「降级模式」，验证码只打到 `logs/user.log`，接口返回、限流、一码一用
全部照常。这样本地开发、演示、自动化测试都不依赖邮箱，同时启动时会打一段醒目告警，
避免上线忘配还静默降级。

### 配一次就能真发邮件（QQ 邮箱）

1. 登录 QQ 邮箱 → 设置 → 账号 → 「POP3/IMAP/SMTP 服务」→ 开启 **IMAP/SMTP 服务**；
2. 按提示发短信验证，拿到一串 **16 位授权码**（不是 QQ 密码，只显示一次，丢了重新生成）；
3. 编辑 `user-service/src/main/resources/application-local.yml`：

   ```yaml
   MAIL_USERNAME: "你的QQ邮箱@qq.com"      # 发件邮箱，必须是完整地址
   MAIL_PASSWORD: "16位授权码"             # 不是 QQ 登录密码
   ```

   这个文件已被 `.gitignore` 排除，**不进仓库**。`application.yml` 里有一行
   `spring.config.import: optional:classpath:application-local.yml` 负责把它读进来，
   文件不存在也能正常启动，所以删掉它就等于回到降级模式。

   SMTP 主机和端口已经写死在 `application.yml`（`smtp.qq.com:465` + SSL），不需要再改。

4. 重启 user-service，启动日志里看到这行就说明配好了：

   ```
   QQ SMTP 已就绪，发件账号 你的QQ邮箱@qq.com
   ```

配好后发码会提示「验证码已发送至 378***@qq.com」，日志里**不再出现 `code=`**（验证码不进日志）。

> **配好之后跑自动化测试必须加 `MAIL_DEGRADED=1`**
>
> 冒烟测试第 25 段和 E2E 是靠 `grep 'code=' logs/user.log` 取验证码的，真发信后验证码不再落日志，
> 这两套会直接挂。测试要跑在降级模式：
>
> ```bash
> MAIL_DEGRADED=1 bash scripts/start-local.sh      # 会给 user-service 传空用户名强制降级
> bash scripts/smoke-test.sh
> E2E_BASE=8080 node .workbuddy/e2e/e2e.js
> ```
>
> 只想手工发一封真邮件验证配置的话，就别加这个开关。

**两个常见配错**，启动时都会打出针对性告警，不会静默失败：

| 现象 | 原因 |
| --- | --- |
| 打出「SMTP 未配置…（降级模式）」 | 用户名和授权码至少缺一个 |
| 打出「MAIL_USERNAME 已配置，但 MAIL_PASSWORD 为空」 | 只填了邮箱没填授权码——这种半配账号如果放过去，每次发信都会 500 |

### 三条硬规则

| 规则 | 实现 |
|---|---|
| 5 分钟有效 | `email_code.expired_at` |
| 同一邮箱同一场景 60 秒只能发一次 | 查最近一条 `create_time`，不足 60 秒直接 `429`，并告诉用户还剩几秒 |
| 一码一用 | 校验时 `update ... where used = 0` 条件更新，并发下只有一个人能成功 |

额外的几个细节，都是踩过坑才补的：

- **先查唯一性，再消费验证码**。反过来的话，用户因为「用户名已被占用」失败一次，码就被浪费了，
  还得再等 60 秒。注册接口的顺序是：用户名重复 → 邮箱重复 → 校验并标记验证码。
- 校验失败的提示统一在「错误 / 已使用 / 已过期」之间，**不泄露这个邮箱到底有没有发过码**。
- 邮箱在接口返回和日志里都脱敏成 `zha***@qq.com`。
- `users.email` 建了唯一索引；H2 视多个 `NULL` 为互不相同，所以历史账号（没邮箱）不会互相冲突。

### 注册送 500 元

新账号直接给 500 元余额，注册完能立刻下单跑通整条链路，不用先去充值。

## 五、限时秒杀与高并发处理

首页「⚡限时秒杀」楼层展示进行中的活动（秒杀价、划线原价、库存进度条、距本场结束倒计时），
点「马上抢」直接抢单，抢到后弹支付，秒杀单和普通单走同一套支付/超时取消状态机。

### 高并发正确性怎么保证（不依赖 Redis / 分布式锁）

| 问题 | 机制 | 位置 |
|---|---|---|
| 超卖 | 单条 `UPDATE seckill_activity SET stock=stock-1 WHERE id=? AND stock>0 AND status=1`，数据库行锁串行化，`rows=0` 即售罄 | `SeckillActivityMapper.deductSeckillStock` |
| 重复抢购 | `seckill_order` 表 `(activity_id, user_id)` **唯一索引**，并发重复请求命中约束抛 `DuplicateKeyException` | `schema.sql` / `SeckillStockService.reserve` |
| 请求限速 | 抢不到直接返回 `success=false`，不排队不建单，订单服务不会被秒杀流量打爆 | `SeckillServiceImpl.seckill` |

抢购顺序刻意设计为**先插唯一记录、再扣库存**（反过来同一用户并发重复请求会把库存扣了又回滚，一个都抢不到），
并且「插记录 + 扣库存」放在一个**独立的短事务**里（`SeckillStockService`）——回调 order-service 建单是远程
调用，必须放在事务之外，否则 H2 行锁被长时间占用，并发下直接锁超时。建单失败走**补偿**：回补秒杀库存 + 删
唯一记录，用户可重试。

踩过的两个坑：
- **同类内部调用事务失效**：`seckill()` 里直接 `this.reserve()` 不经过 Spring AOP 代理，
  `@Transactional` 静默失效，所以把事务方法拆到独立的 `SeckillStockService`；
- **H2 行锁超时**：H2 默认 2 秒 `LOCK_TIMEOUT`，120 并发扣同一行直接抛 `Concurrent update`，
  item 库的 JDBC URL 加了 `;LOCK_TIMEOUT=10000` 让事务排队等待而不是报错。

### 秒杀单与普通单的区别

秒杀单 `order_type=2`：**不扣商品日常库存**（秒杀库存独立预扣在 item-service）、取消/超时取消时**也不回补**
商品库存——否则会把没扣过的库存多加一遍。金额按秒杀价结算（`POST /orders/seckill`），明细单价即秒杀价。

### 并发压测

`scripts/seckill-stress.js` 用 Node 自带 fetch 模拟并发（无需任何依赖），三个场景全部通过：

```bash
BASE_PORT=18080 bash scripts/start-local.sh
node scripts/seckill-stress.js 18081 18083 101 120
# 场景 A：120 个用户并发抢库存 50 的活动 → 恰好 50 成功、70 个「已被抢光」、库存归零（不超卖）
# 场景 B：同一用户 20 并发抢同一场 → 恰好 1 成功、19 个「已抢过」（防重复）
# 场景 C：抢到后查订单 → 金额=秒杀价 999（不是原价 2499）、order_type=2
```

实测 120 并发全链路（扣库存 + 建单）约 0.9~1.1 秒完成，重复运行结果稳定。

## 六、接口清单

| 服务 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 商品 | GET | `/items/search?category=&keyword=&limit=60` | 首页/搜索用：分类过滤 + 关键词模糊匹配（名称/品牌/卖点），按销量倒序 |
| 商品 | GET | `/items/categories` | 全部一级分类（按商品数倒序），左侧导航用 |
| 商品 | GET | `/items?ids=1,2` | 批量查询，购物车与订单都靠它拿价格库存 |
| 商品 | GET | `/items/{id}` | 单个商品 |
| 商品 | PUT | `/items/stock/deduct` | body: `[{"itemId":1,"num":1}]`，条件更新，库存不足抛错并回滚 |
| 商品 | PUT | `/items/stock/restore` | body: `[{"itemId":1,"num":1}]`，取消订单时回补库存 |
| 商品 | POST | `/items` | 新增商品（初始化用） |
| 商品 | GET | `/seckill/list` | 进行中的秒杀活动列表（带商品展示字段 + 剩余库存），首页秒杀楼层用 |
| 商品 | GET | `/seckill/{id}` | 秒杀活动详情，带 `grabbed` 标记（当前用户是否已抢到） |
| 商品 | POST | `/seckill/{id}/grab` | 抢购。防超卖 + 防重复 + 回调订单服务建单，成功返回 `{success,orderId,price}`，没抢到返回 `{success:false,failReason}` |
| 购物车 | GET | `/carts` | 我的购物车，**商品名/价格/库存由 item-service 远程补齐** |
| 购物车 | POST | `/carts` | body: `{"itemId":1,"num":2}`，已存在则累加 |
| 购物车 | PUT | `/carts` | body: `{"id":1,"num":3}` |
| 购物车 | DELETE | `/carts?ids=1,2` | 按购物车 id 删除 |
| 购物车 | DELETE | `/carts/items?itemIds=1,2` | 按下单商品删除（订单服务调用） |
| 订单 | POST | `/orders/seckill` | 秒杀下单（item-service 抢购成功后回调），按秒杀价结算；`order_type=2` 不参与商品库存扣减/回补 |
| 订单 | POST | `/orders` | body: `{"address":"...","items":[{"itemId":1,"num":1},{"itemId":2,"num":2}]}`，金额/明细/扣库存都按 `num` 算；**旧版 `itemIds` 仍兼容**（每件按 1） |
| 订单 | GET | `/orders?limit=20` | 我的订单列表（按 id 倒序，明细一次批量查出，避免 N+1） |
| 订单 | GET | `/orders/{id}` | 订单详情 |
| 订单 | PUT | `/orders/{id}/status?status=2` | 改状态，已支付重复通知直接返回（幂等） |
| 订单 | PUT | `/orders/{id}/cancel` | 取消订单：仅「待支付」可取消，条件更新防重复取消，成功后远程回补库存 |
| 支付 | POST | `/pay-orders` | body: `{"orderId":1}`，金额从订单服务取，不信前端；**同一订单重复调用会复用那张未支付的支付单** |
| 支付 | PUT | `/pay-orders?payOrderNo=...&pw=123456` | 校验密码 + 扣余额 + 改支付单 + 回调订单 |
| 支付 | GET | `/pay-orders/{payOrderNo}` | 查询支付单 |
| 用户 | GET | `/users/{id}` | 用户与余额 |
| 用户 | POST | `/users/login` | body: `{"username":"zhangsan","password":"123456"}`，`username` 可以填**用户名或邮箱**；返回 token + 用户信息；令牌落 `user_token` 表，重启不失效 |
| 用户 | POST | `/users/email/code` | body: `{"email":"...","purpose":"REGISTER\|LOGIN"}`，发 6 位验证码；未配 SMTP 时返回 `degraded=true` 且只写日志 |
| 用户 | POST | `/users/register` | body: `{"username":"...","password":"...","email":"...","code":"123456"}`，校验验证码后建号，返回登录态；新用户送 500 元 |
| 用户 | POST | `/users/email/login` | body: `{"email":"...","code":"123456"}`，邮箱验证码登录 |
| 用户 | GET | `/users/me` | 请求头 `X-Token`，换当前登录用户（前端刷新余额用它） |
| 用户 | POST | `/users/logout` | 请求头 `X-Token`，注销令牌 |
| 用户 | POST | `/users/recharge` | body: `{"amount":500,"channel":"alipay"}`，加余额并写流水 |
| 用户 | GET | `/users/recharges?limit=10` | 我的充值记录 |
| 用户 | GET | `/users/{id}/check-password?pw=**` | 校验支付密码（MD5） |
| 用户 | PUT | `/users/{id}/balance/deduct?amount=**` | 余额充足才扣，并发安全 |

登录相关接口的错误统一由 `GlobalExceptionHandler` 处理，返回体带 `message` 字段，前端可直接弹提示
（例如密码错误 `401 用户名或密码错误`、充值超限 `400 单笔充值不能超过 50000 元`）。
**5 个业务服务现在都有这个统一出口**，cart-service 是最后补齐的一个；前端 `Hmall.api` 只读 `message`，
少了它页面就只能显示「HTTP 500」，所有提示分支都白写。

用户身份用请求头 `X-User-Id` 模拟（缺省 1），对应课程里网关解析 token 后透传 userId 的做法。
种子用户 1/2/3 支付密码均为 `123456`，初始余额 5000 / 3000 / 1000。

## 七、一条链路的验证结果（实测）

`scripts/smoke-test.sh` 在模式 A 下已跑通，关键环节：

1. `GET /items?ids=1,2` 返回两个商品；
2. 加购后 `GET /carts` 返回的 `name / price / newPrice / stock / status` 全部有值 —— 证明跨服务调用成功；
3. `POST /orders` 传 `items:[{itemId:1,num:1},{itemId:2,num:2}]`，返回 `totalFee=5197.00`（3999 + 599×2）、
   明细 `num=1/2`，商品 1 库存减 1、商品 2 减 2，购物车清空 —— **购物车数量不再被丢成 1 件**；
4. `POST /pay-orders` 生成支付单（金额 5197 从订单服务取，不信前端），`PUT` 输入密码后：
   支付单 `status=1`、订单 `status=2`、余额相应扣减；
5. 重复提交同一支付单，余额保持不变，不再扣款 —— 幂等生效；
6. 余额不足时 `PUT` 返回 `400 {"message":"余额不足"}`，余额不变 —— 条件扣款生效；
7. `POST /users/login` 拿到 token，`GET /users/me` 带 `X-Token` 能换回 `zhangsan`；
8. 错误密码返回 401；退出登录后同一 token 再访问 `/users/me` 也是 401 —— 会话确实失效；
9. 充值 200 元后余额 `BAL → BAL+200` 精确对账；充 0 元、充 99999 元均返回 400 被拦截；
10. `GET /users/recharges` 能查到刚写入的流水；
11. `GET /orders?limit=20` 返回该用户的订单，且 `details` 里带商品名、单价、数量 —— 明细是批量查出来的，不是逐单查；
12. 同一订单重复 `POST /pay-orders` 返回**同一个支付单号**（否则用户关掉弹窗再点「去支付」会生成第二张单，各扣一次款）；
13. 已支付订单再创建支付单被拒绝（非 200）；错误支付密码返回 `400 {"message":"支付密码错误"}` 而不是裸 500，前端能直接弹中文提示。
14. 待支付订单 `PUT /orders/{id}/cancel` 后订单 `status=3`，商品库存精确回到下单前的值 —— 回补是真的加回去了；
15. 同一订单重复取消返回 4xx，库存**不会**被加第二次 —— 取消接口靠 `where status=1` 的条件更新保证幂等；
16. 已取消订单不能再创建支付单；用户 2 取消用户 1 的订单返回 403 —— 状态闸与越权校验都生效。
17. **重启持久化**：跑完一整条链路后停掉 5 个服务再原样启动，订单数、用户余额、商品库存、充值流水
   与重启前逐项一致（实测 `orders=3 balance=602.0 stock1=99 recharges=1` 前后完全相同）；
   并且在同一份持久化库上连续跑两遍冒烟都能通过（脚本开头会自动补齐测试账号余额）。
18. **登录态也跟着持久化**：登录拿到的 `X-Token` 在停服重启后再次请求 `/users/me` 仍返回 `zhangsan`
   （令牌已落 `user_token` 表，不再是内存 Map）；`logout` 之后该 token 立刻 401。
19. `POST /carts` 传 `num=0` 返回 `400 {"message":"商品 id 与数量不能为空，且数量必须大于 0"}`
   而不是裸 500 —— cart-service 补上了统一异常出口，5 个业务服务的错误前端都能直接弹提示。
20. **数量与兼容性**：`POST /orders` 传 `items:[{"itemId":1,"num":1},{"itemId":2,"num":2}]` 返回
   `totalFee=5197.00`、明细 `num=1/2`、商品 1 库存减 1 / 商品 2 减 2；`num=0` 返回 400；
   旧版 `{"itemIds":[3]}` 仍返回金额 329、明细数量 1 —— 老客户端不受影响。
21. **超时自动取消**：先造 2 笔待支付订单（商品 5 各 2 件、商品 6 各 3 件），库存降到 146/294；
   用 `--hmall.order.timeout-minutes=0 --hmall.order.cancel-scan-ms=3000` 重启后，
   日志显示「发现 2 笔超过 0 分钟未支付的订单」并逐笔取消，待支付订单归零，库存精确回到 150/300。
22. **支付对账补偿**：正常支付一笔后手动把订单改回 `status=1` 模拟回调丢失，
   用 `--hmall.pay.reconcile-scan-ms=3000` 重启后，日志打出「对账补偿：… 已补置为已支付」，
   订单自动回到 `status=2`；订单若是「已取消」则不会自动改状态，只打 error 日志要求人工处理。
23. **再来一单**：已取消订单卡片点「再来一单」，明细按原数量重新加回购物车，角标与成功提示都正确；
   `db/all.sql` 的种子插入改成 `INSERT IGNORE`，重复执行不会撞主键、也不会覆盖改过的余额。
24. **商品扩充与检索**：`/items/search` 返回 48 件商品，覆盖 6 个一级分类；
   `?keyword=华为` 命中 5 件、`?category=家用电器` 命中 8 件。
25. **邮箱验证码全链路**：发码返回 `degraded=true`（未配 SMTP 时只写日志），60 秒内重发 `429`；
   错误码注册 `400`、正确码注册返回 token 且 `balance=500`；同一个 LOGIN 码第二次登录
   返回「验证码已使用」；未注册邮箱登录 `404`。
26. **限时秒杀**：`GET /seckill/list` 至少 3 场活动；抢购成功返回订单号且价格=秒杀价；
   秒杀库存恰好减 1；同一用户重复抢购被「每人限购一件」拦下。

共 **26 段**断言，全部通过时脚本退出码为 0。另有 `scripts/seckill-stress.js` 并发压测
（详见「五、限时秒杀」），8/8 通过。前端另有 Chrome CDP 浏览器 E2E
（`.workbuddy/e2e/e2e.js`），覆盖登录守卫、密码登录、首页 48 件商品、分类导航、关键词搜索、
分类筛选、加购下单、支付弹窗、取消订单、库存回补、再来一单、充值、退出、
**邮箱验证码注册、邮箱验证码登录**、**商品详情页（卡片跳转 / 同类推荐 / 数量加减 / 加购 / 立即购买 /
购物车回跳 / 未登录守卫）**、**秒杀楼层（活动渲染 / 倒计时 / 抢购交互）**，共 **82 条**断言全部通过。

```bash
# 建议先按 18080 基线起一套，E2E 默认打 18081~18085
BASE_PORT=18080 bash scripts/start-local.sh
cd frontend && python -m http.server 8090 &          # 静态页
chrome --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/e2e-profile about:blank &
node .workbuddy/e2e/e2e.js                            # 82 条断言，通过时退出码 0
node scripts/seckill-stress.js 18081 18083 101 120    # 秒杀并发压测，8 条断言
```


## 八、代码与课程知识点的对应

| 课程知识点 | 工程里的位置 |
|---|---|
| 服务拆分、独立数据库 | 5 个模块各自 `schema.sql` / 独立 database |
| RestTemplate 远程调用（exchange + ParameterizedTypeReference） | `cart-service` 的 `CartServiceImpl#handleCartItems` |
| RestTemplate Bean 配置 | 各服务 `config/RemoteCallConfig` |
| 服务注册（nacos-discovery，不引 loadbalancer 会缺实例选择） | 各服务 `pom.xml` + `application-nacos.yml` |
| 服务发现 + 负载均衡（@LoadBalanced） | 各服务 `config/NacosRemoteCallConfig`（nacos profile 生效） |
| 服务名替代 ip:port | `application-nacos.yml` 里 `hmall.remote.item-url: http://item-service` |
| 下单三步：建单、扣库存、清购物车 | `order-service` 的 `OrderServiceImpl#createOrder` |
| 支付四步：校验密码、扣余额、改支付单、改订单状态 | `pay-service` 的 `PayServiceImpl#pay` |
| 防超卖 / 幂等 | `ItemMapper#deductStock`、`UserMapper#deductBalance`、支付单状态机 |
| 本地事务 + 定时补偿（最终一致） | `OrderTimeoutTask`（超时取消回补库存）、`PayReconcileTask`（重放支付回调） |
| 条件更新防并发重复操作 | `cancelOrder` 的 `where status=1`、库存 `where stock >= num`、余额 `where balance >= amount` |

## 九、几个刻意的设计取舍

1. **金额只在服务端算**：下单时用商品服务的价格重新汇总，支付金额从订单服务查，前端传来的金额一概不用。
2. **扣库存/扣余额都用条件更新**（`where stock >= n`、`where balance >= amount`），一条 SQL 同时解决超卖与并发扣负。
3. **跨服务失败有兜底，并且有补偿**：清购物车失败只记日志不回滚订单；支付成功但回调订单失败会打
   error 日志，再由 `PayReconcileTask` 定时重放回调补到最终一致（订单已取消则告警人工处理，不自动改状态）。
4. **事务边界说清楚**：每个服务只保证自己库内的本地事务（建单+明细在同一个事务）。跨库的「订单已建、库存已扣」严格说需要 Seata/TCC 或本地消息表，课程阶段先按本地事务 + 补偿处理，这点在代码注释里标注了。
5. **表名避坑**：`order`、`user` 是 SQL 保留字，工程里用 `orders`、`users`，MySQL 与 H2 都能直接建。

## 十、常见问题

**编译报 `java.lang.ExceptionInInitializerError: com.sun.tools.javac.code.TypeTag :: UNKNOWN`**
这是 Lombok 与 JDK 版本不匹配的典型报错：Spring Boot 2.7 默认带的 Lombok 1.18.30 在 JDK 22 及以上会直接崩在 javac 里。工程已做两处修复，拉下来即可用：
1. 根 `pom.xml` 中用 `<lombok.version>1.18.48</lombok.version>` 覆盖父 POM 的 1.18.30；
2. 配置 `maven-compiler-plugin` 的 `<proc>full</proc>` 与 `annotationProcessorPaths` —— JDK 23 起 javac 默认不再执行 classpath 上的注解处理器，不显式声明会出现「Lombok 不生成 getter」的一堆 `cannot find symbol`。

改完后执行 `mvn clean`，IDEA 里点 Maven 面板的 **Reload All Maven Projects**，再 Build → Rebuild Project。若 IDEA 仍报错，检查 `Settings → Build, Execution, Deployment → Compiler → Annotation Processors`，确认 **Enable annotation processing** 已勾选。

**JDK 版本怎么选**

| JDK | 编译 | 运行 | 说明 |
|---|---|---|---|
| 11 | 通过 | 通过 | 课程标准版本，推荐 |
| 17 | 通过 | 通过 | Spring Boot 2.7 官方支持上限 |
| 21 / 25 | 通过 | 通过（JDK 25 实测） | 依赖上面的 Lombok 1.18.48 + proc 配置 |

**端口被占用**：默认 8081~8085。改端口时记得同步改调用方地址，模式 A 用启动参数传，例如
`java -jar cart-service/target/cart-service.jar --server.port=9082 --hmall.remote.item-url=http://localhost:9081`；
或用 `BASE_PORT=18080 bash scripts/start-local.sh` 整体平移端口（商品 18081、购物车 18082、订单 18083、支付 18084、用户 18085，数据自动隔离到 `data-18080/`）。
前端跟着切：访问 `http://localhost:8090/login.html?base=18080`。

**重启后数据还在吗**：模式 A 已经改用 H2 文件库，数据在 `data/`，重启不丢，详见「数据会保留吗」。
如果希望每次启动都是全新数据，跑 `bash scripts/reset-data.sh -y`，或启动时加 `--hmall.data.dir=./fresh`。

**启动报 `A file path that is implicitly relative to the current working directory is not allowed`**
H2 2.1.x 要求数据库路径以 `./`、`~/` 开头，或是绝对路径。自定义 `--hmall.data.dir` 时别写
`data/my-db` 这种相对路径，写 `./data/my-db` 或 `D:/CUBE/hmall/data`；项目默认值 `./data` 本身就是合规的。

**启动时报数据库被占用（Database may be already in use）**
同一个 H2 文件不允许两个 JVM 同时打开。多半是旧进程没退干净，或 IDEA 里那套和命令行那套用了同一个 `data/`。
先停掉重复的实例，或给其中一套指定独立目录：`BASE_PORT=18080 bash scripts/start-local.sh` 会自动切到 `data-18080/`。

**模式 B 服务起不来**：先 `docker compose ps` 看 mysql 是否 healthy；`fail-fast: false` 已开，Nacos 晚起来不影响服务启动，但服务名叫不通时调用会失败，等 Nacos 就绪即可。

**Nacos 控制台打不开**：8848 是控制台，9848/9849 是 gRPC，客户端注册必需，三个端口都要映射；课程环境 IP 是 `192.168.101.200`，本地跑用 `localhost`，可用环境变量覆盖：`NACOS_ADDR=localhost:8848 bash scripts/start-nacos.sh`。

**前端页面打不开 / 登录页请求报 CORS**：本工程自带 `frontend/` 纯静态页，双击 `frontend/open-shop.bat`
即可打开登录页。若浏览器拦截 `file://` 的跨域请求，就按「打开前端页面」一节起一个静态服务，
用 `http://localhost:8090/login.html` 访问。接口也可用 Swagger 或 `requests.http` 单独验证。
