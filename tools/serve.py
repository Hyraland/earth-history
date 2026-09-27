# 本地静态服务器：和 `python3 -m http.server` 一样，但每个响应都带 `Cache-Control: no-cache`。
# 标准的 http.server 不发缓存头，浏览器会按"最后修改时间"自行猜一个缓存时长，
# 于是改过的 JS 模块或模型可能在一段时间内仍用旧版本。no-cache 让浏览器每次都先问服务器，
# 文件没变时服务器回 304，几乎不耗时间。
#
# 用法：python3 tools/serve.py [端口]（在项目根目录运行）

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    root = Path(__file__).resolve().parent.parent
    handler = partial(NoCacheHandler, directory=str(root))
    with ThreadingHTTPServer(('127.0.0.1', port), handler) as server:
        server.serve_forever()


if __name__ == '__main__':
    main()
