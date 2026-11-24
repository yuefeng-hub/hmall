#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
给 frontend 起一个多线程静态服务。

为什么不用 `python -m http.server`：
  它是单线程的，HTTP/1.1 keep-alive 下浏览器并发拉 48 张商品图会互相阻塞，
  20 秒都加载不完，截图/端到端验证会大面积误判成「破图」。

用法：python scripts/serve-frontend.py [端口]（默认 8090）
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND = os.path.join(ROOT, "frontend")


class Handler(SimpleHTTPRequestHandler):
    # 图片允许长缓存，方便反复刷新页面做视觉验证
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
    }

    def end_headers(self):
        if self.path.split("?")[0].endswith((".jpg", ".webp", ".png", ".svg")):
            self.send_header("Cache-Control", "public, max-age=600")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 静音，避免刷屏


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
    handler = partial(Handler, directory=FRONTEND)
    srv = ThreadingHTTPServer(("127.0.0.1", port), handler)
    srv.daemon_threads = True
    print("serving %s on http://127.0.0.1:%d" % (FRONTEND, port))
    srv.serve_forever()


if __name__ == "__main__":
    main()
