#!/bin/bash
# 使い方：  bash set-google-id.sh 1234567890-abcdef.apps.googleusercontent.com
# クライアントIDを3か所（子ども画面・先生画面・wrangler.toml）に入れて、
# GitHubにpushして、Cloudflareにデプロイし直す。
set -e
cd "/Users/natumurayouhei/Library/Application Support/gensparkaio/workspace/hojoapp"
ID="$1"
if [ -z "$ID" ]; then
  echo "クライアントIDを引数にしてください"
  echo "例: bash set-google-id.sh 1234567890-abcdef.apps.googleusercontent.com"
  exit 1
fi
case "$ID" in
  *apps.googleusercontent.com) ;;
  *) echo "この形じゃない（〜.apps.googleusercontent.com で終わるはず）: $ID"; exit 1 ;;
esac

python3 - "$ID" <<'PY'
import sys, re, pathlib
cid = sys.argv[1].strip()
def put(path, pattern, label):
    f = pathlib.Path(path); s = f.read_text(encoding="utf-8")
    s2 = re.sub(pattern, lambda m: m.group(1) + cid + m.group(2), s, count=1)
    f.write_text(s2, encoding="utf-8")
    print(f"{path} … {'入れた' if s2 != s else '変わらなかった（要確認）'}")
put("public/index.html",        r'(googleClientId:\s*")[^"]*(")', "子ども画面")
put("public/先生/index.html",   r'(googleClientId:\s*")[^"]*(")', "先生画面")
put("wrangler.toml",            r'(GOOGLE_CLIENT_ID\s*=\s*")[^"]*(")', "wrangler.toml")
PY

echo "=== 入ったか確認 ==="
grep -n "googleClientId" public/index.html public/先生/index.html
grep -n "GOOGLE_CLIENT_ID" wrangler.toml

echo "=== GitHub に push ==="
git add -A
git -c user.name="夏村洋平" -c user.email="d51498go@icloud.com" commit -m "GoogleのクライアントIDを設定" || echo "（コミットするものは無かった）"
git -c credential.helper='!gh auth git-credential' push origin main

echo "=== デプロイし直す ==="
bash deploy-maru.sh
