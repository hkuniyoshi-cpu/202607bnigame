# BNI TOP チャプター ゲーム 2026-07

期間: 2026年7月13日（月）〜 8月12日（水）

## 構成

- **進捗ページ**（公開）: `https://202607bnigame.search-mania.net/`
- **入力ページ**（チームリーダー専用）: `https://202607bnigame.search-mania.net/input/?team=<TOKEN>`
- **バックエンド**: Google Apps Script Web App（clasp管理）
- **DB**: Google スプレッドシート（ID: `1SlI0kHR637Ytv6PVfONU9w9og4lKetZn7GtDZIa3OrE`）
- **ホスティング**: Cloudflare Pages（GitHub連動デプロイ）

## ディレクトリ

```
/                      進捗ページ（Cloudflare Pages）
/input/                入力ページ（チームトークン認証）
/privacy/              プライバシーポリシー
/guidelines/           利用ガイドライン
/assets/               共有 CSS/JS
/gas/                  Apps Script プロジェクト（clasp）
/src/                  スコア計算の純粋ロジック（Nodeテスト対象）
/tests/                node --test 用のテスト
/docs/specs/           設計書
```

## セットアップ（開発者用）

1. `npm i -g @google/clasp`
2. `clasp login`
3. `cd gas && clasp clone <スクリプトID>`
4. GASでスプレッドシートを紐付け、`setupSheets()` を初回実行
5. `clasp push` でコードを同期、`clasp deploy` で Web アプリとして公開
6. 発行された Web アプリの URL を `/assets/config.js` の `GAS_API_URL` に設定

詳細は [docs/specs/2026-07-10-bni-game-design.md](docs/specs/2026-07-10-bni-game-design.md) 参照。

## Credits

Developed by [SearchMania Inc.](https://search-mania.net) for BNI TOP Chapter.
