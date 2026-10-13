#!/bin/bash
# まる意見：Macのターミナルから Cloudflare にデプロイ（v3: nodeを明示してよぶ）
cd "/Users/natumurayouhei/Library/Application Support/gensparkaio/workspace/hojoapp" || exit 1
NODE=/usr/local/bin/node
CLI="./node_modules/wrangler/wrangler-dist/cli.js"
w(){ "$NODE" "$CLI" "$@"; }
PROJECT=maru-iken
say(){ echo; echo "===== $* ====="; }

say "1) Cloudflare に ログイン"
if ! w whoami >/dev/null 2>&1; then
  w login
fi
w whoami 2>&1 | head -20

say "2) D1（データベース）"
D1ID="$(grep -oE 'database_id = "[^"]+"' wrangler.toml | head -1 | sed 's/.*"\(.*\)"/\1/')"
if [ -z "$D1ID" ] || [ "$D1ID" = "ここを database_id に書きかえる" ]; then
  out="$(w d1 create maru-iken 2>&1)"; echo "$out"
  id="$(printf '%s' "$out" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  if [ -n "$id" ]; then
    sed -i '' "s/ここを database_id に書きかえる/$id/" wrangler.toml
    echo "database_id を 書きこんだ: $id"
  else
    echo "!! 作れなかった。いま ある D1 を 見る"
    w d1 list 2>&1 | head -30
  fi
else
  echo "database_id は すでに 入っている: $D1ID"
fi

say "3) 表を つくる（schema.sql）"
w d1 execute maru-iken --remote --file=./schema.sql --yes 2>&1 | tail -20

say "4) Pages プロジェクト"
w pages project create $PROJECT --production-branch main 2>&1 | tail -6

say "5) 合言葉（SESSION_SECRET）を 登録"
if w pages secret list --project-name $PROJECT 2>&1 | grep -q SESSION_SECRET; then
  echo "すでに ある"
else
  openssl rand -hex 32 | tr -d '\n' | w pages secret put SESSION_SECRET --project-name $PROJECT 2>&1 | tail -3
fi

say "6) デプロイ"
w pages deploy public --project-name $PROJECT --branch main 2>&1 | tail -30

say "7) できたか 見にいく"
sleep 5
curl -s -o /dev/null -w "トップ: %{http_code}\n" "https://$PROJECT.pages.dev/"
curl -s "https://$PROJECT.pages.dev/api/board" | head -c 300; echo

say "おわり"
echo "URL: https://$PROJECT.pages.dev/"
