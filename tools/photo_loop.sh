#!/usr/bin/env bash
# 抓圖還在跑的期間，每 10 分鐘轉檔＋上傳一次；抓圖結束後再做最後一輪。
# 用法：bash tools/photo_loop.sh   （log 在 CACHE/img/loop.log）
cd "$(dirname "$0")"
LOG=/d/lun-museum-cache/img/loop.log
alive() { python -c "import psutil,sys;sys.exit(0 if any(any(a.endswith('fetch_images.py') for a in (p.info['cmdline'] or [])) for p in psutil.process_iter(['cmdline'])) else 1)"; }  # 看全部參數：帶 --all 時最後一個不是檔名
while true; do
  running=0; alive && running=1
  { date '+%m-%d %H:%M'; python -X utf8 build_images.py | tail -1; python -X utf8 -u upload_images.py | tail -2; } >> "$LOG" 2>&1
  [ $running = 0 ] && { echo "抓圖已結束，最後一輪完成" >> "$LOG"; break; }
  sleep 600
done
