---
description: Detect gaps between lessons and existing skills
---

教訓ファイルと既存スキルの差分を分析し、スキル化されていない教訓パターンを検出する。

使い方:
- `node ${CLAUDE_PLUGIN_ROOT}/skill-loop.js --sync [lessons_dir]` — 既存スキルとの差分分析

引数$ARGUMENTSがあればlessons_dirとして渡す。なければデフォルトパス。
