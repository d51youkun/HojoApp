#!/usr/bin/env bash
# ============================================================
#  まる意見：かんたんデプロイ
#
#  ・トークンは使いません（コピペも不要）
#  ・ブラウザでログインするだけ
#
#  つかいかた:   bash deploy.sh
# ============================================================
set -u
cd "$(dirname "$0")" || exit 1

RUN="npx wrangler@latest"
PROJECT="maru-iken"

say(){ printf '\n\033[1m%s\033[0m\n' "$1"; }
ok(){  printf '   \033[32m✓\033[0m %s\n' "$1"; }
ng(){  printf '   \033[31m✗\033[0m %s\n' "$1"; }

printf '\033[1mまる意見 デプロイ をはじめるよ\033[0m\n'

# --- 0. じゅんびかくにん -------------------------------------
if ! command -v node >/dev/null 2>&1; then
  ng "Node.js が見つからないよ。https://nodejs.org/ から入れてね"
  exit 1
fi
ok "Node.js $(node -v)"

# --- 1. ログイン --------------------------------------------
say "[1/6] Cloudflare にログイン"
if $RUN whoami >/dev/null 2>&1; then
  ok "もうログインずみ"
else
  echo "   ブラウザが開くので「許可」をおしてね（トークンは使いません）"
  if ! $RUN login; then
    ng "ログインできなかった。もう一度ためしてね"
    exit 1
  fi
  ok "ログインできた"
fi

# --- 2. データベース（D1） ----------------------------------
say "[2/6] データベース（D1）をつくる"
if grep -q "ここを database_id" wrangler.toml 2>/dev/null; then
  OUT=$($RUN d1 create "$PROJECT" 2>&1)
  printf '%s\n' "$OUT" | sed 's/^/    /'
  ID=$(printf '%s' "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  if [ -z "$ID" ]; then
    ng "database_id を取り出せなかった。Cloudflare の画面で D1 をつくって、wrangler.toml に貼ってね"
    exit 1
  fi
  node -e '
    const fs = require("fs");
    let s = fs.readFileSync("wrangler.toml", "utf8");
    s = s.replace("ここを database_id に書きかえる", process.argv[1]);
    fs.writeFileSync("wrangler.toml", s);
  ' "$ID"
  ok "wrangler.toml に database_id を書きこんだ"
else
  ok "database_id はもう入っている。とばす"
fi

# --- 3. 表をつくる ------------------------------------------
say "[3/6] データベースに表をつくる"
if $RUN d1 execute "$PROJECT" --remote --file=./schema.sql >/dev/null 2>&1; then
  ok "表をつくった（submissions / opinion_vectors）"
else
  ok "表はもうある（または作成ずみ）。つづける"
fi

# --- 4. Pages プロジェクト ----------------------------------
say "[4/6] Pages プロジェクト"
if $RUN pages project create "$PROJECT" --production-branch main >/dev/null 2>&1; then
  ok "プロジェクトをつくった"
else
  ok "プロジェクトはもうある。とばす"
fi

# --- 5. 秘密のカギ（SESSION_SECRET） ------------------------
say "[5/6] SESSION_SECRET（ログインを守るカギ）"
if $RUN pages secret list --project-name "$PROJECT" 2>/dev/null | grep -q "SESSION_SECRET"; then
  ok "もう入っている。とばす"
else
  SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')
  if printf '%s' "$SECRET" | $RUN pages secret put SESSION_SECRET --project-name "$PROJECT" >/dev/null 2>&1; then
    ok "自動でつくって登録した（メモしなくてOK。Cloudflareの画面で見られる）"
  else
    ng "登録できなかった。Cloudflare の画面 → Settings → Variables and Secrets で SESSION_SECRET を入れてね"
  fi
fi

# --- 6. 公開 -------------------------------------------------
say "[6/6] 公開する"
OUT=$($RUN pages deploy 2>&1)
printf '%s\n' "$OUT" | sed 's/^/    /'
URL=$(printf '%s' "$OUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev' | head -1)

echo
echo "============================================================"
echo " 🎉 ここまで自動でできたよ"
echo "============================================================"
if [ -n "$URL" ]; then
  echo " 公開URL: $URL"
fi
cat <<'EOM'

 のこりは 2つ（Cloudflare の画面でおこなう）:

 A) Settings → Bindings → Add → Workers AI
      変数名に「AI」と入れる   ← これで意見が「意味」でまとまる

 B) Google のクライアントID を 3か所 同じ値にする
      public/index.html の CONFIG.googleClientId
      public/先生/index.html の CONFIG.googleClientId
      Google Cloud の「承認済みの JavaScript 生成元」に 上の公開URL

 できたら先生画面をひらいて、
 「AIで まとめ中（にている度 0.8）」 と出ていれば成功！
============================================================
EOM

if [ -z "$URL" ]; then
  echo
  ng "公開URLを取り出せなかった。上の「Deployment complete」のURLを見てね"
fi
