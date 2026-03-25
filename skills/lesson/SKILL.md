---
name: lesson
version: "1.0.0"
description: "Record development lessons with tags. Works in Claude Code and Cowork. Triggers on: /lesson, record lesson, 教訓を記録"
author: aliksir
tags: [lessons, recording, feedback-loop, cowork]
---

# lesson — 教訓を記録する

開発中に得た教訓をタグ付きで記録する。skill-loopと連携し、教訓⇔スキルのフィードバックループを回す。

## 対応環境

Claude Code と Claude Cowork の両方で動作する。Bashは不要（Read/Write/Globのみ使用）。

## サブコマンド判定

引数 `$ARGUMENTS` からサブコマンドを判定する:

| パターン | サブコマンド |
|---------|------------|
| `list` | **list** — 記録済みの教訓を一覧表示 |
| `tags` | **tags** — タグの出現回数を集計 |
| `search キーワード` | **search** — キーワードで教訓を検索 |
| それ以外のテキスト | **add** — 教訓として記録 |

## 教訓ファイルの場所

以下の優先順で教訓ファイルを探す:

1. プロジェクトルートの `lessons/dev-lessons.md`
2. プロジェクトルートの `lessons/` 内の任意の `.md` ファイル（listやtagsで全件対象）

addコマンドの書き込み先は常に `lessons/dev-lessons.md`。ファイルやディレクトリが存在しない場合は新規作成する。

---

## add（デフォルト）

引数のテキストを教訓として記録する。

### 引数の解析ルール

引数からタグとタイトルを分離する:

- `[tag]` 形式（角括弧で囲まれた英数字・ハイフン・アンダースコア）をタグとして抽出
- 残りのテキストをタイトルとして使用
- タグが1つもない場合はユーザーに確認:「タグなしで記録しますか？タグがあると後でskill-loopで分析できます」

### 入力例と解析結果

```
/lesson [api] [auth] Rate limitのヘッダーを見忘れて429
→ タグ: [api], [auth]  タイトル: Rate limitのヘッダーを見忘れて429

/lesson [electron] BrowserWindowのpreloadパスはpathで解決する
→ タグ: [electron]  タイトル: BrowserWindowのpreloadパスはpathで解決する

/lesson npmの依存は定期的にauditすべき
→ タグ: なし  タイトル: npmの依存は定期的にauditすべき
```

### 記録フォーマット

`lessons/dev-lessons.md` の末尾に以下を追記する:

```markdown
### {タイトル} `[tag1]` `[tag2]`
- 記録日: {YYYY-MM-DD}
- 状況: （ユーザーが入力した原文をそのまま保持）
```

### 手順

1. `lessons/dev-lessons.md` が存在するか確認（Globで検索）
2. 存在しない場合、ファイルを新規作成する:
   ```markdown
   # Development Lessons

   教訓の記録。`/skill-loop` で分析し、スキル化候補を検出できます。

   ```
3. 引数からタグとタイトルを解析
4. 記録フォーマットに従って末尾に追記（Editツールでファイル末尾に追加、またはReadで読んでWriteで上書き）
5. 「✅ 教訓を記録しました: {タイトル} {タグ一覧}」と報告

---

## list

記録済みの教訓を一覧表示する。

### 手順

1. `lessons/` ディレクトリ内の全 `.md` ファイルをGlobで検索
2. 各ファイルをReadで読み込み
3. `###` で始まる見出し行を全て抽出
4. 番号付きリストで表示:

```
📋 教訓一覧（全12件）

 1. Rate limitのヘッダーを見忘れて429 [api] [auth]
 2. BrowserWindowのpreloadパスはpathで解決する [electron]
 3. npm auditは定期的に回す [npm]
 ...
```

5. 件数が0の場合:「教訓がまだ記録されていません。`/lesson [tag] 教訓の内容` で記録を始めましょう」

---

## tags

タグの出現回数を集計する。skill-loopのanalyzeモードの簡易版。

### 手順

1. `lessons/` 内の全 `.md` ファイルをGlobで検索
2. 各ファイルの `###` 見出し行から `[tag]` 形式のタグを抽出
   - 除外: `[x]`, `[X]`, `[N/A]`, `[na]`, `[NA]`
3. タグごとに出現回数をカウント
4. 降順で表示:

```
🏷️ タグ集計

  5回  [api]
  4回  [auth]
  3回  [electron]
  2回  [css]
  1回  [mermaid]

💡 3回以上のタグはスキル化の候補です。`/skill-loop` で詳細分析できます。
```

---

## search

キーワードで教訓を検索する。

### 手順

1. 引数から `search` を除いた残りをキーワードとして使用
2. `lessons/` 内の全 `.md` ファイルをGrepでキーワード検索
3. マッチした `###` セクション（見出し+本文）を表示:

```
🔍 検索結果: "rate limit"（2件）

### Rate limitのヘッダーを見忘れて429 `[api]` `[auth]`
- 記録日: 2026-03-26
- 状況: X-RateLimit-Remaining を確認せずにリクエストを連打した

### Rate limit実装時のリトライ間隔 `[api]`
- 記録日: 2026-03-20
- 状況: 固定1秒リトライではなくexponential backoffにすべき
```

4. 0件の場合:「該当する教訓が見つかりませんでした」
