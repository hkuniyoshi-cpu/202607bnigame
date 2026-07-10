# 15th BNI GAME (BNI TOP チャプター 2026-07) 設計書

**作成日**: 2026-07-10
**期間**: 2026-07-13（月）〜 2026-08-12（水）※当初 8/11 → **8/12まで延長**
**リポジトリ**: `hkuniyoshi-cpu/202607bnigame`
**スプレッドシートID**: `1SlI0kHR637Ytv6PVfONU9w9og4lKetZn7GtDZIa3OrE`

## 1. 目的

TOPチャプター内でBNI活動をゲーム化し、チーム単位で競うことで参加意欲・活動量を高める。

## 2. 全体アーキテクチャ

```
GitHub Pages（静的HTML）
├── /                進捗ページ（メンバー向け・公開）
└── /input/          入力ページ（チームリーダー向け・トークン制限）

         ↕ fetch (JSON API)

Google Apps Script Web App
└── Google スプレッドシート（マスターDB）
```

- 進捗と入力を**別階層**に配置（同一リポジトリで管理）
- GAS は clasp でローカル管理（コピペ運用しない）
- スプレッドシートは開発者所有、運営には閲覧共有

## 3. ゲームルール（確定版）

### 3.1 期間・チーム編成
- 期間: 2026-07-13（月）〜 2026-08-12（水）
- 17チーム・約82名（4名チームが3つ、5名チームが14）
- チーム名: 6文字以内・記号NG
- 週次締切: 毎週日曜 23:59

### 3.2 点数配分

**プラス**
| 項目 | 点数 |
|------|------|
| キースキルズトレーニング（メインプレゼン/WP/リファーラル/1to1） | +1P |
| マインドセットトレーニング | +1P |
| MSアドオン受講 | +2P |
| パワーチームワークショップ 前半 | +5P |
| パワーチームワークショップ 後半 | +10P |
| 1to1（30分以上・沖縄リージョン内） | +1P |
| ビジター招待 | +3P |
| 推薦の言葉（**チーム上限3つ/週**） | +2P |

**マイナス**
| 項目 | 点数 |
|------|------|
| 欠席 | -10P |
| 遅刻・早退 | -5P |

### 3.3 スコア計算
- チームスコアはメンバー個人点数の**平均値**（4名/5名チームの公平化）
- 途中退場者は**その週の人数から除外**して平均計算
- 「推薦の言葉」はチーム週上限3件（超過分は加点しない）

## 4. ページ設計

### 4.1 進捗ページ `/`
- ヘッダー: LIVE表示、残り日数、進捗バー
- メインチャート: 週次（日曜締め）ポイントでの累積平均スコア推移
  - X軸: 7/13, 7/19, 7/26, 8/2, 8/9
  - Y軸: 累積平均スコア
  - TOP5強調表示 ↔ 全チーム表示 切り替え
  - チームビュー ↔ 個人ビュー 切り替え
  - 左から右への「ぎゅーん」アニメーション
- サイドバー: ランキング（1〜3位はメダル）
- ルールブック: 点数配分表

### 4.2 入力ページ `/input/?team=<TOKEN>`
- チームトークンで自チームのみアクセス可（他チーム不可視）
- メンバー選択 → 活動種別 → 件数 → 保存
- 過去入力の一覧・削除
- 今週の暫定スコア表示

## 5. データモデル（スプレッドシート）

### `teams` シート
| 列 | 型 | 例 |
|----|-----|---|
| team_id | string | `t01` |
| name | string | `チーム1` |
| token | string | `a3f9k7...` |
| leader_email | string | (任意) |

### `members` シート
| 列 | 型 | 例 |
|----|-----|---|
| member_id | string | `m001` |
| name | string | `西平 泰士` |
| team_id | string | `t01` |
| withdrew_week | number | (途中退場した週番号、なければ空) |

### `scores` シート（入力ログ）
| 列 | 型 | 例 |
|----|-----|---|
| id | string | `uuid` |
| timestamp | ISO | `2026-07-15T14:23:11Z` |
| team_id | string | `t01` |
| member_id | string | `m001` |
| activity | enum | `key_skills` / `mindset` / `ms_addon` / `pt_ws_first` / `pt_ws_second` / `one_to_one` / `visitor` / `testimonial` / `absent` / `late` |
| count | number | 1 |
| points | number | 3（活動種別×件数から算出） |
| week | number | 1〜4 |

### `settings` シート
- ゲーム期間、週次締切、活動別点数、テスティモニアル上限

## 6. GAS API

`doGet(e)` — クエリパラメータで分岐

| endpoint | パラメータ | 認証 | 返却 |
|----------|------------|------|------|
| `?action=progress` | なし | 公開 | 全チームの週次スコア推移 |
| `?action=team&token=X` | token | トークン一致 | 自チームメンバー・入力履歴・暫定スコア |
| `?action=activities` | なし | 公開 | 活動一覧・点数定義 |

`doPost(e)` — JSON POST

| body | 認証 | 動作 |
|------|------|------|
| `{action:'submit', token, member_id, activity, count}` | トークン一致 | スコアを追加 |
| `{action:'delete', token, score_id}` | トークン一致 | スコアを削除（誤入力訂正） |

## 7. スコア計算ロジック（`src/logic.js` に純粋関数として実装）

```js
computeMemberWeeklyScore(scoresForMember, weekNumber, activityPoints)
computeTeamWeeklyAverage(memberScores, activeMemberIdsInWeek)
computeCumulativeAverage(weeklyAverages)
applyTestimonialCap(teamScoresForWeek, cap=3)
```

- 純粋関数として実装 → `node --test` で検証
- GAS側からは同じロジックを呼び出す（末尾に `module.exports` の CommonJS ガード）

## 8. セキュリティ

- 進捗ページは完全公開（読み取りのみ）
- 入力ページはURLトークン制（各チーム別トークン、6〜10文字ランダム）
- GAS Web App は「アクセス: 全員」だが、書き込みは POST 時のトークン検証で守る
- スプレッドシートは開発者所有、運営には**閲覧のみ**を共有

## 9. 非目標 (Non-goals)

- ログイン認証（Google認証などは使わない）
- リアルタイムWebSocket（fetchポーリングで十分）
- モバイルアプリ化（レスポンシブなWebで対応）
- ゲーム後の履歴管理（4週間限定使い切り）

## 10. デプロイ

- GitHub Pages（`main` ブランチのルート）
- GAS: `clasp push` → `clasp deploy` で新バージョン発行

## 11. 未確定・後で決めること

- チームトークンをリーダーに配布する具体的な方法（メール？直接手渡し？）
- 表彰・賞金の詳細（進捗ページには載せない）
- ゲーム終了後のデータ保存方針（スプレッドシートに残せば十分）
