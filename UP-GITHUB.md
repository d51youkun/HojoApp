# GitHubに上げる方法（3つ）

> **先に結論。** `.github` フォルダは**存在する**。macOSのFinderが
> 「`.`で始まるフォルダ」を**隠している**だけ。
>
> でも、それを見えるようにしても、**ブラウザのアップロードでは
> ドットフォルダを上げられない。** だから下の3つのどれかを使う。

---

## まず: 隠れているフォルダを見る（macOS）

Finderで、解凍した `maru-iken` フォルダを開いて:

```
Command + Shift + .（ピリオド）
```

を押す。**`.github` と `.gitignore` が出てくる。** もう一回押すと また隠れる。

---

## 3つの方法をくらべる

| 方法 | 何が要る | ドットフォルダ | 手間 | おすすめ |
|---|---|---|---|---|
| **A. GitHub Desktop** | アプリを入れる（1回） | **上げられる** | 最小・ぜんぶ画面 | **◎** |
| **B. `push-github.sh`** | `gh` を入れる（1回） | **上げられる** | コマンド1回 | **○** |
| **C. GitHubの画面で作る** | 何も要らない | 作れる | 3ファイルぶんコピペ | △ |

> **なぜブラウザのアップロードはだめか。** 「Add file → Upload files」で
> フォルダをドラッグしても、**`.`で始まるフォルダは とばされる**。
> これはGitHubの画面の仕様。

---

## A. GitHub Desktop（おすすめ）

1. https://desktop.github.com/ から アプリを入れる
2. アプリを開いて、自分のアカウントでログイン
3. 上のメニュー → **File → Add local repository**
4. 解凍した **`maru-iken` フォルダ**をえらぶ
5. 「**not a Git repository**（Gitのフォルダじゃないよ）」と出たら
   →「**create a repository**」を押す
6. 左下の「**Publish repository**」を押す
   - ⚠️ **「Keep this code private」のチェックは そのまま（外さない）**
     → 非公開になる
7. 「Publish」をおす

これで、**`.github` も `.gitignore` も、全部上がる。**

---

## B. `push-github.sh` をつかう

解凍したフォルダで、ターミナルを開いて:

```bash
bash push-github.sh
```

`gh` コマンドが要る（入っていなければ `brew install gh`）。
ブラウザでログインするだけで、**トークンは つかわない。**
このスクリプトが **非公開リポジトリを作って push まで**やる。

---

## C. GitHubの画面で作る（何も入れたくない人）

公式ドキュメントにも書いてあるやり方。

> "If your repository doesn't have a .github/workflows directory,
> go to the main page of the repository on GitHub, click Add file,
> then click Create new file, and ..."
> — https://docs.github.com/en/actions/get-started/quickstart

### 手順

1. GitHubのリポジトリの画面で **Add file → Create new file**
2. ファイル名のところに、**パスごと 打ち込む**:

   ```
   .github/workflows/deploy.yml
   ```

   → スラッシュを打つと、**自動でフォルダができる。**
3. 解凍したフォルダで（`Command + Shift + .` で `.github` を出して）
   `deploy.yml` を**テキストエディタで開いて、中身を全部コピー**して貼る
4. **Commit changes**
5. 同じことを くりかえす:

   ```
   .github/workflows/unzip-setup.yml
   .github/workflows/secret-guard.yml
   ```

   （`secret-guard.yml` は無くてもデプロイできる。あると安全）

> **テキストエディタが開けないとき**は、Finderで `deploy.yml` を右クリック
> →「このアプリケーションで開く」→「テキストエディット」。

---

## 上げたあと

1. GitHub → **Settings → Secrets and variables → Actions** に 2つ入れる
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   ⚠️ **値は 画面で入力する。チャットにも コードにも 書かない。**
2. **zipで上げた人だけ**: Actions →「zipをリポジトリに展開（1回だけ）」→ Run workflow
3. あとは **push するだけで 自動デプロイ**

---

## どの方法でも つまずいたら

**エラーを そのままコピーして 貼って。** そこから直す。
