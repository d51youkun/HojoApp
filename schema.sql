-- まる意見：データベースのもと（ログインなし版）
-- 1つのブラウザ（Cookie）につき1件。もう一度送ると上書きされる。

CREATE TABLE IF NOT EXISTS submissions (
  sid        TEXT PRIMARY KEY,      -- ブラウザごとの あいことば（Cookieに入る）
  name       TEXT NOT NULL,         -- 自分で打った なまえ（先生画面に出る）
  opinion    TEXT NOT NULL,         -- 意見
  reason     TEXT NOT NULL,         -- その理由
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);

-- 意見の「意味の数値（ベクトル）」をためておく場所。
-- 同じ意見を何度も Workers AI に送らないようにするためのメモ。
CREATE TABLE IF NOT EXISTS opinion_vectors (
  sid         TEXT PRIMARY KEY,
  opinion_key TEXT NOT NULL,
  model       TEXT NOT NULL,
  vector      TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
