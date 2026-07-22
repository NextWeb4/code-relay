<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/English-0969da?style=flat-square" alt="English"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-c8102e?style=flat-square" alt="简体中文"></a>
  <a href="README.ja.md"><img src="https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-8250df?style=flat-square" alt="日本語"></a>
</p>

# Code Relay

安全制約付きのメール取得ポーリングと、所有する GitHub アカウント向けの手動操作を提供する、ローカル認証コードコンソールです。

![最終コミット](https://img.shields.io/github/last-commit/NextWeb4/code-relay?style=flat-square)
![リポジトリサイズ](https://img.shields.io/github/repo-size/NextWeb4/code-relay?style=flat-square)
![GitHub スター](https://img.shields.io/github/stars/NextWeb4/code-relay?style=flat-square)
![Node.js 20 以降](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![MIT ライセンス](https://img.shields.io/github/license/NextWeb4/code-relay?style=flat-square)

![Code Relay メールボックスダッシュボード](docs/demo/code-relay-dashboard.png)

![Code Relay 所有 GitHub アカウントパネル](docs/demo/code-relay-github.png)

## 概要

Code Relay は `127.0.0.1:4173` でローカルサービスを起動します。貼り付けた購入テキスト、TXT、CSV からメールボックスと取得 URL の組を取り込み、対応する HTTP/HTTPS ソースをポーリングして認証コード候補を抽出し、Server-Sent Events でブラウザをリアルタイム更新します。

- 同一行の `mailbox----url` と対応する分割行形式からメールボックスと取得 URL を関連付け、重複を除去します。
- 繰り返し取得できるソースと、保護された 1 回限りのソースを扱います。
- プレーンテキスト、HTML、JSON 風のペイロード、`iframe[srcdoc]` のメール本文からコードを抽出します。
- 日付、タイムゾーンオフセット、メールアドレスのローカル部、無関係なボタン文言などの誤検出を抑制します。
- メールボックス状態、取得 URL、メッセージ、コードはローカルの実行時ストレージだけに保存します。
- 中国語/英語 UI を切り替え、設定を `localStorage` に保存します。
- 所有する GitHub アカウントを OAuth Device Flow で接続し、トークンを OS の資格情報保管庫に保存します。
- GitHub 操作は確認済みの単一対象 `star`、`watch`、`fork`、`follow` に限定されます。

GitHub アカウントの登録、認証コードの自動送信、CAPTCHA やリスク制御の回避、一括または定期 GitHub 操作は行いません。

## 必要環境

- Node.js 20 以降
- npm（`package-lock.json` を同梱）
- `v1.0.0` の EXE とポータブル ZIP は Windows 向け
- オプションの GitHub 機能を使う場合のみ GitHub OAuth Client ID が必要です。UI で入力するか `GITHUB_OAUTH_CLIENT_ID` を設定できます。メール取得機能には不要です。

## インストールと実行

```powershell
npm install
npm start
```

<http://127.0.0.1:4173> を開きます。Windows では `启动软件.cmd` を実行すると、サービスの起動後にブラウザが開きます。

`.env.example` は任意の環境値を説明していますが、アプリは `.env` を自動読込しません。必要な値は起動前に現在のシェルへ設定してください。

インポート例：

```text
name@example.com----https://mail.example.com/api?token=YOUR_TOKEN

Click to fetch mailbox: https://mail.example.com/
qq mailbox:
1234567890@qq.com
```

同じ行にあるメールボックスと URL は必ずその行内で対応付けます。メールボックス行に URL がない場合だけ行をまたいで探索し、隣のレコードの URL を奪わないようにします。

## 実行時の設定

- `PORT` でローカルの待受ポートを変更できます。通常のサービスは引き続きループバックインターフェイスだけにバインドします。
- `DATA_FILE` で JSON 状態ファイルの保存先を変更できます。このファイルにはメールアドレス、取得 URL、メッセージ、抽出した認証コードが入るため、適切に保護してください。
- `GITHUB_OAUTH_CLIENT_ID` で任意の OAuth アプリ識別子を渡せるため、UI から保存する必要はありません。
- `CODE_RELAY_OPEN_BROWSER` で、起動時にローカルページを自動表示するかどうかを制御します。

これらの変数は起動前に現在のプロセス環境へ設定します。`.env.example` に一覧がありますが、Code Relay は dotenv ローダーを組み込んでいません。

## 日常のワークフロー

1. サービスを起動し、ローカルダッシュボードを開きます。
2. **Batch Import** から購入テキストを貼り付けるか、対応する TXT/CSV ファイルを読み込み、追加、更新、重複、拒否の件数を確認します。
3. メールボックスカードを検索または絞り込み、各取得元が繰り返し型か 1 回限りかを確認します。1 回限りの取得元は必ず手動で取得してください。
4. 個別更新、全件更新、または対象となる繰り返し型の取得元だけの自動ポーリングを使用します。ローカル状態が変わると Server-Sent Events で画面が更新されます。
5. コードをコピーする前にメールボックスとメッセージの文脈を確認します。ローカルデータが不要になったメールボックスは削除します。
6. 任意の GitHub 機能では、関連付けるメールボックスを選び、Device Flow で所有アカウントを認証し、1 つの対象に対する 1 回の操作を明示的に確認します。接続を解除すると資格情報保管庫のトークンも削除されます。

## テスト

```powershell
npm test
```

Node 組み込みのテストランナーを使用し、インポートの対応付け、メールボックス分離、コード抽出、取得元の解析、ポーリング、保存、HTTP ルート、GitHub リクエストの保護、資格情報のマスキング、一括更新、古い誤コードの除去を検証します。テストから実サービスや GitHub API を呼び出してはいけません。

現在、lint/format コマンドは定義されていません。

## Windows リリースの作成

```powershell
npm run package
npm run sha256
```

フロントエンドのコンパイル工程はありません。Windows x64 EXE は `@yao-pkg/pkg`、バージョンリソースは `resedit`、ポータブル ZIP はパッケージスクリプトから PowerShell `Compress-Archive` を使用します。

`release-assets/` に生成されるファイル：

| ファイル | 用途 |
| --- | --- |
| `code-relay-v1.0.0-win-x64.exe` | Windows x64 実行ファイル |
| `code-relay-v1.0.0-windows-portable.zip` | EXE、README、LICENSE、`.env.example`、検証済みデモ画像を含むポータブルパッケージ |
| `SHA256SUMS.txt` | リリースファイルの SHA256 |

インストーラープロジェクトがないローカル Node Web アプリのため、MSI は作成しません。公開手順は `PUBLISHING.md` にあります。API スクリプトは `main` と `v1.0.0` を `NextWeb4/code-relay` に push し、`GITHUB_TOKEN` または `GH_TOKEN` を実行時だけ読み込み、Git 設定には保存しません。

## プロジェクト構成

| パス | 役割 |
| --- | --- |
| `src/server.js` | ローカル HTTP/API/SSE サーバーと終了処理 |
| `src/parser.js` | 副作用のないメールボックス/URL インポート解析 |
| `src/code-extractor.js` | 認証コードとメッセージの抽出 |
| `src/providers/` | 安全制約付きの取得プロトコルとレスポンス解析 |
| `src/network-guard.js` | 外部取得 URL/ネットワーク制約 |
| `src/poller.js` | ポーリング、同時実行、1 回限りの取得元の管理 |
| `src/store.js` | ローカル JSON 永続化 |
| `src/github/` | Device Flow、資格情報保管庫、GitHub REST クライアント、単一アカウントの処理 |
| `public/` | 素の HTML/CSS/JavaScript UI。外部取得はローカル `/api` を経由します |
| `tests/` | Node 組み込みテスト |
| `scripts/` | Windows パッケージ、メタデータ、チェックサム、UI 検証、リリース公開 |

## データとセキュリティ

- ソース実行時は `data/mailboxes.json`、パッケージ版はユーザーのローカルアプリデータ領域に状態を保存します。
- `data/*.json`、`.env`、資格情報、ログ、ビルド成果物、キャッシュは Git 対象外です。
- OAuth トークンは `@napi-rs/keyring` だけで保存します。OS の資格情報保管庫が使えない場合に平文ファイルへフォールバックしてはいけません。
- 取得リクエストは危険な宛先とリダイレクトを拒否し、タイムアウトと 2 MB のレスポンス上限を設け、表示 URL のトークンらしいクエリ値をマスクします。
- ポーリングの既定値と保護機構で無制限な並列処理を防ぎます。間隔を 5 秒未満にしないでください。
- GitHub 書き込みは直列化し、単一対象と明示確認を要求し、操作間を 1 秒以上空けます。プライマリ/セカンダリのレート制限または `Retry-After` を受けたら停止して待機します。
- 完全なメールアドレス、取得 URL、コード、メール本文は機密のローカルデータです。ログ、スクリーンショット、テストスナップショット、コミットに含めないでください。

## 保守とコントリビューション

- パーサー、取得元、ポーリング、保存、GitHub、ブラウザの境界を変更する前に[アーキテクチャガイド](docs/architecture.md)を確認し、対応する `tests/*.test.js` に焦点を絞ったテストを追加してください。
- ブラウザ側の変更では、ビルド不要のネイティブフロントエンドと中国語・英語のアプリ文言を同期したまま保ちます。文書変更では 3 言語の README を揃えてください。
- リリース作業は[リリース監査](docs/release-audit.md)と[公開ガイド](PUBLISHING.md)に従い、EXE、ポータブルアーカイブ、デモ画像、チェックサムを確認します。生成物はコミットしません。
- メール取得と GitHub 操作は手動かつ単一目的のままにし、レート制限を考慮して、上記の安全境界内で実行してください。

## 作者

- HaoXiang Huang
- [Rays688888@Gmail.com](mailto:Rays688888@Gmail.com)
- <https://nextweb4.github.io/>
- <https://github.com/NextWeb4>

## ライセンス

[MIT](LICENSE) © 2026 HaoXiang Huang。


