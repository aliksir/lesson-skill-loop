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

| モード | コマンド | 内容 |
|-------|---------|------|
| **分析** | `claude-skill-loop [dir]` | タグ出現回数をカウント、3回以上のパターンをスキル化提案 |
| **差分** | `claude-skill-loop --sync [dir]` | 既存スキルと教訓を比較、未反映の教訓を検出 |
| **健全性** | `claude-skill-loop --health [dir]` | スキルの鮮度と根拠の強さをチェック |
| **マップ** | `claude-skill-loop --map [dir]` | スキル⇔教訓の対応を本文込みで表示（トレーサビリティ） |
| **全部** | `claude-skill-loop --all [dir]` | 全モード実行 |

## オプション

| オプション | 説明 |
|-----------|------|
| `--json` | JSON形式で出力（スクリプト連携・CI向け） |
| `--dir <path>` | 教訓ディレクトリを指定（位置引数の代わり） |
| `--skills-dir <path>` | スキルディレクトリを指定 |
| `--threshold <n>` | スキル化提案の閾値（デフォルト: 3） |

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

## Bash版からの移行

`lesson-skill-check.sh` を使っていた場合、Node.js版は同じ出力フォーマットのドロップイン代替です：

| Bash版 | Node.js版 |
|--------|----------|
| `bash lesson-skill-check.sh [dir]` | `claude-skill-loop [dir]` |
| `bash lesson-skill-check.sh --sync` | `claude-skill-loop --sync` |
| `bash lesson-skill-check.sh --health` | `claude-skill-loop --health` |
| `bash lesson-skill-check.sh --map` | `claude-skill-loop --map` |
| `bash lesson-skill-check.sh --all` | `claude-skill-loop --all` |

Bash版（`lesson-skill-check.sh`）は後方互換のために残してあります。

**v2の新機能:**
- `--json` フラグ（構造化出力）
- `--threshold <n>` でスキル化閾値をカスタマイズ
- `--dir` と `--skills-dir` フラグ
- クロスプラットフォーム（Windows/macOS/Linux）— Bash不要
- 外部依存ゼロ（Node.js 18+の標準ライブラリのみ）

## 参考

- [EvoSkill](https://arxiv.org/abs/2603.02766) — マルチエージェントシステムの自動スキル発見
- [猫軍団](https://github.com/aliksir/neko-gundan) — Claude Codeマルチエージェントオーケストレーション

## ライセンス

MIT
