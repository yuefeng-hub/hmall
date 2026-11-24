#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成 hmall 的商品种子数据。

为什么用脚本生成而不是手写：
  48 个商品的 data.sql 有 100+ 条语句，还要同时维护 H2 幂等版和 MySQL 版，
  手写必然出现「第 37 个忘了加 WHERE NOT EXISTS」这种致命错误。
  改商品只需要改这个文件里的 ITEMS 表，再跑一次：
      python scripts/gen-seed.py

产出：
  1. item-service/src/main/resources/data.sql    —— H2 幂等种子（重启不覆盖用户数据）
  2. .workbuddy/mysql-items.sql                  —— 贴进 db/all.sql 的 MySQL 片段

商品图不在这里生成：真实产品摄影的裁切统一走
      python scripts/gen-images.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (id, 名称, 卖点, 价格, 库存, 品牌, 分类, 销量, 评价数, 好评率, 标签)
ITEMS = [
    # ---------- 手机通讯 ----------
    (1, "小米 14 Pro 16GB+512GB 钛金属", "2K 全等深微曲屏 · 徕卡光学镜头 · 骁龙 8 Gen3",
     3999.00, 100, "小米", "手机通讯", 186300, 52100, 98, "自营"),
    (11, "Apple iPhone 15 Pro 256GB 原色钛金属", "A17 Pro 芯片 · 钛金属边框 · 支持 USB-C",
     7999.00, 60, "Apple", "手机通讯", 98234, 31200, 99, "自营"),
    (12, "华为 Mate 60 Pro 12GB+512GB 雅川青", "卫星通话 · 玄武钢化昆仑玻璃 · 超长续航",
     6999.00, 45, "华为", "手机通讯", 76520, 24100, 98, "自营"),
    (13, "Redmi K70 16GB+512GB 墨羽", "第二代骁龙 8 · 2K 中国屏 · 120W 秒充",
     2499.00, 120, "小米", "手机通讯", 156800, 45200, 97, "秒杀"),
    (14, "OPPO Find X7 16GB+256GB 大漠银月", "天玑 9300 · 哈苏人像四摄 · 100W 闪充",
     4999.00, 40, "OPPO", "手机通讯", 43210, 12800, 98, "自营"),
    (15, "vivo X100 16GB+512GB 落日橙", "蔡司超级长焦 · 天玑 9300 · 蓝海电池",
     4299.00, 55, "vivo", "手机通讯", 52130, 15600, 98, "热卖"),
    (16, "荣耀 Magic6 16GB+512GB 绒黑色", "鹰眼相机 · 青海湖电池 · 巨犀玻璃",
     4399.00, 38, "荣耀", "手机通讯", 38760, 11200, 97, ""),
    (17, "一加 12 16GB+512GB 岩板绿", "2K 东方屏 · 骁龙 8 Gen3 · 100W 超级闪充",
     4299.00, 42, "一加", "手机通讯", 29870, 8900, 97, "新品"),
    (18, "三星 Galaxy S24 8GB+256GB 钛灰", "骁龙 8 Gen3 · Galaxy AI · 120Hz 自适应屏",
     5999.00, 25, "三星", "手机通讯", 18760, 5400, 96, "自营"),

    # ---------- 电脑办公 ----------
    (3, "黑爵 AK820 机械键盘 三模热插拔", "Gasket 结构 · PBT 键帽 · 支持有线/2.4G/蓝牙",
     329.00, 80, "黑爵", "电脑办公", 67400, 21300, 97, "热卖"),
    (4, "AOC Q27G3S 27 英寸 2K 电竞显示器", "180Hz 高刷 · 1ms 响应 · HDR400",
     1499.00, 50, "AOC", "电脑办公", 34500, 12400, 98, "自营"),
    (5, "罗技 M590 多设备静音无线鼠标", "双模连接 · 静音按键 · 一键跨屏切换",
     249.00, 150, "罗技", "电脑办公", 89200, 26800, 98, ""),
    (7, "西部数据 Elements 2TB 移动硬盘", "USB3.0 高速传输 · 即插即用 · 三年质保",
     699.00, 60, "西部数据", "电脑办公", 43200, 15600, 97, "自营"),
    (19, "联想拯救者 Y9000P 2024 i9/RTX4060", "16 英寸 2.5K 240Hz · 满血 4060 · 霜刃散热",
     9499.00, 30, "联想", "电脑办公", 23400, 7600, 98, "自营"),
    (20, "华为 MateBook 14 酷睿 Ultra 5", "3:2 2.8K 触控全面屏 · 1.31kg 轻办公",
     5999.00, 35, "华为", "电脑办公", 19800, 6200, 98, "自营"),
    (21, "Apple MacBook Air 13 英寸 M3 8+256G", "M3 芯片 · 18 小时续航 · 1.24kg",
     8999.00, 20, "Apple", "电脑办公", 31200, 9800, 99, "自营"),
    (22, "戴尔 XPS 13 9340 酷睿 Ultra 7", "13.4 英寸 3K OLED 触控屏 · 全金属机身",
     8999.00, 18, "戴尔", "电脑办公", 8900, 2600, 97, ""),
    (23, "ThinkPad X1 Carbon AI 2024", "14 英寸 2.8K OLED · 商务旗舰 · 军标认证",
     10999.00, 12, "联想", "电脑办公", 6700, 2100, 98, "自营"),
    (24, "惠普战 66 六代 锐龙 R7", "16 英寸高色域屏 · 全金属机身 · 双内存插槽",
     4999.00, 50, "惠普", "电脑办公", 27600, 8400, 97, "热卖"),
    (47, "雷蛇黑寡妇 V4 机械键盘", "绿轴段落手感 · RGB 幻彩 · 铝合金面板",
     899.00, 45, "雷蛇", "电脑办公", 12300, 4200, 96, ""),

    # ---------- 家用电器 ----------
    (25, "美的 1.5 匹新一级变频空调挂机", "智能自清洁 · 静音省电 · 以旧换新",
     2799.00, 80, "美的", "家用电器", 45200, 13400, 98, "自营"),
    (26, "海尔 501L 十字对开门冰箱", "一级能效 · 干湿分储 · 母婴空间",
     4299.00, 35, "海尔", "家用电器", 12800, 4200, 97, "自营"),
    (27, "小天鹅 10 公斤滚筒洗衣机", "水魔方洗烘一体 · 除螨除菌 · 变频静音",
     2499.00, 60, "小天鹅", "家用电器", 23400, 7800, 98, "热卖"),
    (28, "戴森 V12 Detect Slim 无线吸尘器", "激光探测微尘 · 整机过滤 · 轻量手持",
     3799.00, 25, "戴森", "家用电器", 9800, 3400, 99, "自营"),
    (29, "小米电视 S Pro 65 英寸 Mini LED", "4K 144Hz · 澎湃 OS · 远场语音",
     2799.00, 70, "小米", "家用电器", 34500, 11200, 97, "秒杀"),
    (30, "九阳破壁豆浆机 DJ13B", "免滤免煮 · 一键清洗 · 12 小时预约",
     399.00, 200, "九阳", "家用电器", 56700, 18900, 96, ""),
    (31, "格力 1.5 匹云锦三代变频挂机", "新一级能效 · 双级增焓压缩机 · 56℃ 高温自清洁",
     2999.00, 55, "格力", "家用电器", 31200, 9800, 98, "自营"),
    (32, "老板 27A3S 侧吸抽油烟机", "大吸力静音 · 免拆洗 · 挥手智控",
     3299.00, 30, "老板", "家用电器", 8700, 2600, 97, ""),

    # ---------- 影音娱乐 ----------
    (2, "华为 FreeBuds Pro 3 真无线降噪耳机", "双单元三分频 · 智慧动态降噪 · 星闪连接",
     599.00, 200, "华为", "影音娱乐", 76500, 24300, 98, "自营"),
    (8, "索尼 WH-1000XM5 头戴式降噪耳机", "八麦克风降噪 · 30 小时续航 · Hi-Res 认证",
     2499.00, 30, "索尼", "影音娱乐", 42300, 14800, 99, "自营"),
    (33, "索尼 PS5 Slim 光驱版游戏主机", "1TB 高速 SSD · 支持 4K 120Hz · 光追",
     3899.00, 40, "索尼", "影音娱乐", 18900, 6700, 99, "自营"),
    (34, "JBL GO4 音乐金砖四代蓝牙音箱", "便携防水 · 16 小时续航 · 蓝牙 5.3",
     799.00, 120, "JBL", "影音娱乐", 42300, 14500, 97, ""),
    (35, "漫步者 R1700BT 蓝牙书架音箱", "木质箱体 · 三分频设计 · 遥控调节",
     599.00, 90, "漫步者", "影音娱乐", 23400, 7600, 98, "热卖"),
    (36, "森海塞尔 HD600 开放式头戴耳机", "发烧级 · 经典参考级音质 · 可换线设计",
     2299.00, 20, "森海塞尔", "影音娱乐", 5600, 1800, 99, "自营"),
    (37, "大疆 Osmo Pocket 3 口袋云台相机", "1 英寸底 · 2 英寸旋转屏 · 三轴增稳",
     3499.00, 35, "大疆", "影音娱乐", 15600, 5200, 99, "新品"),
    (39, "Apple AirPods Pro 2 USB-C", "主动降噪 · 自适应通透 · 6 小时聆听",
     1899.00, 80, "Apple", "影音娱乐", 67800, 23400, 99, "自营"),
    (48, "索尼 A7M4 全画幅微单相机", "3300 万像素 · 4K 60P · 五轴防抖",
     15999.00, 8, "索尼", "影音娱乐", 3200, 1100, 99, "自营"),

    # ---------- 智能穿戴 ----------
    (9, "华为 WATCH GT4 46mm 智能手表", "八通道心率 · 双频 GPS · 14 天长续航",
     1299.00, 45, "华为", "智能穿戴", 56700, 18900, 98, "自营"),
    (38, "Apple Watch S9 45mm GPS 版", "S9 芯片 · 双指互点 · 全天候视网膜屏",
     2999.00, 28, "Apple", "智能穿戴", 21400, 7300, 99, "自营"),
    (40, "华为手环 9 NFC 版", "1.47 英寸 AMOLED · 睡眠监测 · 14 天续航",
     299.00, 300, "华为", "智能穿戴", 89200, 26700, 97, "秒杀"),
    (41, "小米手环 8 Pro", "大屏高清 · 150+ 运动模式 · 双 PD 快充",
     399.00, 250, "小米", "智能穿戴", 76500, 21300, 96, ""),
    (42, "佳明 Forerunner 265 跑步腕表", "AMOLED 屏 · 多频 GPS · 训练指导",
     2999.00, 15, "佳明", "智能穿戴", 4300, 1500, 98, "自营"),

    # ---------- 数码配件 ----------
    (6, "绿联铝合金笔记本支架", "六档调节 · 散热镂空 · 承重 10kg",
     129.00, 300, "绿联", "数码配件", 98700, 31200, 97, "热卖"),
    (10, "小米移动电源 3 20000mAh 快充版", "双向 22.5W 快充 · 双 USB 输出 · 聚合物电芯",
     199.00, 500, "小米", "数码配件", 134000, 42300, 97, ""),
    (43, "倍思 65W 氮化镓充电器", "双 C 口 · 迷你便携 · 兼容手机笔记本",
     149.00, 400, "倍思", "数码配件", 123000, 34500, 96, "热卖"),
    (44, "绿联 Type-C 十合一扩展坞", "4K HDMI · 千兆网口 · PD100W 供电",
     199.00, 300, "绿联", "数码配件", 56700, 18200, 97, ""),
    (45, "闪迪 128GB TF 存储卡", "高速读写 · 行车记录仪专用 · 耐高温",
     89.00, 500, "闪迪", "数码配件", 98700, 28900, 96, ""),
    (46, "罗技 C920 Pro 高清摄像头", "1080P 全高清 · 双麦克风降噪 · 自动对焦",
     499.00, 150, "罗技", "数码配件", 23400, 7800, 97, ""),
]


def sql_str(value):
    """转成 SQL 字符串字面量；空字符串也保留，避免 NULL 与 '' 混用"""
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def image_path(item_id):
    # 商品图由 scripts/gen-images.py 从真实产品摄影裁切生成
    return "images/p%d.jpg" % item_id


def build_h2_sql():
    lines = [
        "-- ============================================================",
        "-- 商品种子数据（由 scripts/gen-seed.py 生成，别手工改这个文件）",
        "-- 规则：只在「该 id 不存在」时插入；已存在的行只补新增字段，",
        "--       绝不动 price / stock —— 用户买过、改过的数据不能被重启覆盖。",
        "-- ============================================================",
        "",
    ]
    cols = ("id, name, subtitle, price, stock, image, category, brand, "
            "sales, comment_count, good_rate, tag, status")
    for it in ITEMS:
        (iid, name, subtitle, price, stock, brand, category,
         sales, comments, good_rate, tag) = it
        lines.append(
            "INSERT INTO item (%s)\n"
            "SELECT %d, %s, %s, %.2f, %d, %s, %s, %s, %d, %d, %d, %s, 1\n"
            "WHERE NOT EXISTS (SELECT 1 FROM item WHERE id = %d);"
            % (cols, iid, sql_str(name), sql_str(subtitle), price, stock,
               sql_str(image_path(iid)), sql_str(category), sql_str(brand),
               sales, comments, good_rate, sql_str(tag), iid)
        )
        lines.append("")

    lines.append("-- 老库补齐：早期版本 item 表没有这些列，加列后原有 10 行全是 NULL。")
    lines.append("-- 用 brand IS NULL 做判据，保证只在「从没补过」时执行一次。")
    for it in ITEMS:
        (iid, name, subtitle, price, stock, brand, category,
         sales, comments, good_rate, tag) = it
        lines.append(
            "UPDATE item SET name=%s, subtitle=%s, image=%s, category=%s, brand=%s, "
            "sales=%d, comment_count=%d, good_rate=%d, tag=%s\n"
            "WHERE id=%d AND (brand IS NULL OR brand='');"
            % (sql_str(name), sql_str(subtitle), sql_str(image_path(iid)),
               sql_str(category), sql_str(brand), sales, comments, good_rate,
               sql_str(tag), iid)
        )
    lines.append("")
    lines.append("-- 商品图从程序化生成的 SVG 换成真实产品摄影（纯字符串替换，可重复执行）")
    lines.append("UPDATE item SET image = REPLACE(image, '.svg', '.jpg') WHERE image LIKE '%.svg';")
    lines.append("")
    return "\n".join(lines)


def build_mysql_sql():
    lines = ["-- 商品种子（MySQL 版，INSERT IGNORE 保证重复执行不撞主键）"]
    for it in ITEMS:
        (iid, name, subtitle, price, stock, brand, category,
         sales, comments, good_rate, tag) = it
        lines.append(
            "INSERT IGNORE INTO item (id, name, subtitle, price, stock, image, category, brand, "
            "sales, comment_count, good_rate, tag, status) VALUES (%d, %s, %s, %.2f, %d, %s, %s, %s, %d, %d, %d, %s, 1);"
            % (iid, sql_str(name), sql_str(subtitle), price, stock,
               sql_str(image_path(iid)), sql_str(category), sql_str(brand),
               sales, comments, good_rate, sql_str(tag))
        )
    # 老库升级：早期版本商品图是程序化生成的 SVG，文件已不存在，换成真实产品摄影路径。
    # 与 H2 的 data.sql 末尾那条保持同一语义，可重复执行。
    lines.append("")
    lines.append("-- 老库升级：SVG 商品图路径换成真实产品摄影（幂等）")
    lines.append("UPDATE item SET image = REPLACE(image, '.svg', '.jpg') WHERE image LIKE '%.svg';")
    return "\n".join(lines) + "\n"


def main():
    data_sql = os.path.join(ROOT, "item-service", "src", "main", "resources", "data.sql")
    with open(data_sql, "w", encoding="utf-8") as f:
        f.write(build_h2_sql())

    mysql_sql = os.path.join(ROOT, ".workbuddy", "mysql-items.sql")
    os.makedirs(os.path.dirname(mysql_sql), exist_ok=True)
    with open(mysql_sql, "w", encoding="utf-8") as f:
        f.write(build_mysql_sql())

    cats = {}
    for it in ITEMS:
        cats[it[6]] = cats.get(it[6], 0) + 1
    print("商品总数: %d" % len(ITEMS))
    for k, v in cats.items():
        print("  %-6s %d" % (k, v))
    print("已写入: %s" % data_sql)
    print("已写入: %s" % mysql_sql)
    print("商品图请单独跑 scripts/gen-images.py 生成（frontend/images/p*.jpg）")


if __name__ == "__main__":
    main()
