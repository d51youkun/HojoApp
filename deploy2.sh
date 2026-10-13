#!/bin/bash
# まる意見：ログインなし版を Cloudflare に デプロイする
cd "/Users/natumurayouhei/Library/Application Support/gensparkaio/workspace/hojoapp" || exit 1
NODE=/usr/local/bin/node
CLI="./node_modules/wrangler/wrangler-dist/cli.js"
w(){ "$NODE" "$CLI" "$@"; }
PROJECT=maru-iken
say(){ echo; echo "===== $* ====="; }

say "0) だれとして ログインしているか"
w whoami 2>&1 | sed -n '1,4p'

say "1) いまの データを かくにん"
RAW="$(w d1 execute $PROJECT --remote --json --command "SELECT COUNT(*) AS n FROM submissions" 2>&1 || true)"
printf '%s\n' "$RAW" | tail -4
OLD="$(printf '%s' "$RAW" | tr -d ' \n' | grep -o '"n":[0-9]*' | head -1 | grep -o '[0-9]*$' || true)"
OLD="${OLD:-0}"
echo "とうろく数: $OLD"
if [ "$OLD" != "0" ]; then
  echo "!! すでに データが あるので、表は こわしません。ここで やめます。"
  exit 1
fi

say "2) 表を つくりなおす（0件なので 安全）"
w d1 execute $PROJECT --remote --yes --command "DROP TABLE IF EXISTS submissions; DROP TABLE IF EXISTS opinion_vectors;" 2>&1 | tail -3
w d1 execute $PROJECT --remote --yes --file=./schema.sql 2>&1 | tail -6
echo "--- いまの 表 ---"
w d1 execute $PROJECT --remote --json --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" 2>&1 | tr -d ' \n' | head -c 400
echo

say "3) 先生の 合言葉（TEACHER_PASS）"
if w pages secret list --project-name $PROJECT 2>&1 | grep -q TEACHER_PASS; then
  echo "TEACHER_PASS は もう ある（かきかえない）"
else
  PASS="$(openssl rand -hex 4)"
  OUT="$HOME/Desktop/まる意見-先生の合言葉.txt"
  printf 'まる意見 先生画面の 合言葉: %s\n' "$PASS" > "$OUT"
  chmod 600 "$OUT"
  printf '%s' "$PASS" | w pages secret put TEACHER_PASS --project-name $PROJECT 2>&1 | tail -2
  echo "合言葉を つくって ついかした（かきこみ先は デスクトップの ファイル）"
fi

say "4) デプロイ"
w pages deploy public --project-name $PROJECT --branch main --commit-dirty=true 2>&1 | tail -12

say "5) できたか みにいく"
sleep 6
echo -n "トップ: "; curl -s -o /dev/null -w "%{http_code}\n" "https://$PROJECT.pages.dev/"
echo -n "先生画面: "; curl -s -o /dev/null -w "%{http_code}\n" "https://$PROJECT.pages.dev/%E5%85%88%E7%94%9F/"
echo -n "me: "; curl -s "https://$PROJECT.pages.dev/api/me"; echo
echo -n "submission（Cookieなし）: "; curl -s "https://$PROJECT.pages.dev/api/submission"; echo
echo -n "board（合言葉なし）: "; curl -s "https://$PROJECT.pages.dev/api/board"; echo
echo -n "teacher（まちがった合言葉）: "; curl -s -X POST -H 'content-type: application/json' -d '{"pass":"zzzz"}' "https://$PROJECT.pages.dev/api/teacher"; echo
echo -n "トップに Google のタグが のこっていないか: "; curl -s "https://$PROJECT.pages.dev/" | grep -c "accounts.google.com" || true
echo -n "トップに なまえ欄が あるか: "; curl -s "https://$PROJECT.pages.dev/" | grep -c 'id="name"'

say "おわり"
echo "URL: https://$PROJECT.pages.dev/   先生: https://$PROJECT.pages.dev/先生/"
