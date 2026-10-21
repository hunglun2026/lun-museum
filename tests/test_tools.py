"""離線測試：朝代正規化、搜尋切詞、清代檔案年號換算與具奏人拆解。"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
from era import norm  # noqa: E402
from tokens import index_tokens, query_tokens  # noqa: E402
from build_sql import reign_year, split_person  # noqa: E402


class Era(unittest.TestCase):
    def check(self, raw, group, quiz, **kw):
        r = norm(raw)
        self.assertEqual((r["group"], r["quiz"]), (group, quiz), raw)
        for k, v in kw.items():
            self.assertEqual(r[k], v, f"{raw} 的 {k}")

    def test_single(self):
        self.check("清高宗乾隆十一年（1746）", "清", True, emperor="高宗", reign="乾隆", year=1746)
        self.check("清 乾隆", "清", True, reign="乾隆")
        self.check("北宋", "宋", True, dyn="北宋")
        self.check("春秋中晚期", "周", True)
        self.check("良渚文化", "新石器時代", True)
        self.check("周則天武后萬歲通天二年（697）", "唐", True)

    def test_not_quiz(self):
        self.check("明晚期至清", "明", False, why="跨朝代")
        self.check("唐以後", "唐", False, why="跨朝代")
        self.check("西元19世紀", None, False, why="只寫世紀")
        self.check("時代待訂", None, False, why="無年代")
        self.check("日本江戶時代", None, False, why="外國")
        self.check("（傳）明", None, False)
        self.check("", None, False)

    def test_same_group_span_ok(self):
        # 同一個朝代群內的範圍（新石器兩個文化）仍可出題
        self.check("崧澤文化至良渚文化早期", "新石器時代", True)


class Tokens(unittest.TestCase):
    def test_shared_cases(self):
        for c in json.loads((Path(__file__).parent / "tokens.json").read_text("utf-8")):
            self.assertEqual(query_tokens(c["q"]), c["query"], c["q"])

    def test_index_covers_query(self):
        # 建索引的詞一定要包含查詢的詞，否則查不到
        idx = set(index_tokens("青花纏枝蓮紋瓶 Ru").split())
        for q in ("青花", "纏枝蓮", "瓶", "ru"):
            self.assertTrue(set(query_tokens(q)) <= idx, q)


class Archives(unittest.TestCase):
    def test_reign_year(self):
        self.assertEqual(reign_year("雍正12年06月20日"), 1734)
        self.assertEqual(reign_year("康熙47年04月19日"), 1708)
        self.assertEqual(reign_year("乾隆元年"), 1736)
        self.assertEqual(reign_year("光緒二十一年"), 1895)
        self.assertIsNone(reign_year(""))
        self.assertIsNone(reign_year("不詳"))

    def test_split_person(self):
        self.assertEqual(split_person("[具奏人]常安@浙江巡撫"), ("常安", "浙江巡撫"))
        self.assertEqual(split_person("[具奏人]海保@"), ("海保", None))
        self.assertEqual(split_person(""), (None, None))


if __name__ == "__main__":
    unittest.main()
