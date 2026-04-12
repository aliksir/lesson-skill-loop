# lesson-skill-loop

開発中に蓄積した教訓（lessons/*.md）のタグパターンを分析し、スキル化候補の提案・既存スキルとの差分検出・スキル健全性チェックを行う CLI ツール。

## 技術スタック

- Node.js >= 18（ESM）
- 外部依存ゼロ（Node.js built-ins のみ）
- 単一ファイル構成（skill-loop.js）
- NPM パッケージ名: `claude-skill-loop`

## セットアップ

```bash
# npx で直接実行（インストール不要）
npx claude-skill-loop examples/lessons

# グローバルインストール
npm install -g claude-skill-loop
```

## ビルド

該当なし（単一ファイル構成のためビルド不要）

## テスト

```bash
node --test test/skill-loop.test.mjs
```

または:

```bash
npm test
```

## 開発規約

- 外部依存ゼロを維持する。Node.js built-ins のみ使用する
- 既存の教訓ファイルフォーマット（`### 見出し` + `[tag]`）との後方互換性を維持する
- `--json` 出力のスキーマを安定させる。既存の CI 連携を壊す変更は禁止
- v2.3.0 以降の `--for <project-path>` 機能はスタック検出対象マニフェスト 8 種（package.json / requirements.txt / pyproject.toml / Pipfile / Cargo.toml / go.mod / Gemfile / composer.json）を維持する
