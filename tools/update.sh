#!/usr/bin/env bash
# 每月檢查（src/check.ts）發現故宮資料更新時跑這支：下載 → 整理 → 匯入 D1 → 補抓新照片 → 轉檔上傳 → 字型檢查。
# 任何一步失敗就停（匯入失敗時線上仍是舊資料）。用法：bash tools/update.sh
set -euo pipefail
cd "$(dirname "$0")"
echo "== 1/6 下載有更新的資料集"; python -X utf8 fetch_data.py
echo "== 2/6 整理（朝代正規化、出題池）"; python -X utf8 normalize.py
echo "== 3/6 產生匯入 SQL（標記已上傳的照片）"; python -X utf8 build_sql.py --photos /d/lun-museum-cache/img/uploaded.txt
echo "== 4/6 匯入線上 D1"; bash import.sh items; bash import.sh archives
echo "== 5/6 補抓新照片、轉檔、上傳"; python -X utf8 fetch_images.py; python -X utf8 build_images.py; python -X utf8 upload_images.py
echo "== 6/6 字型檢查（缺字就重切，再發布）"
cd .. && python -X utf8 scripts/build-font.py --check || { python -X utf8 scripts/build-font.py; echo "字型重切了，要全站升 ?v=N 再跑 scripts/publish-public.sh"; }
echo "完成"
