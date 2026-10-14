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

-- 先生が出した「しつもん」と、子どもの「こたえ」。
-- kind:"reason" … 理由をきく ／ kind:"detail" … 詳しくお願いする
CREATE TABLE IF NOT EXISTS asks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sid           TEXT NOT NULL,         -- だれに きいたか
  name          TEXT NOT NULL,         -- その人の なまえ
  kind          TEXT NOT NULL,         -- "reason" / "detail"
  text          TEXT NOT NULL,         -- 先生の ことば
  submission_id INTEGER,               -- どの意見について か（なければ 空）
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  answered      INTEGER NOT NULL DEFAULT 0,
  answer        TEXT NOT NULL DEFAULT '',
  answered_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_asks_sid ON asks(sid);
CREATE INDEX IF NOT EXISTS idx_asks_open ON asks(sid, answered);

-- 止めた（Banした）人の リスト。復旧すると この行を けす。
CREATE TABLE IF NOT EXISTS bans (
  sid        TEXT PRIMARY KEY,         -- 止めた ブラウザ（Cookie）
  name       TEXT NOT NULL,            -- 止めた ときの なまえ
  reason     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bans_name ON bans(name);

-- アプリの せってい（見出しの ことば など）。k ごとに 1行。
CREATE TABLE IF NOT EXISTS settings (
  k          TEXT PRIMARY KEY,      -- 例: "history_theme"
  v          TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 子どもが アップした 写真（オプション）。ブラウザで 小さくしてから 入る。
CREATE TABLE IF NOT EXISTS photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sid        TEXT NOT NULL,         -- アップした人
  name       TEXT NOT NULL,         -- その人の なまえ
  caption    TEXT NOT NULL DEFAULT '',
  data       TEXT NOT NULL,         -- data:image/jpeg;base64,…（小さくした もの）
  bytes      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_created ON photos(created_at);
CREATE INDEX IF NOT EXISTS idx_photos_sid ON photos(sid);

-- 意見の「意味の数値（ベクトル）」をためておく場所。
-- 同じ意見を何度も Workers AI に送らないようにするためのメモ。
CREATE TABLE IF NOT EXISTS opinion_vectors (
  subject_id  TEXT PRIMARY KEY,     -- submissions.id（意見ごとの 番号）
  opinion_key TEXT NOT NULL,
  model       TEXT NOT NULL,
  vector      TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ブラウザで おきた エラーを あつめる（どこで こけているか 見るため）
CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page       TEXT NOT NULL DEFAULT '',
  step       TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  extra      TEXT NOT NULL DEFAULT '',
  ua         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
