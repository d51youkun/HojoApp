> **v5（2026-10-14）：UIを Liquid Glass に／円を 小さく。**
> ・まるの めんせきを 画面の 20%に おさえ、半径は 38〜250。

> **v4（2026-10-14）：先生が あとから 意見を けせる。**
> ・先生画面で 丸をおす → 「理由」タブ → 各行の「けす」を 2回おすと 1つ けせる。
> ・けすには 合言葉が いる（子どもからは けせない）。

> **v3（2026-10-14）：なまえは 1回だけ とうろく／意見は 何回でも ふえる。**
> ・子どもは はじめて ひらいた ときに「なまえ」を 入れる。あとから かえられない・上書きされない。
> ・意見と 理由は、おくるたびに 「あたらしい意見」として ふえる（前のを 上書きしない）。
> ・先生画面は 合言葉（Cloudflare の Secret `TEACHER_PASS`）。

> **v2（2026-10-14）：ログインを やめました。**
> 子どもは 画面で「なまえ」を 打つだけです。Google の ログインは もう つかいません。
> 先生画面は 合言葉（Cloudflare の Secret `TEACHER_PASS`）で ひらきます。
> この下に のこっている Google の 手順は、もう 必要ありません。

# まる意見（maru-iken）

同じ意見があつまるほど、先生の画面で**まるが大きくなる**アプリ。
子どもは Google でログインして「意見」と「理由」をおくる。先生は `/先生` でまるを見て、まるを押すと**名前**と**理由**が見られる。

- 子ども用：`/`
- 先生用：`/先生/`
- しくみ：Cloudflare Pages（静的ファイル）＋ Pages Functions（API）＋ D1（データベース）


---

## 2-0. いちばんかんたんな方法：`deploy.sh`

ターミナルでこれだけ。**トークンは使いません。** ブラウザでログインするだけ。

```bash
bash deploy.sh
```

このスクリプトが自動でやること：

1. `wrangler login`（ブラウザが開く）
2. D1 をつくって、出てきた `database_id` を `wrangler.toml` に**自動で書きこむ**
3. `schema.sql` を流して表をつくる
4. Pages プロジェクトをつくる
5. `SESSION_SECRET` を**自動で生成**して登録する
6. 公開して、URLを表示する

スクリプトが終わったあとに、**Cloudflare の画面でやるのが2つだけ**：

| # | どこで | 何を |
|---|---|---|
| A | Settings → Bindings → Add → **Workers AI** | 変数名 `AI`（これで「意味」でまとまる） |
| B | Google Cloud の「承認済みの JavaScript 生成元」 | 表示された公開URLを追加 |

> Windowsの人は「Git Bash」でおなじコマンドが使えるよ。

---

## 1. ファイルのならび

```
maru-iken/
├─ public/                    ← そのまま公開されるファイル
│  ├─ index.html              子ども用（意見と理由を送る）
│  └─ 先生/index.html          先生用（/先生/ で開く）
├─ functions/                 ← API（サーバーがわ）
│  ├─ _lib/auth.js            Google の IDトークン検証・セッションCookie
│  ├─ _lib/cluster.js         「同じ意見」をまとめる計算
│  └─ api/
│     ├─ session.js           POST /api/session    ログイン
│     ├─ me.js                GET  /api/me         いま誰か
│     ├─ logout.js            POST /api/logout     ログアウト
│     ├─ submission.js        GET/POST /api/submission  自分の意見
│     └─ board.js             GET  /api/board      先生用のまるデータ
├─ schema.sql                 データベースのもと
├─ wrangler.toml              Cloudflare の設定
├─ package.json
└─ .dev.vars.example          ローカル用の秘密の例
```

**データの形**：1つの Google アカウントにつき 1 件。もう一度送ると上書きされる（書きまちがえを直せる）。

---

## 2. つくる手順（上から順に）

### 2-1. 下じゅんび

Node.js を入れて、ターミナルで：

```bash
cd maru-iken
npm install
npx wrangler@latest login
```

### 2-2. データベース（D1）を作る

```bash
npx wrangler@latest d1 create maru-iken
```

出てきた `database_id = "xxxx-xxxx-..."` を `wrangler.toml` の
`database_id = "ここを database_id に書きかえる"` に貼りかえる。

つづけて表をつくる：

```bash
npx wrangler@latest d1 execute maru-iken --remote --file=./schema.sql
```

### 2-3. Google のログイン設定

1. https://console.cloud.google.com/ をひらく（自分の Google アカウントで）
2. 上の「プロジェクトを選択」→「新しいプロジェクト」→ 名前は `maru-iken`
3. 「APIとサービス」→「OAuth 同意画面」
   - User Type：**外部（External）**
   - アプリ名 `まる意見`／サポートメール＝自分のメール
   - スコープは**追加しない**（`openid` `email` `profile` だけでOK）
   - 「テストユーザー」に、使う人の Google メールを全員入れる
     （テストのままなら、入れた人しかログインできない。公開するなら「公開」にする）
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
   - 種類：**ウェブ アプリケーション**
   - 「承認済みの JavaScript 生成元」に**2つ**入れる
     - `http://localhost:8788`（ローカル確認用）
     - `https://maru-iken.pages.dev`（本番。実際のURLに合わせる）
   - 「リダイレクト URI」は**入れなくてよい**
5. 出てきた `xxxxxxxx.apps.googleusercontent.com` をコピー

コピーした値を**3か所**同じにする：

| 場所 | 何を書くか |
|---|---|
| `public/index.html` の `CONFIG.googleClientId` | クライアントID |
| `public/先生/index.html` の `CONFIG.googleClientId` | クライアントID |
| `wrangler.toml` の `GOOGLE_CLIENT_ID` | クライアントID |

### 2-4. 秘密のカギ（SESSION_SECRET）

ログイン状態を守るための合言葉。長ければ何でもいい。32文字くらいのランダムな英数字を用意する。

- ローカル：`.dev.vars.example` を `.dev.vars` にコピーして書く
- 本番：Cloudflare のダッシュボード → プロジェクト → **Settings** → **Variables and Secrets** → `SESSION_SECRET`（種類は **Secret**）

### 2-5. 公開する

```bash
npx wrangler@latest pages project create maru-iken
npx wrangler@latest pages deploy
```

これで `https://maru-iken.pages.dev` のような URL が出る。

公開後にもう一度、Cloudflare の **Settings → Variables and Secrets** に次を入れる（入れてから 1回 再デプロイ）：

| 名前 | 種類 | 中身 |
|---|---|---|
| `SESSION_SECRET` | Secret | 2-4 で用意した合言葉 |
| `GOOGLE_CLIENT_ID` | Text | クライアントID |
| `TEACHER_EMAILS` | Text | 先生のメール（カンマ区切り）。空なら**ログインした人なら誰でも先生画面を見られる** |

そして Google の「承認済みの JavaScript 生成元」に、出てきた本番URLを追加する（**これを忘れるとログインできない**）。

---

## 3. ローカルでためす

```bash
cp .dev.vars.example .dev.vars      # 中に SESSION_SECRET を書く
npx wrangler@latest d1 execute maru-iken --local --file=./schema.sql
npx wrangler@latest pages dev
```

`http://localhost:8788` が子ども用、`http://localhost:8788/先生/` が先生用。

---

## 4. GitHub に非公開でおく

```bash
# このフォルダはもう git の最初のコミットまで終わっている
git remote add origin https://github.com/<あなたのユーザー名>/maru-iken.git
git branch -M main
git push -u origin main
```

GitHub の画面で作る場合は「New repository」→ 名前 `maru-iken` → **Private** を選ぶ → 上のコマンドを実行。

`gh` コマンドが入っていれば 1 行でできる：

```bash
gh repo create maru-iken --private --source=. --remote=origin --push
```

> GitHub と Cloudflare Pages を「Git 連携」でつなぐ場合は、D1 の割り当てを
> Cloudflare の **Settings → Functions → D1 database bindings** にも追加する（Variable name は `DB`）。

---

## 5. あとで API（AI）で似た意見をまとめたいとき

いまは AI を使わず、日本語の2文字ずつの組み合わせで似ているかどうかを判定している（`functions/_lib/cluster.js`）。

AI に差しかえるときは、`functions/api/board.js` の

```js
const groups = clusterize(items);
```

を、たとえばこう変えるだけでよい（`medoidLabel` の代わりに、API が返した代表文を使う）：

```js
const groups = await clusterizeWithApi(items, env);  // env に APIキーを入れておく
```

`clusterize()` がやっていることは「入力を、同じ意味のまとまりに分ける」だけなので、
埋め込みベクトルでも LLM でも、**返す形（配列の配列）さえ合わせれば**入れかえられる。

---

## 6. 気をつけるところ

- **`compatibility_date` を未来の日付にしない。** Cloudflare の実行環境がまだ対応していない日付を書くと
  `newest date supported by this server binary is ...` というエラーで起動しなくなる（実際にここでハマった）。
  標準では `2026-09-01` にしてある。


- **`/先生` で 404 になったら `/先生/` を使う。** Cloudflare Pages はふつう自動で末尾に `/` をつけるが、環境によってはつかないことがある。
- `TEACHER_EMAILS` を空にすると、**Google でログインできる人なら誰でも**子ども全員の名前と理由を見られる。学校で使うなら必ず先生のメールを入れる。
- OAuth 同意画面を「テスト」のままにすると、テストユーザーに入れた人しかログインできない。
- 送信は**1人1件**。もう一度送ると上書き。クラスの人数を数えるときはこの前提で見る。
- 全部のデータを消したいときは：
  ```bash
  npx wrangler@latest d1 execute maru-iken --remote --command "DELETE FROM submissions;"
  ```

---

## 7. Cloudflare Workers AI で「意味」でまとめる（v1.1）

似た意見をまとめるのに、Cloudflare Workers AI の埋め込みモデルを使うようにした。

- モデル：`@cf/baai/bge-m3`（100言語以上対応。日本語もOK）
- やっていること：意見を「意味の数値（ベクトル）」にして、近さ（コサイン類似度）がしきい値以上なら同じまとまりにする
- しきい値：`SIMILARITY_THRESHOLD`（標準は `0.80`）。**大きいほどきびしく分かれる**
- 失敗したとき：`env.AI` が無い、または Workers AI がエラーになったら、自動で文字ベースのまとめ（`cluster.js`）にもどる。どちらでまとめたかは先生画面に出る

### 7-1. バインド（つなぎ込み）の設定

`wrangler.toml` に書いてある：

```toml
[ai]
binding = "AI"
```

> 公式ドキュメントには「**Pages Functions の Workers AI バインドはダッシュボードで設定する**」と書いてある。
> `wrangler.toml` の `[ai]` が効かないときは、Cloudflare の
> **Workers & Pages → プロジェクト → Settings → Bindings → Add → Workers AI** で
> 変数名 `AI` を追加して、**再デプロイ**する。
> 参考：https://developers.cloudflare.com/workers-ai/configuration/bindings/

### 7-2. データベースの更新

`opinion_vectors` テーブルを追加したので、もう一度 schema.sql を流す：

```bash
npx wrangler@latest d1 execute maru-iken --remote --file=./schema.sql
```

### 7-3. お金の話

- `@cf/baai/bge-m3` は **入力100万トークンあたり $0.0118**（公式の料金ページより）
- 意見1つは だいたい 20〜50 トークン。クラス30人ぶんでも 1,500 トークンくらい
- しかも**計算ずみのベクトルは D1 にためておく**ので、意見が変わった人ぶんしか計算しない
- 先生画面を何回リロードしても、AIが呼ばれるのは「新しい意見が来たとき」だけ

料金の最新はこちら：https://developers.cloudflare.com/workers-ai/platform/pricing/

### 7-4. 調整のしかた

まとまり方が思っていたのとちがうときは、`wrangler.toml` の `SIMILARITY_THRESHOLD` を変える：

| 値 | どうなる |
|---|---|
| `0.75` | まとめやすい（ちがう意見も同じ丸になりやすい） |
| `0.80` | 標準 |
| `0.85` | きびしい（同じ意味でも分かれやすい） |

変えたら**再デプロイ**する。`functions/_lib/ai.js` の `DEFAULT_THRESHOLD` も同じ意味の値。

---

## 8. GitHub に push したら 自動でデプロイ（おすすめ）

`.github/workflows/deploy.yml` を入れてある。これを GitHub に上げると、
**`main` に push するたびに 自動で Cloudflare にデプロイ**される。

### 8-1. 最初だけ手でやること

1. Cloudflare で APIトークンを作る
   - **Account API tokens → Create Token → Custom → Edit Cloudflare Workers** を選ぶ
   - 使うアカウントだけに絞る（余計な権限をつけない）
2. Cloudflare のアカウントIDを調べる（ダッシュボードのURLなどに出ている）
3. GitHub のリポジトリ → **Settings → Secrets and variables → Actions** に 2つ追加
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

> **トークンは GitHub の「秘密」に直接はる。** チャットにもコードにも書かない。
> GitHub のシークレットは**あとから中身を見ることができない**（上書きか削除だけ）。

### 8-2. そのあとは

```bash
git add -A && git commit -m "修正" && git push
```

これだけで自動デプロイが走る。Cloudflare の **Workers & Pages → プロジェクト → Deployments** で
進行が見られる。

### 8-3. もっとかんたんな方法：Git 連携

ワークフローを書かずに、Cloudflare の画面から
**Workers & Pages → プロジェクト → Settings → Builds → Git Repository → 接続**
でも同じことができる（push で自動デプロイ）。
参考：https://developers.cloudflare.com/pages/configuration/git-integration/

### 8-4. 気をつけるところ

- ワークフローは `wrangler pages deploy` を実行するだけ。**初回の D1 作成・バインド設定は手でやる必要がある**（2〜5章）。
- `wrangler.toml` の `database_id` が仮のまま（`ここを...`）だと、デプロイ時にエラーになる。
- Workers AI の `AI` バインドはダッシュボードで入れる（7-1章）。

### 8-5. zip で上げてしまった人へ

GitHub のブラウザ画面からのアップロードでは、`.github/` や `.gitignore` のような
**ドットで はじまるファイルを 上げられない**ことが多い。だから zip で上げた人がいる。

その場合は、`unzip-setup.yml` を **1回だけ** 走らせる：

1. GitHub → リポジトリ → **Actions**
2. 左の「**zipをリポジトリに展開（1回だけ）**」をえらぶ
3. **Run workflow** を おす

これで zip が展開されて、リポジトリ直下に `public/` `functions/` などが ならぶ
（`maru-iken.zip` は自動で消える）。そのあとは ふつうに push すれば `deploy.yml` がデプロイする。

> `deploy.yml` は **zip が あっても 無くても 動く**ように作ってある。
> zip を消さずに置いたままでも、自動で展開してからデプロイする。

### 8-6. zip をやめて ふつうに上げるコツ

- **フォルダごと ドラッグ&ドロップ**すると、中のフォルダも いっしょに上がる
- ただし **macOSのFinder は「.」で はじまるファイルを かくす**ので、`.github` は 見えない。
  → そのときは **GitHub Desktop** か、コマンドの `git` を つかうのが いちばん かんたん
- `node_modules/` を 上げないこと。`.gitignore` に 入れてある（**何千ものファイル**になるので、これが容量の問題の ほんとうの正体になりやすい）

### 8-7. Cloudflare トークンを「まる意見だけ」に絞る

GitHub Actions からデプロイするときだけ、トークンが要る。
作り方は公式ドキュメント（Pages の CI/CD 手順）どおり：

**Account API tokens → Create Token → Custom Token → Get started**

| 項目 | 入れるもの |
|---|---|
| Permissions | **Account** / **Cloudflare Pages** / **Edit** ← これ1つでよい |
| Account Resources | 使うアカウントだけ Include |
| TTL | 90日など短めにする（期限が来たら作り直す） |
| Client IP Address Filtering | **入れない**（下の注意を見て） |

出典：https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/

#### このアプリの作業ごとに、何の権限が要るか

| やりたいこと | 権限 | まる意見で必要？ |
|---|---|---|
| 静的ファイルと Functions の配信 | アカウント / Cloudflare Pages / 編集 | **必要（これだけ）** |
| D1 の作成・表づくり | アカウント / D1 / 編集 | ふつうは `wrangler login` で手動。CI でもやるなら追加 |
| Workers AI（意見を「意味」でまとめる） | **権限は不要** | バインドで動く。トークンに足さない |
| カスタムドメインを当てる | ゾーン / DNS / 編集 | 自分のドメインを使うときだけ |

#### 正直なところ：プロジェクト単位では絞れない

Pages の権限は**アカウント単位**。トークン作成画面に「このプロジェクトだけ」を選ぶ項目は
見つからなかった（＝無い可能性が高いが、断定はしない）。

だから、いちばん近い「絞った」状態はこの4つ：

1. **まる意見専用のトークンを新しく作る**（BlueTalk 用と共有しない）
2. **権限は Pages Edit の1つだけ**にする
3. **TTL を短く**して、期限が来たら作り直す
4. **GitHub の Secrets にだけ置く**（チャットにもコードにも書かない）

本当に1アプリだけに閉じたいなら、**Cloudflare のアカウントを分ける**のが唯一の確実な方法。

#### 注意

- **`Client IP Address Filtering` は GitHub Actions では使えない。**
  Actions のランナーは IP が毎回変わるので、入れると**デプロイが必ず失敗する**。
- **既存の BlueTalk 用トークンを流用しない。** 権限が広いまま全プロジェクトを触れる状態が続く。
- 作ったトークンは `CLOUDFLARE_API_TOKEN`、アカウントID は `CLOUDFLARE_ACCOUNT_ID` として
  GitHub の **Settings → Secrets and variables → Actions** に入れる。
- トークンが生きているかはこれで確認できる（公式の例）:

  ```bash
  curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \
    --header "Authorization: Bearer <API_TOKEN>"
  ```

### 8-8. BlueTalk と 同じ方法で デプロイする

BlueTalk（`bluechat-sync`）の `.github/workflows/deploy-worker.yml` を読んで、
**同じ考え方**をまる意見に移植した。実際に読んだ中身はこちら：

| BlueTalk が やっていたこと | まる意見で どうしたか |
|---|---|
| `on: push (main)` + `workflow_dispatch` | 同じ |
| `concurrency` で同時実行をしぼる | 同じ（group: `maru-iken-deploy`） |
| `permissions: contents: read` | 同じ |
| `actions/checkout@v4` | 同じ |
| `actions/setup-node@v4` / node 22 | 同じ |
| **KV を API で自動作成 → `sed` で wrangler.toml に埋める** | **D1 を自動作成 → `sed` で `database_id` を埋める**（同じ発想） |
| `npx wrangler deploy` | `npx wrangler pages deploy public`（まる意見は Pages アプリのため） |
| Secrets は `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | 同じ名前 |

#### ちがうところ（わざと変えた）

| 項目 | BlueTalk | まる意見 | なぜ |
|---|---|---|---|
| デプロイ先 | Workers（`workers_dev`） | **Pages** | まる意見は `functions/` + `public/` の Pages 構成で作ってあるため |
| リソース作成 | KV を `curl` + `jq` で | **D1 を wrangler コマンドで** | `curl` のエンドポイントを推測せず、検証ずみのコマンドを使うため |
| バージョン | `wrangler@3.114.14` に固定 | **`wrangler@4.136.2` に固定** | サンドボックスで実際にコンパイルが通った版 |
| `npm ci` | あり（依存がある） | **なし** | まる意見は依存ゼロ。`npx` で直接 wrangler を呼ぶ |

#### トークンに必要な権限

| ステップ | 必要な権限 |
|---|---|
| D1 を自動作成・schema 適用 | アカウント / **D1 / 編集** |
| Pages プロジェクト作成・デプロイ | アカウント / **Cloudflare Pages / 編集** |

> 「Pages / 編集」だけにしたいときは、**D1 を先に手で作って `database_id` を入れておく**。
> そうすれば D1 の自動作成ステップは自動でスキップされる（`database_id` を見て判断している）。

#### トークンを最小にする手順（BlueTalkと同じ考え方）

1. BlueTalk 用のトークンは**流用しない**（用途ごとに分ける）
2. `maru-iken-deploy` という名前で新しく作る
3. Pages 編集（＋必要なら D1 編集）だけにする
4. GitHub の Secrets にだけ置く

### 8-9. `.github` フォルダが 見えないとき

`Command + Shift + .`（ピリオド）をFinderで押すと 出てくる。
macOSは「`.`で始まるフォルダ」を隠すため。

**ただし、ブラウザのアップロードでは ドットフォルダは 上げられない。**
上げ方は `UP-GITHUB.md` に3つ書いてある（GitHub Desktop / push-github.sh / 画面で作る）。
