---
description: "Analyze development lessons and suggest skill candidates. Usage: /skill-loop [lessons_dir]"
---

教訓ファイル（lessons/*.md）を分析してスキル化候補を提案するツール。

使い方:
- `node ${CLAUDE_PLUGIN_ROOT}/skill-loop.mjs [lessons_dir]` — タグ分析+スキル化候補
- `node ${CLAUDE_PLUGIN_ROOT}/skill-loop.mjs --sync [lessons_dir]` — 既存スキルとの差分分析
- `node ${CLAUDE_PLUGIN_ROOT}/skill-loop.mjs --health [lessons_dir]` — スキル健全性チェック
- `node ${CLAUDE_PLUGIN_ROOT}/skill-loop.mjs --map [lessons_dir]` — スキル⇔教訓トレーサビリティマップ
- `node ${CLAUDE_PLUGIN_ROOT}/skill-loop.mjs --all [lessons_dir]` — 全部実行
- `node ${CLAUDE_PLUGIN_ROOT}/skill-loop.mjs --json [lessons_dir]` — JSON形式出力

引数$ARGUMENTSがあればlessons_dirとして渡す。なければデフォルトパス。
