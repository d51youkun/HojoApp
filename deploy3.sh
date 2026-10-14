#!/bin/bash
# まる意見 v3：安全に デプロイする（データを 消さない）
#  ・0件なら 表を つくりなおす
#  ・データが あれば、かたちが 古い ときだけ 引っこしする（消さない）
cd "/Users/natumurayouhei/Library/Application Support/gensparkaio/workspace/hojoapp" 2>/dev/null || cd "$(dirname "$0")"
NODE_BIN="$(command -v node)"
W(){ npx --yes wrangler@4.136.2 "$@"; }
PROJECT=maru-iken
say(){ echo; echo "===== $* ====="; }

say "1) ログインの かくにん"
if ! W whoami >/dev/null 2>&1; then W login || W login --device; fi
W whoami 2>&1 | sed -n '1,3p'
W whoami >/dev/null 2>&1 || { echo "!! ログインできませんでした"; exit 1; }

say "2) いまの データ"
N="$(W d1 execute $PROJECT --remote --json --command 'SELECT COUNT(*) AS n FROM submissions' 2>/dev/null | tr -d ' \n' | grep -o '"n":[0-9]*' | head -1 | grep -o '[0-9]*$')"
N="${N:-0}"
HASID="$(W d1 execute $PROJECT --remote --json --command "SELECT COUNT(*) AS n FROM pragma_table_info('submissions') WHERE name='id'" 2>/dev/null | tr -d ' \n' | grep -o '"n":[0-9]*' | head -1 | grep -o '[0-9]*$')"
HASID="${HASID:-0}"
echo "意見: $N 件 ／ あたらしい かたち(id列)か: $HASID"

if [ "$N" = "0" ]; then
  say "3-A) 0件なので 表を つくりなおす"
  W d1 execute $PROJECT --remote --yes --command "DROP TABLE IF EXISTS submissions; DROP TABLE IF EXISTS opinion_vectors; DROP TABLE IF EXISTS kids;" || exit 1
  W d1 execute $PROJECT --remote --yes --file=./schema.sql || exit 1
elif [ "$HASID" = "0" ]; then
  say "3-B) データが あるので 「引っこし」する（消さない）"
  W d1 execute $PROJECT --remote --yes --command "
CREATE TABLE IF NOT EXISTS kids (sid TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT OR IGNORE INTO kids (sid, name, created_at) SELECT sid, name, COALESCE(created_at, datetime('now')) FROM submissions WHERE sid IS NOT NULL AND name IS NOT NULL;
CREATE TABLE IF NOT EXISTS submissions_new (id INTEGER PRIMARY KEY AUTOINCREMENT, sid TEXT NOT NULL, name TEXT NOT NULL, opinion TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
INSERT INTO submissions_new (sid, name, opinion, reason, created_at) SELECT sid, name, opinion, reason, COALESCE(created_at, datetime('now')) FROM submissions;
DROP TABLE submissions;
ALTER TABLE submissions_new RENAME TO submissions;
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_sid ON submissions(sid);
DROP TABLE IF EXISTS opinion_vectors;
CREATE TABLE IF NOT EXISTS opinion_vectors (subject_id TEXT PRIMARY KEY, opinion_key TEXT NOT NULL, model TEXT NOT NULL, vector TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
" || exit 1
else
  say "3-C) もう あたらしい かたちなので 表は さわらない"
fi

say "4) 先生の 合言葉を ６年生 に する"
printf '%s' "６年生" | W pages secret put TEACHER_PASS --project-name $PROJECT || exit 1

say "5) デプロイ"
W pages deploy public --project-name $PROJECT --branch main --commit-dirty=true 2>&1 | tail -8

say "6) たしかめる"
D="https://$PROJECT.pages.dev"; sleep 6
echo -n "トップ: "; curl -s -o /dev/null -w "%{http_code}\n" "$D/"
echo -n "先生画面: "; curl -s -o /dev/null -w "%{http_code}\n" "$D/%E5%85%88%E7%94%9F/"
T="$(mktemp)"
curl -s -c "$T" -H 'content-type: application/json' -d '{"pass":"６年生"}' "$D/api/teacher"; echo
echo "・先生画面の データ: "; curl -s -b "$T" "$D/api/board" | head -c 500; echo
rm -f "$T"
echo "（total が データの かずと おなじなら だいじょうぶ）"
