"""挑選要 AI 白話改寫的「名品」約 1,000 件 → CACHE/build/ai_pick.jsonl，並切成每批 50 件的 ai_batch/NN.txt 給改寫用。

條件：出題池、說明 60～400 字（夠豐富又不會太長）。
名額：依朝代件數的平方根分配（清朝不會佔掉大半，商、周、唐也有份）；朝代內各分類輪流挑。
用法：python tools/ai_pick.py [--total 1000]
"""
import argparse
import collections
import itertools
import json
import math
import random
import sys

from common import CACHE

BATCH = 50


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--total", type=int, default=1000)
    a = ap.parse_args()
    random.seed(20261021)  # 固定種子：重跑挑出同一批，已改寫的不會白做
    rows = [json.loads(l) for l in open(CACHE / "build" / "items.jsonl", encoding="utf-8")]
    cand = [r for r in rows if r["pool"] and 60 <= len(r["desc"]) <= 400]
    by = collections.defaultdict(list)
    for r in cand:
        by[r["grp"]].append(r)
    weight = {g: math.sqrt(len(v)) for g, v in by.items()}
    tot = sum(weight.values())
    picked = []
    for g, items in by.items():
        quota = min(len(items), max(3, round(a.total * weight[g] / tot)))
        bycat = collections.defaultdict(list)
        for r in random.sample(items, len(items)):
            bycat[r["cat"]].append(r)
        rr = [x for x in itertools.chain.from_iterable(itertools.zip_longest(*bycat.values())) if x]
        picked += rr[:quota]
    picked.sort(key=lambda r: (r["y0"] or 0, r["cat"], r["id"]))
    out = CACHE / "build"
    with open(out / "ai_pick.jsonl", "w", encoding="utf-8") as f:
        for r in picked:
            f.write(json.dumps({k: r[k] for k in ("id", "name", "cat", "era", "dyn", "grp", "reign", "desc")}, ensure_ascii=False) + "\n")
    bd = out / "ai_batch"
    bd.mkdir(exist_ok=True)
    for i in range(0, len(picked), BATCH):
        with open(bd / f"{i // BATCH:02d}.txt", "w", encoding="utf-8") as f:
            for r in picked[i: i + BATCH]:
                f.write(f"{r['id']}\t{r['name']}\t{r['era'] or r['dyn']}\t{r['cat']}\t{r['desc']}\n")
    print(f"挑出 {len(picked)} 件，切成 {math.ceil(len(picked) / BATCH)} 批")
    print("各朝代：", collections.Counter(r["grp"] for r in picked).most_common())
    print("各分類：", collections.Counter(r["cat"] for r in picked).most_common())


if __name__ == "__main__":
    sys.exit(main())
