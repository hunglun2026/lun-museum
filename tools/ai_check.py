"""查核 AI 白話改寫（CACHE/build/ai_plain/*.json，{文物編號: 改寫}），抓可能編造或不合規的地方。

規則：
- 字數 30～120；不能有破折號、簡體字、禁用詞
- 改寫裡的阿拉伯數字、中文數字＋單位（例：三足、兩道），故宮名稱／時代／說明裡要找得到
- 改寫提到的朝代名稱，要跟這件文物的朝代一致（或出現在故宮原文裡）
- 每件都要有改寫，不能多也不能少
用法：python tools/ai_check.py [批號…]（不帶參數查全部）；有問題離場碼 1
"""
import json
import unicodedata
import re
import sys

from common import CACHE

BANNED = re.compile(r"——|—|賦能|優化|抓手|顆粒度|閉環|落地|對齊|痛點|視頻|信息|質量|用戶")
DYN_WORDS = ["新石器", "商", "周", "春秋", "戰國", "秦", "漢", "三國", "晉", "南北朝", "隋", "唐", "五代", "遼", "宋", "金", "元", "明", "清", "民國"]
CN_NUM = "一二兩三四五六七八九十百"


def simplified(text):
    try:
        from zhconv import convert
    except ImportError:
        return []
    out = []
    for ch in set(text):
        if ord(ch) > 0x2E80 and convert(ch, "zh-tw") != ch:
            try:
                ch.encode("cp950")
            except UnicodeEncodeError:
                out.append(ch)
    return out


def cn2int(m):
    """十八→18、三十六→36、兩→2；百以上或看不懂回 None"""
    d = {"一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
    if "百" in m:
        return None
    if "十" in m:
        a, _, b = m.partition("十")
        return (d.get(a, 1) if a else 1) * 10 + (d.get(b, 0) if b else 0)
    return d.get(m)


def check_one(src, text):
    probs = []
    ref = src["name"] + src["era"] + (src["dyn"] or "") + src["desc"] + (src["reign"] or "")
    # 原文有時用康熙部首字元（⼆⼗，外觀同二十）或大寫數字（陸拾玖），先轉成一般國字再比
    ref = unicodedata.normalize("NFKC", ref).translate(str.maketrans("壹貳參肆伍陸柒捌玖拾", "一二三四五六七八九十"))
    if not 30 <= len(text) <= 120:
        probs.append(f"字數 {len(text)}")
    if BANNED.search(text):
        probs.append("禁用詞或破折號：" + BANNED.search(text).group(0))
    s = simplified(text)
    if s:
        probs.append("簡體字：" + "".join(s))
    for num in re.findall(r"\d+(?:\.\d+)?", text):
        if num not in ref:
            probs.append(f"數字「{num}」原文沒有")
    for m in re.findall(f"[{CN_NUM}]+(?=[道條個隻面層朵組片件足耳環塊枚顆份冊開幅首])", text):
        alt = {m, m.replace("兩", "二"), m.replace("兩", "雙"), m.replace("二", "兩")}  # 雙耳＝兩個耳朵
        n = cn2int(m)
        if n is not None:
            alt.add(str(n))  # 原文常寫阿拉伯數字（18 個枚）
        if not any(x in ref for x in alt) and m not in ("一",):
            probs.append(f"數量「{m}」原文沒有")
    for d in DYN_WORDS:
        # 「明亮」「清楚」「金色」不是朝代：只看後面接「朝、代、時期、時代」的
        # 也抓「南宋」「北宋」這種前面加方位的寫法
        for m in re.finditer(r"[南北東西]?" + d + r"(?=朝|代|時期|時代|皇)", text):
            if m.group(0) != d and m.group(0) not in ref:
                probs.append(f"朝代「{m.group(0)}」原文沒有")
        for m in re.finditer(d + r"(?=朝|代|時期|時代)", text):
            if d not in ref and d not in (src["grp"] or ""):
                probs.append(f"朝代「{d}」跟這件文物不符")
    return probs


def main():
    want = set(sys.argv[1:])
    srcs = {json.loads(l)["id"]: json.loads(l) for l in open(CACHE / "build" / "ai_pick.jsonl", encoding="utf-8")}
    done, bad = {}, 0
    for f in sorted((CACHE / "build" / "ai_plain").glob("*.json")):
        if want and f.stem not in want:
            continue
        data = json.loads(f.read_text("utf-8"))
        batch_ids = [l.split("\t")[0] for l in (CACHE / "build" / "ai_batch" / f"{f.stem}.txt").read_text("utf-8").splitlines()]
        missing = [i for i in batch_ids if i not in data]
        extra = [i for i in data if i not in batch_ids]
        if missing or extra:
            print(f"[{f.stem}] 缺 {len(missing)} 件、多 {len(extra)} 件：{(missing + extra)[:3]}")
            bad += 1
        for iid, text in data.items():
            if iid not in srcs:
                continue
            p = check_one(srcs[iid], text)
            if p:
                bad += 1
                print(f"[{f.stem}] {iid} {srcs[iid]['name']}：{'；'.join(p)}\n    改寫：{text}")
            done[iid] = text
    print(f"查了 {len(done)} 件，有問題 {bad} 處")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
