-- まる意見：データベースのもと（v3：なまえは 1回だけ／意見は 何回でも ふえる）

-- とうろくした「なまえ」。1つの ブラウザ（Cookie）に 1行。あとから かえない。
CREATE TABLE IF NOT EXISTS kids (
  sid        TEXT PRIMARY KEY,      -- ブラウザごとの あいことば（Cookieに入る）
  name       TEXT NOT NULL,         -- 自分で 打った なまえ（先生画面に出る）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- おくられた 意見。おくるたびに 1行 ふえる（上書きしない）。
CREATE TABLE IF NOT EXISTS submissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sid        TEXT NOT NULL,         -- おくった人
  name       TEXT NOT NULL,         -- おくった人の なまえ（とうろくずみの なまえ）
  opinion    TEXT NOT NULL,         -- 意見
  reason     TEXT NOT NULL,         -- その理由
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_sid ON submissions(sid);

-- 意見の「意味の数値（ベクトル）」をためておく場所。
-- 同じ意見を何度も Workers AI に送らないようにするためのメモ。
CREATE TABLE IF NOT EXISTS opinion_vectors (
  subject_id  TEXT PRIMARY KEY,     -- submissions.id（意見ごとの 番号）
  opinion_key TEXT NOT NULL,
  model       TEXT NOT NULL,
  vector      TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
