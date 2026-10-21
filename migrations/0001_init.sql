-- 資料表結構的唯一來源。tools/build_sql.py 讀這份，把 items／archives 等表名換成 *_new 建新表，
-- 匯入全部成功才換名，失敗時舊資料不動。改欄位要兩邊一起看。

-- 院藏文物（16 類，約 10.9 萬件）。n 是整數主鍵，給搜尋索引當 rowid
CREATE TABLE IF NOT EXISTS items (
  n INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,      -- 故宮文物統一編號
  name TEXT NOT NULL,
  cat TEXT NOT NULL,            -- 分類鍵（bronze、jade…），對照 public/js/data.js 的 CATS
  size TEXT, era TEXT,          -- era：故宮原文
  dyn TEXT, grp TEXT,           -- 正規化後的朝代、朝代群（tools/era.py）
  emperor TEXT, reign TEXT, year INTEGER, y0 INTEGER, y1 INTEGER,
  era_quiz INTEGER NOT NULL,    -- 1＝朝代確定，可以出朝代題
  descr TEXT, url TEXT,
  img TEXT,                     -- 故宮圖片代號（ImageId_randomCode），R2 檔名也用它
  pool INTEGER NOT NULL,        -- 1＝出題池（有圖、朝代確定、說明 ≥ 20 字）
  photo INTEGER NOT NULL DEFAULT 0  -- 1＝照片已上傳到本站 R2
);
CREATE INDEX IF NOT EXISTS items_pool ON items (pool, photo, grp);
CREATE INDEX IF NOT EXISTS items_cat ON items (cat, grp);

-- 清代檔案（9 類，約 39.6 萬件），只有目錄資料
CREATE TABLE IF NOT EXISTS archives (
  n INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,      -- 統一編號（故宮原件網址由它算出）
  docno TEXT, kind TEXT,        -- 文獻編號、資料集名（宮中檔奏摺…）
  title TEXT NOT NULL,          -- 品名／事由
  author TEXT, person TEXT, office TEXT,
  date_raw TEXT, year INTEGER,  -- 原文日期、換算的西元年（清代年號）
  form TEXT, size TEXT
);
CREATE INDEX IF NOT EXISTS archives_year ON archives (year);

-- 搜尋索引：tok 是「單字＋兩字一組」以空白隔開的詞（tools/tokens.py、src/tokens.ts）
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(tok, content='', tokenize='unicode61');
CREATE VIRTUAL TABLE IF NOT EXISTS archives_fts USING fts5(tok, content='', tokenize='unicode61');

-- 匯入紀錄與每月檢查紀錄
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS check_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL, status TEXT NOT NULL, message TEXT
);
