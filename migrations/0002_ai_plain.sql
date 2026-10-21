-- 精選名品的白話改寫（AI 改寫、逐件對照故宮原文查核過，來源 data/ai_plain.json）。
-- 用故宮文物統一編號對應，不跟 items 一起重建：每月重新匯入文物時不會洗掉。
CREATE TABLE IF NOT EXISTS ai_plain (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL
);
