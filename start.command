#!/bin/bash
# 双击启动"四十六亿年漫步"：在本地开一个静态服务器并打开浏览器。
# 关掉这个终端窗口（或按 Ctrl+C）服务器就停止，不会留在后台。
cd "$(dirname "$0")"
PORT=8765
echo "四十六亿年漫步：http://localhost:$PORT"
echo "关闭这个窗口或按 Ctrl+C 即可停止。"
(sleep 1; open "http://localhost:$PORT") &
exec python3 tools/serve.py "$PORT"
