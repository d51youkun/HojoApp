-- まる意見：データベースのもと
-- 1人（1つのGoogleアカウント）につき1件。もう一度送ると上書きされる。

CREATE TABLE IF NOT EXISTS submissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,   -- 送った人のGoogleメール（重複しない）
  name       TEXT NOT NULL,          -- 先生画面に出る名前
  picture    TEXT DEFAULT '',        -- アイコン画像のURL
  opinion    TEXT NOT NULL,          -- 意見
  reason     TEXT NOT NULL,          -- その理由
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);

-- 意見の「意味の数値（ベクトル）」をためておく場所。
-- 同じ意見を何度も Workers AI に送らないようにするためのメモ。
CREATE TABLE IF NOT EXISTS opinion_vectors (
  email       TEXT PRIMARY KEY,
  opinion_key TEXT NOT NULL,
  model       TEXT NOT NULL,
  vector      TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
