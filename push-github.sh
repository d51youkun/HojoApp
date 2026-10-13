#!/usr/bin/env bash
# ============================================================
#  まる意見：GitHub に 非公開リポジトリとして 上げる
#
#  ・トークンは つかわない（ブラウザで ログインするだけ）
#  ・このファイルを 解凍したフォルダで 実行する
#
#  つかいかた:   bash push-github.sh
# ============================================================
set -u
cd "$(dirname "$0")" || exit 1

REPO="maru-iken"

say(){ printf '\n\033[1m%s\033[0m\n' "$1"; }
ok(){  printf '   \033[32m✓\033[0m %s\n' "$1"; }
ng(){  printf '   \033[31m✗\033[0m %s\n' "$1"; }
note(){ printf '     %s\n' "$1"; }

printf '\033[1mGitHub に 上げる じゅんび\033[0m\n'

# --- 0. 道具の確認 ------------------------------------------
say "[0/5] 道具の確認"
if ! command -v git >/dev/null 2>&1; then
  ng "git が 見つからない。https://git-scm.com/ から 入れてね"
  exit 1
fi
ok "git $(git --version | awk '{print $3}')"

HAS_GH=0
if command -v gh >/dev/null 2>&1; then
  HAS_GH=1
  ok "gh $(gh --version | head -1 | awk '{print $3}')"
else
  note "gh コマンドが ない → 手で 上げる やり方を あとで 出すね"
fi

# --- 1. git の じゅんび -------------------------------------
say "[1/5] git の じゅんび"
if [ -d .git ]; then
  ok "もう git が ある"
else
  git init -q -b main
  ok "git を つくった（main ブランチ）"
fi

git config user.name  >/dev/null 2>&1 || git config user.name  "youhei"
git config user.email >/dev/null 2>&1 || git config user.email "youhei@example.com"

# node_modules など 余計なものを 上げない
if [ ! -f .gitignore ]; then
  printf 'node_modules/\n.wrangler/\n.dev.vars\n.DS_Store\n*.log\n' > .gitignore
  ok ".gitignore を つくった"
fi

# --- 2. コミット --------------------------------------------
say "[2/5] 中身を コミット"
git add -A
if git diff --cached --quiet; then
  ok "新しい変更は ない（すでに コミットずみ）"
else
  git commit -q -m "まる意見：同じ意見があつまると丸が大きくなるクラス意見アプリ"
  ok "コミットした"
fi

# 大事なものが 入っているか
say "[2.5/5] 中身の確認"
MISS=""
for f in public/index.html "public/先生/index.html" wrangler.toml schema.sql; do
  if [ -f "$f" ]; then ok "$f"; else ng "$f が ない"; MISS="1"; fi
done
if [ -d .github/workflows ]; then
  ok ".github/workflows（自動デプロイ）"
else
  note ".github/workflows が ない → ブラウザで上げた人は Actions で zip展開を先にやってね"
fi
if [ -n "$MISS" ]; then
  ng "ファイルが 足りないよ。ここで やめる"
  exit 1
fi

# --- 3. gh のログイン ---------------------------------------
if [ "$HAS_GH" -eq 1 ]; then
  say "[3/5] GitHub に ログイン"
  if gh auth status >/dev/null 2>&1; then
    ok "もう ログインずみ"
  elif [ -t 0 ]; then
    note "ブラウザが 開くので「許可」を おしてね（トークンは つかいません）"
    if ! gh auth login --git-protocol https --web; then
      ng "ログインできなかった。もう一度 ためしてね"
      exit 1
    fi
    ok "ログインできた"
  else
    # 対話できない場面（パイプ・自動実行）では ブラウザが ひらけないので 止まらない
    ng "まだ ログインしていない（この画面では ブラウザが ひらけない）"
    note "ターミナルで もう一度 実行してね:   gh auth login"
    note "ログインできたら、このスクリプトを もう一度 走らせると 続きから すすむ"
    exit 1
  fi
else
  say "[3/5] GitHub に ログイン（手で）"
  note "gh が ないので、GitHub の 画面で リポジトリを つくってね"
fi

# --- 4. リポジトリを つくって push --------------------------
if [ "$HAS_GH" -eq 1 ]; then
  say "[4/5] 非公開リポジトリを つくって push"
  if git remote get-url origin >/dev/null 2>&1; then
    ok "origin は もう ある"
    git push -u origin main 2>&1 | sed 's/^/     /'
  else
    if gh repo create "$REPO" --private --source=. --remote=origin --push 2>&1 | sed 's/^/     /'; then
      ok "非公開リポジトリ $REPO を つくって push した"
    else
      ng "つくれなかった。名前が もう 使われている かも。--private を つけてね"
      exit 1
    fi
  fi

  say "[5/5] つぎに やること"
  cat <<'EOM'
   1. GitHub の リポジトリ → Settings → Secrets and variables → Actions に 2つ 入れる
        CLOUDFLARE_API_TOKEN
        CLOUDFLARE_ACCOUNT_ID
   2. GitHub の Actions →「zipをリポジトリに展開（1回だけ）」を 走らせる
   3. Cloudflare の 画面で D1 と Workers AI のバインドを 設定する
   4. あとは push するだけで 自動デプロイ！

   ★ トークンは GitHub の「秘密」に 直接はる。チャットには 書かない。
EOM
else
  say "[4/5] 手で 上げる やり方"
  echo "   1. https://github.com/new を ひらく"
  echo "   2. Repository name に「$REPO」と 入れる"
  echo "   3. 「Private」を えらぶ → Create repository"
  echo "   4. 出てきた コマンドを コピーして、このフォルダで 実行："
  echo
  echo "      git remote add origin https://github.com/<あなたの名まえ>/$REPO.git"
  echo "      git branch -M main"
  echo "      git push -u origin main"
  echo
fi
