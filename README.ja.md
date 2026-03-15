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
git clone https://github.com/aliksir/lesson-skill-loop.git
cd lesson-skill-loop

# サンプルデータで試す
bash lesson-skill-check.sh examples/lessons

# 自分の教訓ファイルで使う
bash lesson-skill-check.sh /path/to/your/lessons
```

## モード

| モード | コマンド | 内容 |
|-------|---------|------|
| **分析** | `bash lesson-skill-check.sh [dir]` | タグ出現回数をカウント、3回以上のパターンをスキル化提案 |
| **差分** | `bash lesson-skill-check.sh --sync [dir]` | 既存スキルと教訓を比較、未反映の教訓を検出 |
| **健全性** | `bash lesson-skill-check.sh --health [dir]` | スキルの鮮度と根拠の強さをチェック |
| **マップ** | `bash lesson-skill-check.sh --map [dir]` | スキル⇔教訓の対応を本文込みで表示（トレーサビリティ） |
| **全部** | `bash lesson-skill-check.sh --all [dir]` | 全モード実行 |

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
| `LESSON_SKILL_LESSONS_DIR` | `./examples/lessons` | 教訓ファイルのパス |
| `LESSON_SKILL_SKILLS_DIR` | `~/.claude/skills` | スキルディレクトリのパス |

## Claude Codeでの使い方

1. **作業する** — バグが起きたら `lessons/*.md` にタグ付きで教訓を記録
2. **ツールを実行** — `bash lesson-skill-check.sh --all` で繰り返しパターンを確認
3. **スキル作成** — Claude Codeの `/skill-creator` で提案をスキルに変換
4. **スキル改善** — `--sync` が新しい教訓を検出したらスキルに項目追加
5. **スキル廃止** — `--health` が根拠の弱いスキルや古いスキルを警告

## 参考

- [EvoSkill](https://arxiv.org/abs/2603.02766) — マルチエージェントシステムの自動スキル発見
- [猫軍団](https://github.com/aliksir/neko-gundan) — Claude Codeマルチエージェントオーケストレーション

## ライセンス

MIT
