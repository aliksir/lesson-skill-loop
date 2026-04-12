# lesson-skill-loop

開発の教訓を再利用可能なスキルに自動変換する。

**[English README](README.md)**

## 何をするツールか

開発者はバグ・インシデント・ミスから教訓を蓄積する。しかしMarkdownに書いた教訓は再読されることが少ない。このツールはそのループを閉じる：

```
教訓（過去の失敗）→ 分析 → スキル化提案 → スキル（チェックリスト）
                                                    ↓
                                               スキル使用
                                                    ↓
                                               新たな教訓
                                                    ↓
                                            スキル改善 or 廃止
```

## クイックスタート

```bash
# インストール不要で即実行（npx）
npx claude-skill-loop examples/lessons

# グローバルインストール
npm install -g claude-skill-loop
claude-skill-loop /path/to/your/lessons
```

## モード

### 分析（CLI）

| モード | コマンド | 内容 |
|-------|---------|------|
| **分析** | `claude-skill-loop [dir]` | タグ出現回数をカウント、3回以上のパターンをスキル化提案 |
| **差分** | `claude-skill-loop --sync [dir]` | 既存スキルと教訓を比較、未反映の教訓を検出 |
| **健全性** | `claude-skill-loop --health [dir]` | スキルの鮮度と根拠の強さをチェック |
| **マップ** | `claude-skill-loop --map [dir]` | スキル⇔教訓の対応を本文込みで表示（トレーサビリティ） |
| **全部** | `claude-skill-loop --all [dir]` | 全モード実行 |

### 記録（スキル — Coworkでも動作）

| コマンド | 内容 |
|---------|------|
| `/lesson [tag] 説明` | タグ付きで教訓を記録 |
| `/lesson list` | 記録済みの教訓を一覧表示 |
| `/lesson tags` | タグの出現回数を集計 |
| `/lesson search キーワード` | キーワードで教訓を検索 |

作業中に教訓を記録し、`/skill-loop` で分析してフィードバックループを回す。

## オプション

| オプション | 説明 |
|-----------|------|
| `--json` | JSON形式で出力（スクリプト連携・CI向け） |
| `--dir <path>` | 教訓ディレクトリを指定（位置引数の代わり） |
| `--skills-dir <path>` | スキルディレクトリを指定 |
| `--for <path>` | **(v2.3.0+)** `<path>` で検出したスタックに関連する教訓のみ表示。下記「スタック対応フィルタ」参照 |
| `--threshold <n>` | スキル化提案の閾値（デフォルト: 3） |

## スタック対応フィルタ（`--for`、v2.3.0+）

`--for <project-path>` は対象プロジェクトの技術スタックをマニフェストファイルから検出し、そのスタックに関連する教訓のみを表示します。「このプロジェクトで気をつけるべき過去の失敗」を浮上させる機能で、汎用スキルを配布する `autoskills` 等とは補完関係にあります。

```bash
# ./my-next-app のスタックに関連する教訓のみ表示
claude-skill-loop --for ./my-next-app ~/.claude/lessons

# 任意のモードと組み合わせ可能
claude-skill-loop --all --for ./my-rust-service ~/.claude/lessons
```

**対応マニフェスト（v2.3.0）**: `package.json` / `requirements.txt` / `pyproject.toml` / `Pipfile` / `Cargo.toml` / `go.mod` / `Gemfile` / `composer.json`。トップレベルのみ走査（モノレポ非対応、v2.4.0 で対応予定）。

**パスの解釈**: 相対パスはカレントディレクトリ基準で解決されます。対象はディレクトリ必須（ファイルパスはエラー）。

**フレームワーク階層**: 親フレームワークのタグも自動的に含まれます。例: Next.js プロジェクトは `[react]` 教訓も、Nuxt プロジェクトは `[vue]` 教訓も表示対象になります。

**出力**: `--json` モードでは、`--for` 指定時のみトップレベルに `stack` フィールドが追加されます:

```json
{
  "mode": "analyze",
  "tags": [...],
  "stack": {
    "projectDir": "/abs/path/to/project",
    "languages": ["javascript"],
    "technologies": ["react", "next", "typescript"],
    "sources": ["package.json"],
    "hardTags": ["[react]", "[next]", "[nextjs]", "[typescript]", "[javascript]"],
    "softTags": ["[hooks]", "[ssr]", "[frontend]", "[types]"],
    "errors": []
  }
}
```

`--for` 未指定時の JSON 出力は v2.2.x と 1 byte も変わりません（既存 CI 連携を保護）。

## 教訓ファイルの書き方

タグ付きの見出しを持つMarkdownファイル：

```markdown
### レート制限 `[api]` `[auth]`
- **レート制限ヘッダーを必ず確認**: X-RateLimit-Remainingで残り回数を把握
- **指数バックオフを実装**: 1秒→2秒→4秒、最大3回リトライ
```

`[brackets]` 内のタグがキー。同じタグが3回以上の見出しに出現すると、スキル化を提案する。

## スキルの形式

Claude Code互換のチェックリスト：

```markdown
---
name: api-checklist
description: 過去の教訓に基づくAPI連携チェックリスト
---

# API連携チェックリスト

- [ ] **レート制限対応**: X-RateLimit-Remainingを確認
- [ ] **APIキーは環境変数**: ソースコードにハードコードしない
```

`*-checklist` という名前のスキルは `--sync` と `--health` で自動検出される。

## 環境変数

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `LESSON_SKILL_LESSONS_DIR` | `./examples/lessons` | 教訓ファイルのパス（単一ディレクトリ） |
| `LESSON_SKILL_SCAN_PATHS` | （`LESSONS_DIR` を使用） | カンマ区切りのスキャンパス（ファイル/ディレクトリ混在可） |
| `LESSON_SKILL_SKILLS_DIR` | `~/.claude/skills` | スキルディレクトリのパス |
| `CLAUDE_SKILLS_DIR` | `~/.claude/skills` | スキルディレクトリのフォールバック |

### 複数パスのスキャン

教訓が複数箇所に分散している場合、`LESSON_SKILL_SCAN_PATHS` を使う:

```bash
# ディレクトリとファイルの両方をスキャン
LESSON_SKILL_SCAN_PATHS="memory/lessons/,memory/dev-lessons.md" claude-skill-loop

# 複数ディレクトリをスキャン
LESSON_SKILL_SCAN_PATHS="lessons/,retrospectives/,postmortems/" claude-skill-loop
```

各パスはディレクトリ（`*.md` を再帰スキャン）でも単体 `.md` ファイルでもOK。

## JSON出力

スクリプト連携やCI向けに `--json` が使えます：

```bash
claude-skill-loop --json --all examples/lessons | jq '.analyze.candidates'
```

## Claude Codeでの使い方

1. **作業する** — バグが起きたら `lessons/*.md` にタグ付きで教訓を記録
2. **ツールを実行** — `claude-skill-loop --all` で繰り返しパターンを確認
3. **スキル作成** — Claude Codeの `/skill-creator` で提案をスキルに変換
4. **スキル改善** — `--sync` が新しい教訓を検出したらスキルに項目追加
5. **スキル廃止** — `--health` が根拠の弱いスキルや古いスキルを警告

### プラグイン構造（commands/）

`commands/` ディレクトリに Claude Code スラッシュコマンドの定義ファイルが含まれています：

| ファイル | スラッシュコマンド | 内容 |
|---------|----------------|------|
| `commands/skill-loop.md` | `/skill-loop` | 全モード実行（analyze + sync + health + map） |
| `commands/skill-loop-health.md` | `/skill-loop-health` | 健全性チェックのみ |
| `commands/skill-loop-sync.md` | `/skill-loop-sync` | 差分チェックのみ |

任意のファイルを `~/.claude/commands/` にコピーしてパスをカスタマイズしてください。

## Bash版からの移行

Bash版（`lesson-skill-check.sh`）は v2.2.0 で削除されました。コマンドの互換性は維持されています：

```bash
# 旧Bash版
bash lesson-skill-check.sh --all

# Node.js版（同等）
claude-skill-loop --all
```

全フラグ（`--sync`, `--health`, `--map`, `--all`）はそのまま使えます。Node.js版では `--json`, `--threshold`, `--dir`, `--skills-dir`, `--self-update` が追加されています。

## Claude Cowork対応

**Claude Cowork**（ブラウザベースの共同作業）でも動作します。Bashが使えない環境では、Claudeの組み込みツール（Read, Glob, Grep）で同等の分析を実行します。

`skills/skill-loop/SKILL.md` に全4モード（analyze/sync/health/map）の手順が記述されています。

### 制約事項

Coworkはプロジェクト内のファイルのみアクセス可能です。**教訓ファイル（`lessons/*.md`）がプロジェクトリポジトリ内に存在する場合のみ**使用できます。教訓がローカル環境（`~/.claude/memory/lessons/` 等）にのみある場合は、CLI版（`npx claude-skill-loop`）を使用してください。

### セットアップ手順

#### 1. クローンまたはダウンロード

```bash
git clone https://github.com/aliksir/lesson-skill-loop.git
```

または [Releases](https://github.com/aliksir/lesson-skill-loop/releases) ページからZIPをダウンロード。

#### 2. スキルをClaudeのスキルディレクトリにコピー

```bash
cp -r lesson-skill-loop/skills/skill-loop ~/.claude/skills/
cp -r lesson-skill-loop/skills/lesson ~/.claude/skills/
```

2つのスキルがインストールされます:
- `~/.claude/skills/skill-loop/SKILL.md` — 教訓を分析してスキル化候補を提案
- `~/.claude/skills/lesson/SKILL.md` — タグ付きで教訓を記録

#### 3. 動作確認

Claude Coworkセッションで以下を入力:

```
/lesson [test] テスト教訓です
/lesson list
/skill-loop
```

#### 4. Coworkでの完全なループ

```
/lesson [api] Rate limitのヘッダーを必ず確認する       ← 記録
/lesson [api] リトライはexponential backoffで          ← さらに記録
/lesson tags                                           ← タグ集計を確認
/skill-loop                                            ← 分析→スキル化候補
```

教訓ファイルの事前準備は不要。`/lesson` が `lessons/dev-lessons.md` を自動作成します。

### CLIとCoworkの比較

| 機能 | CLI (`npx claude-skill-loop`) | Cowork (`/skill-loop`) |
|------|-------------------------------|------------------------|
| Analyzeモード | ✅ | ✅ |
| Syncモード | ✅ | ✅ |
| Healthモード | ✅ | ✅（ファイル日時は「不明」になる場合あり） |
| Mapモード | ✅ | ✅ |
| JSON出力 | ✅ `--json` | ❌（Coworkでは不要） |
| セルフアップデート | ✅ `--self-update` | ❌（SKILL.mdを再コピーして更新） |
| 閾値カスタマイズ | ✅ `--threshold N` | ❌（3固定） |
| 速度 | 高速（Node.jsネイティブ） | やや遅い（Claudeがファイルを1つずつ読む） |

## 参考

- [EvoSkill](https://arxiv.org/abs/2603.02766) — マルチエージェントシステムの自動スキル発見
- [猫軍団](https://github.com/aliksir/neko-gundan) — Claude Codeマルチエージェントオーケストレーション

## ライセンス

MIT
