[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

# Code Relay

安全制約付きのメール取得ポーリングと、所有する GitHub アカウント向けの手動操作を提供する、ローカル認証コードコンソールです。

![最終コミット](https://img.shields.io/github/last-commit/NextWeb4/code-relay?style=flat-square)
![リポジトリサイズ](https://img.shields.io/github/repo-size/NextWeb4/code-relay?style=flat-square)
![GitHub Stars](https://img.shields.io/github/stars/NextWeb4/code-relay?style=flat-square)
![Node.js 20 以降](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![MIT ライセンス](https://img.shields.io/github/license/NextWeb4/code-relay?style=flat-square)

![Code Relay メールボックスダッシュボード](docs/demo/code-relay-dashboard.png)

![Code Relay 所有 GitHub アカウントパネル](docs/demo/code-relay-github.png)

## 概要

Code Relay は `127.0.0.1:4173` でローカルサービスを起動します。貼り付けた購入テキスト、TXT、CSV からメールボックスと取得 URL の組を取り込み、対応する HTTP/HTTPS ソースをポーリングして認証コード候補を抽出し、Server-Sent Events でブラウザをリアルタイム更新します。

- 同一行の `mailbox----url` と対応する分割行形式からメールボックスと取得 URL を関連付け、重複を除去します。
- 繰り返し取得できるソースと、保護された one-shot ソースを扱います。
- プレーンテキスト、HTML、JSON 風 payload、`iframe[srcdoc]` のメール本文からコードを抽出します。
- 日付、タイムゾーンオフセット、メールの local part、無関係なボタン文言などの誤検出を抑制します。
- メールボックス状態、取得 URL、メッセージ、コードはローカルの実行時ストレージだけに保存します。
- 中国語/英語 UI を切り替え、設定を `localStorage` に保存します。
- 所有する GitHub アカウントを OAuth Device Flow で接続し、token を OS の credential vault に保存します。
- GitHub 操作は確認済みの単一対象 `star`、`watch`、`fork`、`follow` に限定されます。

GitHub アカウントの登録、認証コードの自動送信、CAPTCHA やリスク制御の回避、一括または定期 GitHub 操作は行いません。

## 必要環境

- Node.js 20 以降
- npm（`package-lock.json` を同梱）
- `v1.0.0` の EXE と portable ZIP は Windows 向け
- オプションの GitHub 機能を使う場合のみ GitHub OAuth Client ID が必要です。UI で入力するか `GITHUB_OAUTH_CLIENT_ID` を設定できます。メール取得機能には不要です。

## インストールと実行

```powershell
npm install
npm start
```

<http://127.0.0.1:4173> を開きます。Windows では `启动软件.cmd` を実行すると、サービスの起動後にブラウザが開きます。

`.env.example` は任意の環境値を説明していますが、アプリは `.env` を自動読込しません。必要な値は起動前に現在の shell に設定してください。

インポート例：

```text
name@example.com----https://mail.example.com/api?token=YOUR_TOKEN

Click to fetch mailbox: https://mail.example.com/
qq mailbox:
1234567890@qq.com
```

同じ行にあるメールボックスと URL は必ずその行内で対応付けます。メールボックス行に URL がない場合だけ行をまたいで探索し、隣のレコードの URL を奪わないようにします。

## テスト

```powershell
npm test
```

Node 組み込みの test runner を使用し、インポートの対応付け、メールボックス分離、コード抽出、Provider 解析、ポーリング、保存、HTTP route、GitHub request guard、credential のマスキング、一括更新、古い誤コードの除去を検証します。テストから実サービスや GitHub API を呼び出してはいけません。

現在、lint/format コマンドは定義されていません。

## Windows リリースの作成

```powershell
npm run package
npm run sha256
```

フロントエンドのコンパイル工程はありません。Windows x64 EXE は `@yao-pkg/pkg`、version resource は `resedit`、portable ZIP はパッケージスクリプトから PowerShell `Compress-Archive` を使用します。

`release-assets/` に生成されるファイル：

| ファイル | 用途 |
| --- | --- |
| `code-relay-v1.0.0-win-x64.exe` | Windows x64 実行ファイル |
| `code-relay-v1.0.0-windows-portable.zip` | EXE、README、LICENSE、`.env.example`、検証済みデモ画像を含む portable パッケージ |
| `SHA256SUMS.txt` | リリースファイルの SHA256 |

インストーラープロジェクトがないローカル Node Web アプリのため、MSI は作成しません。公開手順は `PUBLISHING.md` にあります。API スクリプトは `main` と `v1.0.0` を `NextWeb4/code-relay` に push し、`GITHUB_TOKEN` または `GH_TOKEN` を実行時だけ読み込み、Git 設定には保存しません。

## プロジェクト構成

| パス | 役割 |
| --- | --- |
| `src/server.js` | ローカル HTTP/API/SSE サーバーと終了処理 |
| `src/parser.js` | 副作用のないメールボックス/URL インポート解析 |
| `src/code-extractor.js` | 認証コードとメッセージの抽出 |
| `src/providers/` | 保護された取得プロトコルとレスポンス解析 |
| `src/network-guard.js` | 外部取得 URL/ネットワーク制約 |
| `src/poller.js` | ポーリング、同時実行、one-shot 管理 |
| `src/store.js` | ローカル JSON 永続化 |
| `src/github/` | Device Flow、credential vault、GitHub REST client、単一アカウントの処理 |
| `public/` | 素の HTML/CSS/JavaScript UI。外部取得はローカル `/api` を経由します |
| `tests/` | Node 組み込みテスト |
| `scripts/` | Windows package、metadata、checksum、UI 検証、release 公開 |

## データとセキュリティ

- ソース実行時は `data/mailboxes.json`、パッケージ版はユーザーのローカルアプリデータ領域に状態を保存します。
- `data/*.json`、`.env`、credential、ログ、ビルド成果物、cache は Git 対象外です。
- OAuth token は `@napi-rs/keyring` だけで保存します。OS vault が使えない場合に平文ファイルへフォールバックしてはいけません。
- 取得リクエストは危険な宛先と redirect を拒否し、timeout と 2 MB のレスポンス上限を設け、表示 URL の token らしい query 値をマスクします。
- ポーリングの既定値と guard で無制限な並列処理を防ぎます。間隔を 5 秒未満にしないでください。
- GitHub 書き込みは直列化し、単一対象と明示確認を要求し、操作間を 1 秒以上空けます。primary/secondary rate limit または `Retry-After` を受けたら停止して待機します。
- 完全なメールアドレス、取得 URL、コード、メール本文は機密のローカルデータです。ログ、スクリーンショット、テスト snapshot、commit に含めないでください。

## 作者

- HaoXiang Huang
- [didadida1688@gmail.com](mailto:didadida1688@gmail.com)
- <https://nextweb4.github.io/>
- <https://github.com/NextWeb4>

## ライセンス

[MIT](LICENSE) © 2026 HaoXiang Huang。
