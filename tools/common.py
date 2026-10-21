"""tools/ 共用：快取位置、讀原始檔。快取不放 ClaudeOnly（3GB 照片不能進備份 git）。"""
import json
import os
from pathlib import Path

CACHE = Path(os.environ.get("LUN_MUSEUM_CACHE", r"D:\lun-museum-cache"))
ROOT = Path(__file__).resolve().parent.parent


def load_list(path: Path) -> list:
    """故宮 JSON 有時是陣列、有時包一層物件，統一取出陣列。"""
    d = json.loads(path.read_text("utf-8-sig"))
    if isinstance(d, list):
        return d
    return next(v for v in d.values() if isinstance(v, list))
