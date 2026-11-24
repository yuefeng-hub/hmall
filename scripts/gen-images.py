#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
商品图与轮播图生成脚本。

源图有两类：
  1) frontend/images/N.jpg（1~10，2048x2048 的真实产品摄影，无水印，直接用）
  2) .workbuddy/gen/**.png（图像生成产物，右下角带 AI 水印，需裁掉）

输出：
  frontend/images/p{id}.jpg   48 件商品图，800x800
  frontend/images/banner{1..3}.jpg  轮播背景，裁水印后 cover 显示

换图只需要改 SRC 表再跑一次：
  python scripts/gen-images.py
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "frontend", "images")
GEN = os.path.join(ROOT, ".workbuddy", "gen")

# 生成图统一在右下角有水印，垂直裁掉底部这个比例再去掉等高的一圈侧边，
# 这样裁出来的还是正方形（背景渐变连续，不会出现补色的横条）。
WATERMARK_CUT = 0.112

# ---------- 源图 ----------
LEGACY = {n: os.path.join(IMG_DIR, f"{n}.jpg") for n in range(1, 11)}


def g(name):
    """gen 目录下的图。r1/r3 是补生成时为了避开同名覆盖而分开的子目录。"""
    for sub in ("", "r1", "r2", "r3", "r4", "r5", "r6", "r7"):
        p = os.path.join(GEN, sub, name) if sub else os.path.join(GEN, name)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(name)


# 商品 id -> 源图
# 分配原则：同一分类里尽量不重复。同类推荐一屏 6 件，若两张一模一样会很出戏。
# 手机 9 台只有 6 种机型图，必然有 3 组各 2 件同图，优先让「颜色对得上」的相邻。
SRC = {
    # 手机通讯
    1: LEGACY[1],                                                     # 钛灰
    11: g("Professional_e_commerce_produc_2026-11-23T13-17-46.png"),  # 白背板（原色钛）
    12: g("Professional_e_commerce_produc_2026-11-23T12-45-54.png"),  # 绿背板（雅川青）
    13: g("Professional_e_commerce_produc_2026-11-23T13-18-04.png"),  # 黑正面（墨羽）
    14: LEGACY[1],                                                    # 银灰（大漠银月）
    15: g("Professional_e_commerce_produc_2026-11-23T12-45-33.png"),  # 橙金皮革（落日橙）
    16: g("Professional_e_commerce_produc_2026-11-23T12-45-36.png"),  # 蓝背板（绒黑近黑）
    17: g("Professional_e_commerce_produc_2026-11-23T12-45-54.png"),  # 绿背板（岩板绿）
    18: g("Professional_e_commerce_produc_2026-11-23T13-18-04.png"),  # 黑正面（钛灰）
    # 电脑办公：6 台笔记本各用一张不同外观的图
    3: LEGACY[3],                                                     # 机械键盘
    4: LEGACY[4],                                                     # 显示器
    5: LEGACY[5],                                                     # 鼠标
    7: LEGACY[7],                                                     # 移动硬盘
    19: g("Professional_e_commerce_produc_2026-11-23T12-44-14.png"),  # 游戏本（RGB）
    20: g("Professional_e_commerce_produc_2026-11-23T13-15-32.png"),  # 深空灰轻薄本
    21: g("Professional_e_commerce_produc_2026-11-23T12-43-10.png"),  # 银灰轻薄本（MacBook）
    22: g("Professional_e_commerce_produc_2026-11-23T13-15-48.png"),  # 白色超薄本（XPS）
    23: g("Professional_e_commerce_produc_2026-11-23T13-16-12.png"),  # 黑色商务本（ThinkPad）
    24: g("Professional_e_commerce_produc_2026-11-23T13-16-28.png"),  # 深蓝合盖
    47: LEGACY[3],
    # 家用电器：壁挂 / 柜式两种空调
    25: g("Professional_e_commerce_produc_2026-11-23T12-44-13.png"),  # 壁挂空调
    26: g("Professional_e_commerce_produc_2026-11-23T12-46-42.png"),  # 冰箱
    27: g("Professional_e_commerce_produc_2026-11-23T12-44-33.png"),  # 洗衣机
    28: g("Professional_e_commerce_produc_2026-11-23T12-44-36.png"),  # 吸尘器
    29: g("Professional_e_commerce_produc_2026-11-23T12-44-15.png"),  # 电视
    30: g("Professional_e_commerce_produc_2026-11-23T12-44-32.png"),  # 破壁机
    31: g("Professional_e_commerce_produc_2026-11-23T13-17-27.png"),  # 柜式空调
    32: g("Professional_e_commerce_produc_2026-11-23T12-46-41.png"),  # 油烟机
    # 影音娱乐
    2: LEGACY[2],                                                     # TWS 耳机
    8: LEGACY[8],                                                     # 头戴耳机
    33: g("Professional_e_commerce_produc_2026-11-23T12-44-57.png"),  # 游戏主机
    34: g("Professional_e_commerce_produc_2026-11-23T12-46-43.png"),  # 便携音箱
    35: g("Professional_e_commerce_produc_2026-11-23T12-44-54.png"),  # 书架音箱
    36: LEGACY[8],
    37: g("Professional_e_commerce_produc_2026-11-23T12-45-15.png"),  # 口袋云台
    39: LEGACY[2],
    48: g("Professional_e_commerce_produc_2026-11-23T12-44-55.png"),  # 微单
    # 智能穿戴：圆表 / 方表 / 运动表三种
    9: g("Professional_e_commerce_produc_2026-11-23T13-16-50.png"),   # 圆形皮带表
    38: g("Professional_e_commerce_produc_2026-11-23T13-17-09.png"),  # 方形白带表
    40: g("Professional_e_commerce_produc_2026-11-23T12-47-24.png"),  # 手环
    41: g("Professional_e_commerce_produc_2026-11-23T12-47-24.png"),
    42: LEGACY[9],                                                    # 圆形黑运动表（佳明）
    # 数码配件
    6: LEGACY[6],                                                     # 支架
    10: LEGACY[10],                                                   # 移动电源
    43: g("Professional_e_commerce_produc_2026-11-23T12-45-13.png"),  # GaN 充电器
    44: g("Professional_e_commerce_produc_2026-11-23T12-45-16.png"),  # 扩展坞
    45: g("Professional_e_commerce_produc_2026-11-23T12-45-12.png"),  # TF 卡
    46: g("Professional_e_commerce_produc_2026-11-23T12-47-43.png"),  # 摄像头
}

# 轮播背景
BANNERS = {
    1: g("Wide_e_commerce_promotional_ba_2026-11-23T12-45-58.png"),   # 数码好物节（红）
    2: g("Wide_e_commerce_promotional_ba_2026-11-23T12-45-56.png"),   # 新人礼金（紫）
    3: g("Wide_e_commerce_promotional_ba_2026-11-23T12-48-06.png"),   # 家电焕新（青）
}

ITEM_SIZE = 800
JPG_QUALITY = 88
# WebP 在 800×800 的产品图上比 JPEG 小 60~70%，同样画质肉眼看不出差别。
# 前端优先请求 .webp，onerror 再退回 .jpg，所以两套都要生成。
WEBP_QUALITY = 82


def strip_watermark(im):
    """裁掉底部水印区域，并水平居中裁掉等宽的两侧，得到正方形且背景连续。"""
    w, h = im.size
    cut = int(h * WATERMARK_CUT)
    side = (w - (h - cut)) // 2
    return im.crop((side, 0, w - side, h - cut))


def make_item(src, dst):
    im = Image.open(src).convert("RGB")
    if im.width == im.height and im.width >= 2000:
        # 老的真实产品照，本来就没有水印，直接缩放
        pass
    elif im.width == im.height:
        im = strip_watermark(im)
    else:
        im = strip_watermark(im)
    im = im.resize((ITEM_SIZE, ITEM_SIZE), Image.LANCZOS)
    im.save(dst, "JPEG", quality=JPG_QUALITY, optimize=True, progressive=True)
    im.save(dst[:-4] + ".webp", "WEBP", quality=WEBP_QUALITY, method=6)
    return os.path.getsize(dst), os.path.getsize(dst[:-4] + ".webp")


def make_banner(src, dst):
    im = Image.open(src).convert("RGB")
    im = strip_watermark(im)
    # 前端用 background-size: cover，这里只保证宽度够、体积小
    if im.width > 1400:
        im = im.resize((1400, int(im.height * 1400 / im.width)), Image.LANCZOS)
    im.save(dst, "JPEG", quality=JPG_QUALITY, optimize=True, progressive=True)
    # 轮播图在首屏关键路径上，webp 能再砍三到四成
    im.save(dst[:-4] + ".webp", "WEBP", quality=WEBP_QUALITY, method=6)
    return os.path.getsize(dst), os.path.getsize(dst[:-4] + ".webp")


def main():
    if not os.path.isdir(IMG_DIR):
        print("找不到图片目录：" + IMG_DIR)
        return 1

    total = 0
    total_webp = 0
    missing = []
    for iid in sorted(SRC):
        src = SRC[iid]
        if not os.path.exists(src):
            missing.append((iid, src))
            continue
        dst = os.path.join(IMG_DIR, "p%d.jpg" % iid)
        size, size_webp = make_item(src, dst)
        total += size
        total_webp += size_webp
        print("  p%-3d.jpg %5.0f KB / webp %5.0f KB  <- %s"
              % (iid, size / 1024.0, size_webp / 1024.0, os.path.basename(src)))

    banner_total = 0
    banner_total_webp = 0
    for idx in sorted(BANNERS):
        src = BANNERS[idx]
        if not os.path.exists(src):
            missing.append(("banner%d" % idx, src))
            continue
        dst = os.path.join(IMG_DIR, "banner%d.jpg" % idx)
        size, size_webp = make_banner(src, dst)
        banner_total += size
        banner_total_webp += size_webp
        print("  banner%d.jpg %5.0f KB / webp %5.0f KB  <- %s"
              % (idx, size / 1024.0, size_webp / 1024.0, os.path.basename(src)))

    print("")
    print("商品图 %d 张：jpg %.1f MB  /  webp %.1f MB（省 %.0f%%）"
          % (len(SRC), total / 1048576.0, total_webp / 1048576.0,
             (1 - total_webp / max(total, 1)) * 100))
    print("轮播图 %d 张：jpg %.1f MB  /  webp %.1f MB（省 %.0f%%）"
          % (len(BANNERS), banner_total / 1048576.0, banner_total_webp / 1048576.0,
             (1 - banner_total_webp / max(banner_total, 1)) * 100))
    if missing:
        print("缺失源图：")
        for k, v in missing:
            print("  ", k, v)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
