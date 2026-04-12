#!/usr/bin/env node
// skill-loop.js — 教訓⇔スキル フィードバックループ (Node.js v2)
//
// 教訓ファイル（lessons/*.md）のタグパターンを分析し、
// スキル化候補の提案・既存スキルとの差分検出・スキル健全性チェックを行う。
//
// 使い方:
//   node skill-loop.js [lessons_dir]              # タグ分析+スキル化候補
//   node skill-loop.js --sync [lessons_dir]       # 既存スキルとの差分分析
//   node skill-loop.js --health [lessons_dir]     # スキル健全性チェック
//   node skill-loop.js --map [lessons_dir]        # スキル⇔教訓トレーサビリティマップ
//   node skill-loop.js --all [lessons_dir]        # 全部実行
//   node skill-loop.js --for <project-dir>        # v2.3.0: プロジェクトスタック検出+教訓フィルタ
//   node skill-loop.js --json [lessons_dir]       # JSON形式出力
//   node skill-loop.js --self-update              # ツール自身を最新版に更新
//
// EvoSkill論文（arxiv:2603.02766）の「失敗→スキル発見→改善」を実装。

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, basename, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// --- 引数解析 ---

const args = process.argv.slice(2);

let mode = 'analyze';
let jsonMode = false;
let lessonsDir = '';
let skillsDir = '';
let projectDir = ''; // v2.3.0: --for <path>
let threshold = 3;
const selfUpdateMode = args.includes('--self-update');
const noVersionCheck = args.includes('--no-version-check');

// --- --help ---
if (args.includes('--help') || args.includes('-h')) {
  console.log(`claude-skill-loop — Turn development lessons into reusable skills

Usage: claude-skill-loop [options] [lessons_dir]

Modes:
  (default)          Analyze tag patterns and suggest skill candidates
  --sync             Compare existing skills with lessons, find gaps
  --health           Check skill freshness and evidence strength
  --map              Full traceability: which lessons back which skills
  --all              Run all modes

Options:
  --dir <path>       Lessons directory (or pass as positional arg)
  --skills-dir <path> Skills directory (default: ~/.claude/skills)
  --for <path>       Filter lessons by stack detected in <path> (v2.3.0+).
                     Relative paths are resolved from the current working directory.
                     The target must be a directory (not a file).
                     Only top-level manifests are scanned; monorepos are not supported.
                     Supported: package.json / requirements.txt / pyproject.toml /
                                Pipfile / Cargo.toml / go.mod / Gemfile / composer.json
  --threshold <n>    Min tag occurrences for skill candidates (default: 3)
  --json             JSON output
  --self-update      Update tool itself via npm install -g claude-skill-loop@latest
  --no-version-check Disable npm version check at end of scan (for CI)
  --help, -h         Show this help message

Environment:
  LESSON_SKILL_LESSONS_DIR   Lessons directory
  LESSON_SKILL_SKILLS_DIR    Skills directory
  LESSON_SKILL_SCAN_PATHS    Comma-separated scan paths
  CLAUDE_SKILLS_DIR          Skills directory (fallback)
`);
  process.exit(0);
}

// --- バージョン管理 ---

/** このスクリプトと同ディレクトリの package.json から現在バージョンを取得 */
function getCurrentVersion() {
  try {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(scriptDir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return pkg.version || null;
    }
  } catch { /* package.json読み取り失敗時はnullを返してバージョン表示を省略 */ }
  return null;
}

/** npmレジストリから最新バージョンを取得。失敗時は null を返す */
function getLatestVersion() {
  try {
    return execSync('npm view claude-skill-loop version', {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null; // npmレジストリ接続失敗（オフライン等）時は最新バージョン確認をスキップ
  }
}

/**
 * semver比較。current < latest なら true。
 * major.minor.patch の数値比較のみ（外部依存なし）
 */
function isNewer(current, latest) {
  const toNums = (v) => v.replace(/^v/, '').split('.').map(Number);
  const [cM, cm, cp] = toNums(current);
  const [lM, lm, lp] = toNums(latest);
  if (lM !== cM) return lM > cM;
  if (lm !== cm) return lm > cm;
  return lp > cp;
}

/** npx 経由で実行されているかどうかを判定 */
function isNpx() {
  const execPath = process.env.npm_execpath || '';
  const argv1 = process.argv[1] || '';
  if (execPath.includes('npx') || argv1.includes('npx')) return true;
  // npx はキャッシュ内 (_npx) に展開する
  if (argv1.includes('_npx')) return true;
  // グローバルインストール確認
  try {
    const out = execSync('npm list -g claude-skill-loop --depth=0', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return !out.includes('claude-skill-loop');
  } catch {
    return false; // npm list失敗時はグローバルインストール済みと仮定してnpx扱いにしない
  }
}

/** --self-update: npm install -g claude-skill-loop@latest を実行 */
async function selfUpdate() {
  if (isNpx()) {
    console.log(`\nℹ️  npxでは自動更新できません。`);
    console.log(`   npm install -g claude-skill-loop でインストール後に --self-update を使用してください。\n`);
    process.exit(0);
  }

  const current = getCurrentVersion() || '(不明)';
  console.log(`\n🔄 claude-skill-loop を更新中...`);
  console.log(`  現在: v${current}`);
  console.log(`  📥 npm install -g claude-skill-loop@latest`);

  try {
    execSync('npm install -g claude-skill-loop@latest', {
      encoding: 'utf-8',
      timeout: 60000,
      stdio: 'inherit',
    });
    const after = getLatestVersion() || '(確認失敗)';
    console.log(`  ✅ 更新完了: v${after}\n`);
  } catch (e) {
    console.error(`  ❌ 更新失敗: ${e.message}`);
    process.exit(1);
  }
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--sync':    mode = 'sync';    break;
    case '--health':  mode = 'health';  break;
    case '--map':     mode = 'map';     break;
    case '--all':     mode = 'all';     break;
    case '--json':    jsonMode = true;  break;
    case '--dir':
      // args[++i] が配列末尾を超えた場合は undefined → '' にフォールバック（意図的）
      lessonsDir = args[++i] || '';
      break;
    case '--skills-dir':
      // 同上: オプション値省略時は '' にフォールバック（デフォルト値が後続で適用される）
      skillsDir = args[++i] || '';
      break;
    case '--threshold':
      // 同上: 数値でない場合は parseInt がNaNになるため || 3 でデフォルト値にフォールバック
      threshold = parseInt(args[++i], 10) || 3;
      break;
    case '--for':
      // v2.3.0: プロジェクトディレクトリを指定してスタック検出+教訓フィルタ
      projectDir = args[++i] || '';
      break;
    case '--self-update':
    case '--no-version-check':
      break; // 上位で処理済み
    default:
      // 位置引数 (--で始まらない) は教訓ディレクトリとして扱う
      if (!arg.startsWith('--')) {
        lessonsDir = arg;
      }
  }
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const LESSONS_DIR = process.env.LESSON_SKILL_LESSONS_DIR
  || lessonsDir
  || join(SCRIPT_DIR, 'examples', 'lessons');

const SKILLS_DIR = skillsDir
  || process.env.LESSON_SKILL_SKILLS_DIR
  || process.env.CLAUDE_SKILLS_DIR
  || join(homedir(), '.claude', 'skills');

const SCAN_PATHS = process.env.LESSON_SKILL_SCAN_PATHS || LESSONS_DIR;
const THRESHOLD = threshold;

// v2.3.0: --for 関連のグローバル状態
// projectDir 指定時のみセットされる。null の場合は v2.2.2 完全互換動作
let stackMetadata = null;
let allowedTags = null;

// ============================================================================
// v2.3.0: スタック検出マッピング表
// ============================================================================

/**
 * 対応マニフェストファイル一覧（v2.3.0: 6 言語 8 マニフェスト）
 *
 * v2.4.0 以降に延期: Java/Kotlin (pom.xml/build.gradle/build.gradle.kts) /
 *                    .NET (*.csproj) / Elixir (mix.exs)
 */
const STACK_MANIFESTS = [
  // JavaScript / TypeScript
  { file: 'package.json',      parser: parsePackageJson,     lang: 'javascript' },
  // Python
  { file: 'requirements.txt',  parser: parseRequirementsTxt, lang: 'python' },
  { file: 'pyproject.toml',    parser: parsePyprojectToml,   lang: 'python' },
  { file: 'Pipfile',           parser: parsePipfile,         lang: 'python' },
  // Rust
  { file: 'Cargo.toml',        parser: parseCargoToml,       lang: 'rust' },
  // Go
  { file: 'go.mod',            parser: parseGoMod,           lang: 'go' },
  // Ruby
  { file: 'Gemfile',           parser: parseGemfile,         lang: 'ruby' },
  // PHP
  { file: 'composer.json',     parser: parseComposerJson,    lang: 'php' },
];

/**
 * 技術→タグマッピング（hardTags/softTags 分離）
 * hardTags: フィルタで直接マッチさせる強いタグ（precision 優先）
 * softTags: 関連タグとしてフィルタ後の優先度付け・表示にのみ使用（recall 優先）
 *
 * Next/Nuxt は親フレームワーク (React/Vue) を hard に含める
 * （Next.js プロジェクトで `[react]` 教訓を除外するのは実用上おかしいため）
 */
const TECH_TO_TAGS = {
  // --- JavaScript / TypeScript ---
  'react':        { hard: ['react'],        soft: ['hooks', 'component', 'frontend'] },
  'vue':          { hard: ['vue'],          soft: ['component', 'frontend'] },
  'next':         { hard: ['next', 'nextjs', 'react'], soft: ['hooks', 'ssr', 'frontend'] },
  'nuxt':         { hard: ['nuxt', 'vue'],  soft: ['ssr', 'frontend'] },
  'svelte':       { hard: ['svelte'],       soft: ['frontend'] },
  'astro':        { hard: ['astro'],        soft: ['ssg', 'frontend'] },
  'express':      { hard: ['express'],      soft: ['node', 'backend', 'api'] },
  'fastify':      { hard: ['fastify'],      soft: ['node', 'backend', 'api'] },
  'nestjs':       { hard: ['nestjs'],       soft: ['node', 'backend', 'api'] },
  '@nestjs/core': { hard: ['nestjs'],       soft: ['node', 'backend', 'api'] },
  'tailwindcss':  { hard: ['tailwind'],     soft: ['css', 'frontend'] },
  'typescript':   { hard: ['typescript'],   soft: ['types'] },
  'playwright':   { hard: ['playwright'],   soft: ['e2e', 'test'] },
  '@playwright/test': { hard: ['playwright'], soft: ['e2e', 'test'] },
  'vitest':       { hard: ['vitest'],       soft: ['test'] },
  'jest':         { hard: ['jest'],         soft: ['test'] },
  'prisma':       { hard: ['prisma'],       soft: ['orm', 'db'] },

  // --- Python ---
  'fastapi':      { hard: ['fastapi'],      soft: ['async', 'api', 'backend'] },
  'django':       { hard: ['django'],       soft: ['backend', 'orm', 'mvc'] },
  'flask':        { hard: ['flask'],        soft: ['backend', 'api'] },
  'starlette':    { hard: ['starlette'],    soft: ['async', 'api'] },
  'pydantic':     { hard: ['pydantic'],     soft: ['validation'] },
  'sqlalchemy':   { hard: ['sqlalchemy'],   soft: ['orm', 'db'] },
  'pytest':       { hard: ['pytest'],       soft: ['test'] },

  // --- Rust ---
  'tokio':        { hard: ['tokio'],        soft: ['async'] },
  'axum':         { hard: ['axum'],         soft: ['backend', 'api'] },
  'actix-web':    { hard: ['actix'],        soft: ['backend', 'api'] },
  'serde':        { hard: ['serde'],        soft: ['serialization'] },
  'reqwest':      { hard: ['reqwest'],      soft: ['http'] },

  // --- Go ---
  'gin':          { hard: ['gin'],          soft: ['backend', 'api'] },
  'echo':         { hard: ['echo'],         soft: ['backend', 'api'] },
  'fiber':        { hard: ['fiber'],        soft: ['backend', 'api'] },
  'chi':          { hard: ['chi'],          soft: ['backend', 'api'] },

  // --- Ruby ---
  'rails':        { hard: ['rails'],        soft: ['mvc', 'orm', 'backend'] },
  'sinatra':      { hard: ['sinatra'],      soft: ['backend', 'api'] },
  'rack':         { hard: ['rack'],         soft: ['backend'] },
  'rspec':        { hard: ['rspec'],        soft: ['test'] },
  'rspec-rails':  { hard: ['rspec'],        soft: ['test'] },

  // --- PHP ---
  'laravel':      { hard: ['laravel'],      soft: ['mvc', 'orm', 'backend'] },
  'symfony':      { hard: ['symfony'],      soft: ['backend', 'api'] },
  'phpunit':      { hard: ['phpunit'],      soft: ['test'] },
};

/**
 * 言語単位のタグ（hardTags のみ）
 */
const LANG_TO_TAGS = {
  'javascript': { hard: ['javascript'], soft: [] },
  'python':     { hard: ['python'],     soft: [] },
  'rust':       { hard: ['rust'],       soft: [] },
  'go':         { hard: ['go', 'golang'], soft: [] },
  'ruby':       { hard: ['ruby'],       soft: [] },
  'php':        { hard: ['php'],        soft: [] },
};

/**
 * 非フレームワーク vendor のブラックリスト（composer.json 用）
 * v2.3.0 では 6 vendor で確定。
 */
const COMPOSER_VENDOR_BLACKLIST = new Set([
  'roave',         // roave/security-advisories 等
  'phpstan',       // phpstan/phpstan 等の静的解析ツール
  'phan',          // phan/phan
  'squizlabs',     // squizlabs/php_codesniffer
  'friendsofphp',  // friendsofphp/php-cs-fixer
  'vimeo',         // vimeo/psalm
]);

// ============================================================================
// v2.3.0: スタック検出共通ヘルパ
// ============================================================================

/** 正規表現メタ文字をエスケープする */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** UTF-8 BOM を除去する */
function stripBOM(text) {
  return text.replace(/^\uFEFF/, '');
}

/**
 * ファイルを読み込み、BOM と改行コードを正規化する
 * スタックマニフェスト読み込みで使用（教訓ファイル側は従来動作を維持）
 */
function readTextFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  return stripBOM(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * TOML 風ファイルから特定セクションの本文を抽出する（行走査版）
 *
 * - `[[tool.poetry.source]]` のような array-of-tables を次セクション境界と認識
 * - 三連引用文字列 `"""..."""` / `'''...'''` の内側は完全に素通し
 * - セクション見出しの末尾コメント `[project] # comment` に対応
 *
 * @param {string} content — ファイル全文
 * @param {string} sectionName — 抽出したいセクション名（例: 'tool.poetry.dependencies'）
 * @returns {string} セクション本文（見出し行を含まない）
 */
function extractTomlSection(content, sectionName) {
  const lines = content.split('\n');
  const escaped = escapeRegExp(sectionName);
  // 対象セクション: [section] のみ（array-of-tables [[...]] は別扱い）
  // 末尾にコメントが付く形式にも対応
  const targetRe = new RegExp(`^\\[${escaped}\\]\\s*(#.*)?$`);
  // 任意のセクション見出し: [x] または [[x]]（末尾コメント可）
  const anySectionRe = /^\[\[?[^\[\]]+\]?\]\s*(#.*)?$/;

  const result = [];
  let inTarget = false;
  let inMultiline = false;
  let multilineDelim = '';

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();

    // 三連引用文字列内は終了判定のみ行い、行は result に含めない
    // （multiline 本文を push すると parser が key = value として誤認するため）
    if (inMultiline) {
      if (line.includes(multilineDelim)) {
        const occ = (line.match(new RegExp(escapeRegExp(multilineDelim), 'g')) || []).length;
        // 行内で奇数回出現すると multiline 終了
        if (occ % 2 === 1) inMultiline = false;
      }
      continue;
    }

    // セクション見出し判定（multiline 開始より先に行う）
    if (targetRe.test(trimmed)) {
      inTarget = true;
      continue;
    }
    if (anySectionRe.test(trimmed)) {
      inTarget = false;
      continue;
    }

    // 三連引用文字列の開始検出（行内で奇数回の出現は状態継続）
    // 開始行は multiline として扱い、キー抽出対象から除外する
    const tripleDoubleCount = (line.match(/"""/g) || []).length;
    const tripleSingleCount = (line.match(/'''/g) || []).length;
    if (tripleDoubleCount % 2 === 1) {
      inMultiline = true;
      multilineDelim = '"""';
      continue;
    }
    if (tripleSingleCount % 2 === 1) {
      inMultiline = true;
      multilineDelim = "'''";
      continue;
    }

    if (inTarget) result.push(line);
  }

  return result.join('\n');
}

// ============================================================================
// v2.3.0: マニフェストパーサー（6 言語 8 種）
// ============================================================================

/** package.json から dependencies + devDependencies を抽出 */
function parsePackageJson(filePath) {
  const content = readTextFile(filePath);
  const pkg = JSON.parse(content); // parse 失敗は throw → 呼び出し側で errors に記録
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return Object.keys(deps);
}

/** requirements.txt から依存名を抽出 */
function parseRequirementsTxt(filePath) {
  const content = readTextFile(filePath);
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('-'))
    .filter(l => !/^(https?:|git\+|svn\+|hg\+)/.test(l))
    .map(l => l.split(/[<>=!~\s;\[]/)[0].toLowerCase())
    .filter(Boolean);
}

/** pyproject.toml から依存名を抽出（poetry / PEP 621 両対応） */
function parsePyprojectToml(filePath) {
  const content = readTextFile(filePath);
  const deps = new Set();

  // [tool.poetry.dependencies]
  const poetrySection = extractTomlSection(content, 'tool.poetry.dependencies');
  for (const line of poetrySection.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_.-]+)\s*=/);
    if (m && m[1].toLowerCase() !== 'python') deps.add(m[1].toLowerCase());
  }

  // [project] の dependencies = [ ... ]（PEP 621）
  // 配列終端の `]` と extras `[standard]` の `]` を誤認しないよう、引用符内文字列を個別抽出
  const projectSection = extractTomlSection(content, 'project');
  const depItems = projectSection.match(/["'][^"']+["']/g) || [];
  const inDepsSection = projectSection.match(/dependencies\s*=\s*\[/);
  if (inDepsSection) {
    // dependencies = [ ... ] 内の引用符文字列から依存名を抽出
    // 各行の引用符文字列を取得（配列内のみ）
    const afterDeps = projectSection.slice(inDepsSection.index + inDepsSection[0].length);
    const items = afterDeps.match(/["'][^"']+["']/g) || [];
    for (const q of items) {
      const raw = q.replace(/["']/g, '');
      const name = raw.split(/[<>=!~\s;\[]/)[0].toLowerCase();
      if (name) deps.add(name);
    }
  }

  return [...deps];
}

/** Pipfile から依存名を抽出 */
function parsePipfile(filePath) {
  const content = readTextFile(filePath);
  const deps = new Set();
  const section = extractTomlSection(content, 'packages');
  for (const line of section.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_.-]+)\s*=/);
    if (m) deps.add(m[1].toLowerCase());
  }
  return [...deps];
}

/**
 * Cargo.toml から依存名を抽出
 * - [dependencies] / [dev-dependencies] / [build-dependencies] / [workspace.dependencies]
 * - 各テーブル形式 [dependencies.foo] 等にも対応
 */
function parseCargoToml(filePath) {
  const content = readTextFile(filePath);
  const deps = new Set();
  const lines = content.split('\n');

  const INLINE_SECTIONS = [
    'dependencies',
    'dev-dependencies',
    'build-dependencies',
    'workspace.dependencies',
  ];

  for (const name of INLINE_SECTIONS) {
    const section = extractTomlSection(content, name);
    for (const line of section.split('\n')) {
      const m = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
      if (m) deps.add(m[1].toLowerCase());
    }
  }

  // テーブル形式（見出しから直接検出）
  const tableRe = /^\[(?:dependencies|dev-dependencies|build-dependencies|workspace\.dependencies)\.([a-zA-Z0-9_-]+)\]\s*(#.*)?$/;
  for (const line of lines) {
    const m = line.trim().match(tableRe);
    if (m) deps.add(m[1].toLowerCase());
  }

  return [...deps];
}

/** go.mod から依存名（最終パスセグメント）を抽出 */
function parseGoMod(filePath) {
  const content = readTextFile(filePath);
  const deps = new Set();
  const lines = content.split('\n');
  let inBlock = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === 'require (') { inBlock = true; continue; }
    if (trimmed === ')') { inBlock = false; continue; }
    const isRequireLine = inBlock || trimmed.startsWith('require ');
    if (!isRequireLine) continue;
    const stripped = trimmed.replace(/^require\s+/, '');
    const m = stripped.match(/^([a-z0-9.\/_-]+)\s+v/);
    if (m) {
      const parts = m[1].split('/');
      const last = parts[parts.length - 1];
      if (last) deps.add(last.toLowerCase());
    }
  }
  return [...deps];
}

/** Gemfile から gem 名を抽出 */
function parseGemfile(filePath) {
  const content = readTextFile(filePath);
  const deps = new Set();
  for (const line of content.split('\n')) {
    const m = line.trim().match(/^gem\s+["']([a-zA-Z0-9_-]+)["']/);
    if (m) deps.add(m[1].toLowerCase());
  }
  return [...deps];
}

/** composer.json から vendor 名（ブラックリスト除外）を抽出 */
function parseComposerJson(filePath) {
  const content = readTextFile(filePath);
  const pkg = JSON.parse(content);
  const deps = { ...(pkg.require || {}), ...(pkg['require-dev'] || {}) };
  const result = new Set();
  for (const key of Object.keys(deps)) {
    if (key === 'php' || key.startsWith('ext-')) continue;
    const vendor = key.split('/')[0].toLowerCase();
    if (!vendor) continue;
    if (COMPOSER_VENDOR_BLACKLIST.has(vendor)) continue;
    result.add(vendor);
  }
  return [...result];
}

// ============================================================================
// v2.3.0: スタック検出・タグ導出
// ============================================================================

/**
 * プロジェクトディレクトリからスタックを検出する
 * v2.3.0 では projectDir 直下のマニフェストのみ走査（モノレポ非対応）
 * @param {string} projectDir — 絶対パス
 */
function detectStack(projectDir) {
  const technologies = new Set();
  const languages = new Set();
  const sources = [];
  const errors = [];

  for (const { file, parser, lang } of STACK_MANIFESTS) {
    const path = join(projectDir, file);
    if (!existsSync(path)) continue;

    sources.push(file);
    languages.add(lang);

    try {
      const deps = parser(path);
      for (const dep of deps) technologies.add(dep);
    } catch (e) {
      errors.push({
        file,
        reason: e && e.message ? String(e.message).slice(0, 200) : 'parse error',
      });
    }
  }

  return {
    languages: [...languages],
    technologies: [...technologies],
    sources,
    errors,
  };
}

/** 検出した技術・言語から hardTags のみを抽出（フィルタ用） */
function stackToAllowedTags({ languages, technologies }) {
  const tags = new Set();
  for (const lang of languages) {
    const entry = LANG_TO_TAGS[lang];
    if (!entry) continue;
    for (const t of entry.hard) tags.add(`[${t}]`);
  }
  for (const tech of technologies) {
    const entry = TECH_TO_TAGS[tech];
    if (!entry) continue;
    for (const t of entry.hard) tags.add(`[${t}]`);
  }
  return tags;
}

/** 検出した技術・言語から softTags を抽出（表示優先度用） */
function stackToSoftTags({ languages, technologies }) {
  const tags = new Set();
  for (const lang of languages) {
    const entry = LANG_TO_TAGS[lang];
    if (!entry) continue;
    for (const t of entry.soft) tags.add(`[${t}]`);
  }
  for (const tech of technologies) {
    const entry = TECH_TO_TAGS[tech];
    if (!entry) continue;
    for (const t of entry.soft) tags.add(`[${t}]`);
  }
  return tags;
}

/**
 * `stack` JSON オブジェクトを組み立てる単一責務関数
 * メインフロー / doAll / runMode の全てからこれを通して生成する
 */
function buildStackMetadata(projectAbsPath, detectedStack) {
  return {
    projectDir: projectAbsPath,
    languages: detectedStack.languages,
    technologies: detectedStack.technologies,
    sources: detectedStack.sources,
    hardTags: [...stackToAllowedTags(detectedStack)],
    softTags: [...stackToSoftTags(detectedStack)],
    errors: detectedStack.errors,
  };
}

// --- ファイルリスト構築 ---

/**
 * カンマ区切りのスキャンパスからmdファイル一覧を構築する
 * @returns {string[]} mdファイルの絶対パス一覧
 */
function buildFileList() {
  const paths = SCAN_PATHS.split(',').map(p => p.trim()).filter(Boolean);
  const files = [];

  for (const p of paths) {
    const resolved = resolve(p);
    if (!existsSync(resolved)) continue;

    const stat = statSync(resolved);
    if (stat.isFile() && resolved.endsWith('.md')) {
      files.push(resolved);
    } else if (stat.isDirectory()) {
      try {
        const entries = readdirSync(resolved);
        for (const entry of entries) {
          if (entry.endsWith('.md')) {
            files.push(join(resolved, entry));
          }
        }
      } catch {
        // 読み取り不可ディレクトリはスキップ
      }
    }
  }

  return files;
}

const LESSON_FILES = buildFileList();
// v2.3.0: LESSON_FILES 空チェックは main() 内で --for 検証の後に実施
// （--for の入力検証が正しく先に走るようにするため）

// --- 共通ユーティリティ ---

/**
 * 全教訓ファイルの内容を結合して返す（改行コード正規化済み）
 */
function readAllLessons() {
  return LESSON_FILES
    .map(f => {
      try { return readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { return ''; /* ファイル読み取り失敗時は空文字列で集計をスキップ */ }
    })
    .join('\n');
}

/**
 * 教訓ファイルからタグを抽出してカウントマップを返す。
 * タグは見出し行（### で始まる行）内の `[a-zA-Z0-9_-]{2,}` 形式のみ対象。
 * Markdownチェックボックス `[x]`, `[ ]` やメタ表現 `[N/A]`, `[x]` 等は除外する。
 * @returns {Map<string, number>} タグ→出現回数
 */
function getTags() {
  const tagRegex = /\[[a-zA-Z0-9_-]{2,}\]/g;
  // チェックボックスやメタ表現として除外するリテラル
  const EXCLUDED_TAGS = new Set(['[x]', '[X]', '[N/A]', '[na]', '[NA]']);
  const counts = new Map();

  for (const f of LESSON_FILES) {
    let content;
    try { content = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { continue; /* ファイル読み取り失敗時はこのファイルをスキップ */ }

    // 見出し行（### で始まる行）のみを対象にする
    const headingLines = content.split('\n').filter(line => /^###\s/.test(line));

    for (const line of headingLines) {
      let match;
      tagRegex.lastIndex = 0;
      while ((match = tagRegex.exec(line)) !== null) {
        const tag = match[0];
        if (EXCLUDED_TAGS.has(tag)) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
  }

  // 出現回数の降順でソート
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

/**
 * 教訓ファイルから特定タグの見出し行を全件抽出
 * @param {string} tag — 例: "[api]"
 * @returns {string[]}
 */
function getLessonHeadingsForTag(tag) {
  const results = [];
  for (const f of LESSON_FILES) {
    let content;
    try { content = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { continue; /* ファイル読み取り失敗時はこのファイルをスキップ */ }
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('### ') && line.includes(tag)) {
        results.push(line);
      }
    }
  }
  return results;
}

/**
 * 教訓ファイルから特定タグのセクション全文を抽出（見出し+本文）
 * @param {string} tag — 例: "[api]"
 * @returns {{ num: number, heading: string, body: string[] }[]}
 */
function getLessonSectionsForTag(tag) {
  const sections = [];
  let sectionNum = 0;

  for (const f of LESSON_FILES) {
    let content;
    try { content = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { continue; /* ファイル読み取り失敗時はこのファイルをスキップ */ }

    const lines = content.split('\n');
    let inSection = false;
    let currentSection = null;

    for (const line of lines) {
      // ### で始まる見出し行
      if (/^###\s/.test(line)) {
        if (line.includes(tag)) {
          inSection = true;
          sectionNum++;
          currentSection = {
            num: sectionNum,
            heading: line.replace(/^###\s*/, ''),
            body: []
          };
          sections.push(currentSection);
        } else {
          inSection = false;
          currentSection = null;
        }
        continue;
      }
      // ## で始まる上位見出し → セクション終了
      if (/^##\s/.test(line)) {
        inSection = false;
        currentSection = null;
        continue;
      }
      // セクション内の本文行
      if (inSection && currentSection && line.trim() !== '') {
        currentSection.body.push(line);
      }
    }
  }

  return sections;
}

/**
 * スキルのSKILL.mdからチェック項目を抽出（ - [ ] で始まる行）
 * @param {string} skillPath
 * @returns {string[]}
 */
function getSkillItems(skillPath) {
  let content;
  try { content = readFileSync(skillPath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { return []; /* SKILL.md読み取り失敗時は空配列を返してスキルなしとして扱う */ }
  return content
    .split('\n')
    .filter(line => /^\s*- \[[ x]\]/.test(line))
    .map(line => line.replace(/^\s*- \[[ x]\] /, ''));
}

/**
 * *-checklist スキルディレクトリ一覧を返す
 * @returns {{ dir: string, name: string, file: string }[]}
 */
function getChecklistSkills() {
  if (!existsSync(SKILLS_DIR)) return [];
  try {
    return readdirSync(SKILLS_DIR)
      .filter(entry => entry.endsWith('-checklist'))
      .map(entry => {
        const dir = join(SKILLS_DIR, entry);
        const file = join(dir, 'SKILL.md');
        return { dir, name: entry, file };
      })
      .filter(s => {
        try {
          return statSync(s.dir).isDirectory() && existsSync(s.file);
        } catch { return false; /* statSync失敗時はエントリをフィルタアウト */ }
      });
  } catch { return []; /* readdirSync失敗時（アクセス不可等）は空配列を返す */ }
}

/**
 * ファイルの最終更新日からの日数を返す
 * @param {string} filePath
 * @returns {number}
 */
function getDaysOld(filePath) {
  try {
    const mtime = statSync(filePath).mtime;
    return Math.floor((Date.now() - mtime.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return -1; /* statSync失敗時は-1を返して「経過日数不明」として扱う */
  }
}

/**
 * ファイルの最終更新日を YYYY-MM-DD 形式で返す
 * @param {string} filePath
 * @returns {string}
 */
function getLastModified(filePath) {
  try {
    const mtime = statSync(filePath).mtime;
    return mtime.toISOString().slice(0, 10);
  } catch {
    return '不明'; /* statSync失敗時は「不明」を返す */
  }
}

// --- モード1: タグ分析+スキル化候補 ---

function doAnalyze() {
  const tags = getTags();

  // v2.3.0: --for 指定時は allowedTags でフィルタ
  if (allowedTags) {
    for (const tag of [...tags.keys()]) {
      if (!allowedTags.has(tag)) tags.delete(tag);
    }
  }

  if (jsonMode) {
    const tagList = [...tags.entries()].map(([tag, count]) => ({ tag, count }));
    const candidates = tagList.filter(t => t.count >= THRESHOLD).map(t => ({
      ...t,
      headings: getLessonHeadingsForTag(t.tag).slice(0, 3)
    }));
    return { mode: 'analyze', threshold: THRESHOLD, tags: tagList, candidates };
  }

  console.log(`📊 教訓タグ分析（閾値: ${THRESHOLD}回以上）`);
  console.log('================================================');

  if (tags.size === 0) {
    console.log('  タグなし（教訓ファイルが空）');
    return;
  }

  console.log('');
  console.log('タグ出現回数:');
  for (const [tag, count] of tags) {
    console.log(`  ${String(count).padStart(3)}回  ${tag}`);
  }

  console.log('');
  console.log('================================================');

  const candidates = [...tags.entries()].filter(([, count]) => count >= THRESHOLD);

  if (candidates.length === 0) {
    console.log(`✅ スキル化候補なし（全タグが${THRESHOLD}回未満）`);
    return;
  }

  console.log(`🔔 スキル化候補（${THRESHOLD}回以上出現）:`);
  console.log('');

  for (const [tag, count] of candidates) {
    console.log(`  📌 ${tag} (${count}回)`);
    const headings = getLessonHeadingsForTag(tag).slice(0, 3);
    for (const h of headings) {
      console.log(`     └ ${h}`);
    }
    console.log('');
  }

  console.log('💡 提案: 上記タグに共通するパターンをスキル化すると、同種の問題を予防できる可能性があります。');
  console.log('   → /skill-creator で検討してください。');
}

// --- モード2: 既存スキルとの差分分析 ---

function doSync() {
  let skills = getChecklistSkills();

  // v2.3.0: --for 指定時は allowedTags で skills をフィルタ
  if (allowedTags) {
    skills = skills.filter(skill => {
      const tagName = skill.name.replace(/-checklist$/, '');
      return allowedTags.has(`[${tagName}]`);
    });
  }

  if (jsonMode) {
    const results = skills.map(skill => {
      const tagName = skill.name.replace(/-checklist$/, '');
      const tag = `[${tagName}]`;
      const skillItems = getSkillItems(skill.file);
      const lessonHeadings = getLessonHeadingsForTag(tag);
      const unreflected = [];

      for (const heading of lessonHeadings) {
        const keywords = heading
          .replace(/^###\s*/, '')
          .replace(/`\[[^\]]*\]`/g, '')
          .replace(/（.*）/g, '')
          .split(/[\s　・]+/)
          .filter(w => w.length >= 2)
          .slice(0, 3);

        let skillContent;
        try { skillContent = readFileSync(skill.file, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { skillContent = ''; }
        const matched = keywords.some(w => skillContent.includes(w));
        if (!matched && keywords.length > 0) {
          unreflected.push(heading);
        }
      }

      return {
        skill: skill.name,
        tag,
        skillItemCount: skillItems.length,
        lessonCount: lessonHeadings.length,
        unreflected,
        lastModified: getLastModified(skill.file)
      };
    });
    return { mode: 'sync', skills: results };
  }

  console.log('🔄 スキル⇔教訓 差分分析');
  console.log('================================================');

  if (skills.length === 0) {
    console.log('');
    console.log('  教訓ベースのスキル（*-checklist）が見つかりません。');
    console.log('  先に --analyze でスキル化候補を確認してください。');
    return;
  }

  for (const skill of skills) {
    const tagName = skill.name.replace(/-checklist$/, '');
    const tag = `[${tagName}]`;

    console.log('');
    console.log(`📋 スキル: ${skill.name}`);
    console.log(`   対応タグ: ${tag}`);

    const skillItems = getSkillItems(skill.file);
    console.log(`   チェック項目数: ${skillItems.length}`);

    const lessonHeadings = getLessonHeadingsForTag(tag);
    console.log(`   教訓エントリ数: ${lessonHeadings.length}`);

    // 教訓がスキルに反映されているか簡易チェック
    let skillContent;
    try { skillContent = readFileSync(skill.file, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { skillContent = ''; }

    for (const heading of lessonHeadings) {
      const keywords = heading
        .replace(/^###\s*/, '')
        .replace(/`\[[^\]]*\]`/g, '')
        .replace(/（.*）/g, '')
        .split(/[\s　・]+/)
        .filter(w => w.length >= 2)
        .slice(0, 3);

      const matched = keywords.some(w => skillContent.includes(w));
      if (!matched && keywords.length > 0) {
        console.log(`   ⚠️ 未反映の可能性: ${heading}`);
      }
    }

    console.log(`   最終更新: ${getLastModified(skill.file)}`);
    console.log('   ---');
  }
}

// --- モード3: スキル健全性チェック ---

function doHealth() {
  let skills = getChecklistSkills();

  // v2.3.0: --for 指定時は allowedTags で skills をフィルタ
  if (allowedTags) {
    skills = skills.filter(skill => {
      const tagName = skill.name.replace(/-checklist$/, '');
      return allowedTags.has(`[${tagName}]`);
    });
  }

  if (jsonMode) {
    const allContent = readAllLessons();
    const results = skills.map(skill => {
      const tagName = skill.name.replace(/-checklist$/, '');
      const tagRegex = new RegExp(`\\[${tagName}\\]`, 'g');
      const tagCount = (allContent.match(tagRegex) || []).length;
      const itemCount = getSkillItems(skill.file).length;
      const daysOld = getDaysOld(skill.file);

      let status = 'healthy';
      let note = '';
      if (tagCount < 3) {
        status = 'orphan';
        note = `教訓が3件未満（${tagCount}件）→ スキル化の根拠が薄い`;
      } else if (daysOld > 30) {
        status = 'stale';
        note = `30日以上未更新（${daysOld}日）→ 最新の教訓が反映されていない可能性`;
      }

      return { skill: skill.name, tagCount, itemCount, daysOld, status, note };
    });

    const healthy = results.filter(r => r.status === 'healthy').length;
    const stale = results.filter(r => r.status === 'stale').length;
    const orphan = results.filter(r => r.status === 'orphan').length;
    return { mode: 'health', total: results.length, healthy, stale, orphan, skills: results };
  }

  console.log('🏥 スキル健全性チェック');
  console.log('================================================');

  if (skills.length === 0) {
    console.log('');
    console.log('  教訓ベースのスキル（*-checklist）がありません。');
    return;
  }

  const allContent = readAllLessons();
  let total = 0, healthy = 0, stale = 0, orphan = 0;

  for (const skill of skills) {
    total++;
    const tagName = skill.name.replace(/-checklist$/, '');
    const tagRegex = new RegExp(`\\[${tagName}\\]`, 'g');
    const tagCount = (allContent.match(tagRegex) || []).length;
    const itemCount = getSkillItems(skill.file).length;
    const daysOld = getDaysOld(skill.file);

    let status = '✅';
    let note = '';
    if (tagCount < 3) {
      status = '⚠️';
      note = `教訓が3件未満（${tagCount}件）→ スキル化の根拠が薄い`;
      orphan++;
    } else if (daysOld > 30) {
      status = '🔄';
      note = `30日以上未更新（${daysOld}日）→ 最新の教訓が反映されていない可能性`;
      stale++;
    } else {
      healthy++;
    }

    const line = `  ${status} ${skill.name.padEnd(25)}  項目:${String(itemCount).padStart(2)}  教訓:${String(tagCount).padStart(2)}  更新:${daysOld}日前`;
    if (note) {
      console.log(`${line}  (${note})`);
    } else {
      console.log(line);
    }
  }

  console.log('');
  console.log('================================================');
  console.log(`合計: ${total}スキル（✅健全:${healthy} / 🔄要更新:${stale} / ⚠️根拠薄:${orphan}）`);
}

// --- モード4: トレーサビリティマップ ---

function doMap() {
  let skills = getChecklistSkills();

  // v2.3.0: --for 指定時は allowedTags で skills をフィルタ
  if (allowedTags) {
    skills = skills.filter(skill => {
      const tagName = skill.name.replace(/-checklist$/, '');
      return allowedTags.has(`[${tagName}]`);
    });
  }

  if (jsonMode) {
    const skillMap = skills.map(skill => {
      const tagName = skill.name.replace(/-checklist$/, '');
      const tag = `[${tagName}]`;
      const sections = getLessonSectionsForTag(tag);
      return {
        skill: skill.name,
        tag,
        itemCount: getSkillItems(skill.file).length,
        sections: sections.map(s => ({ heading: s.heading, body: s.body }))
      };
    });

    const tags = getTags();
    // v2.3.0: --for 指定時は tags 側も allowedTags でフィルタ
    if (allowedTags) {
      for (const tag of [...tags.keys()]) {
        if (!allowedTags.has(tag)) tags.delete(tag);
      }
    }
    const skilledTags = new Set(skills.map(s => s.name.replace(/-checklist$/, '')));
    const unSkilledCandidates = [...tags.entries()]
      .filter(([tag, count]) => {
        const tagClean = tag.replace(/^\[|\]$/g, '');
        return count >= THRESHOLD && !skilledTags.has(tagClean);
      })
      .map(([tag, count]) => {
        const sections = getLessonSectionsForTag(tag);
        return { tag, count, sections: sections.slice(0, 5).map(s => ({ heading: s.heading, body: s.body })) };
      });

    return { mode: 'map', threshold: THRESHOLD, skilled: skillMap, candidates: unSkilledCandidates };
  }

  console.log('📗 スキル⇔教訓 トレーサビリティマップ');
  console.log('================================================');

  if (skills.length === 0) {
    console.log('');
    console.log('  スキル化済みの教訓はありません。');
  } else {
    const skilledTags = new Set();

    for (const skill of skills) {
      const tagName = skill.name.replace(/-checklist$/, '');
      const tag = `[${tagName}]`;
      skilledTags.add(tagName);

      const itemCount = getSkillItems(skill.file).length;
      console.log('');
      console.log(`📋 ${skill.name} (${itemCount}項目)`);
      console.log('   根拠教訓:');

      const sections = getLessonSectionsForTag(tag);
      for (const section of sections) {
        console.log('');
        console.log(`   ${section.num}. ${section.heading}`);
        for (const bodyLine of section.body) {
          console.log(`      ${bodyLine}`);
        }
      }
      console.log('');
    }

    // 未スキル化候補
    console.log('');
    console.log('================================================');
    console.log(`🔮 未スキル化の教訓（${THRESHOLD}回以上、候補）:`);
    console.log('');

    const tags = getTags();
    // v2.3.0: --for 指定時は tags 側も allowedTags でフィルタ
    if (allowedTags) {
      for (const tag of [...tags.keys()]) {
        if (!allowedTags.has(tag)) tags.delete(tag);
      }
    }
    const skilledTagsFromSkills = new Set(skills.map(s => s.name.replace(/-checklist$/, '')));

    let hasCandidates = false;
    for (const [tag, count] of tags) {
      if (count < THRESHOLD) continue;
      const tagClean = tag.replace(/^\[|\]$/g, '');
      if (skilledTagsFromSkills.has(tagClean)) continue;

      hasCandidates = true;
      console.log(`  📌 ${tag} (${count}回) → 「${tagClean}-checklist」として検討？`);
      const sections = getLessonSectionsForTag(tag).slice(0, 5);
      for (const section of sections) {
        console.log('');
        console.log(`   ${section.num}. ${section.heading}`);
        for (const bodyLine of section.body) {
          console.log(`      ${bodyLine}`);
        }
      }
      console.log('');
    }

    if (!hasCandidates) {
      console.log('  （候補なし）');
    }
  }

  console.log('');
  console.log('💬 判断ポイント:');
  console.log('   「これは別スキルにしたい」「このスキル名を変えたい」等あれば指示してください。');
  console.log('   → /skill-creator で作成できます。');
}

// --- --all モード ---

function doAll() {
  if (jsonMode) {
    const result = {
      mode: 'all',
      analyze: doAnalyze(),
      sync: doSync(),
      health: doHealth(),
      map: doMap()
    };
    // v2.3.0: --for 指定時のみトップレベルに stack を 1 回付与
    if (stackMetadata) {
      result.stack = stackMetadata;
    }
    return result;
  }

  doAnalyze();
  console.log('');
  console.log('');
  doSync();
  console.log('');
  console.log('');
  doHealth();
  console.log('');
  console.log('');
  doMap();
}

// --- エントリポイント ---

/**
 * v2.3.0: --for <path> の入力検証 + スタック検出 + グローバル変数セット
 * 呼び出し側で projectDir が空でない場合のみ実行される
 */
function applyStackFilter() {
  const resolved = resolve(projectDir);

  if (!existsSync(resolved)) {
    if (jsonMode) {
      console.log(JSON.stringify({ error: '--for path not found', path: resolved }));
    } else {
      console.error(`❌ --for パスが存在しません: ${resolved}`);
    }
    process.exit(1);
  }

  let stat;
  try {
    stat = statSync(resolved);
  } catch (e) {
    const reason = e && e.message ? String(e.message) : String(e);
    if (jsonMode) {
      console.log(JSON.stringify({ error: '--for stat failed', path: resolved, reason }));
    } else {
      console.error(`❌ --for パスの状態取得に失敗: ${resolved}`);
      console.error(`   ${reason}`);
    }
    process.exit(1);
  }

  if (!stat.isDirectory()) {
    if (jsonMode) {
      console.log(JSON.stringify({ error: '--for expects a directory, got file', path: resolved }));
    } else {
      console.error(`❌ --for はディレクトリパスを要求します（ファイルが渡されました）: ${resolved}`);
    }
    process.exit(1);
  }

  const detectedStack = detectStack(resolved);
  const computedTags = stackToAllowedTags(detectedStack);

  if (computedTags.size === 0) {
    if (!jsonMode) {
      console.log(`⚠️  スタック未検出または未対応: ${resolved}`);
      console.log(`   → フィルタなしで実行します（全教訓対象）`);
      if (detectedStack.errors.length > 0) {
        console.log(`   ⚠️  パース失敗: ${detectedStack.errors.map(e => e.file).join(', ')}`);
      }
      console.log('');
    }
    // allowedTags は null のまま、stackMetadata も生成する（JSON 出力で情報提示のため）
    stackMetadata = buildStackMetadata(resolved, detectedStack);
    return;
  }

  allowedTags = computedTags;
  stackMetadata = buildStackMetadata(resolved, detectedStack);

  if (!jsonMode) {
    const softTags = stackToSoftTags(detectedStack);
    console.log(`🔍 スタック検出: ${detectedStack.sources.join(', ')}`);
    console.log(`   言語: ${detectedStack.languages.join(', ') || '(なし)'}`);
    const techs = detectedStack.technologies;
    const techHead = techs.slice(0, 10).join(', ');
    const techExtra = techs.length > 10 ? ` ... (+${techs.length - 10})` : '';
    console.log(`   技術: ${techHead}${techExtra}`);
    console.log(`   hardTags (${allowedTags.size}): ${[...allowedTags].join(' ')}`);
    if (softTags.size > 0) {
      const softArr = [...softTags];
      const softHead = softArr.slice(0, 8).join(' ');
      const softExtra = softArr.length > 8 ? ' ...' : '';
      console.log(`   softTags (${softTags.size}): ${softHead}${softExtra}`);
    }
    if (detectedStack.errors.length > 0) {
      console.log(`   ⚠️  パース失敗: ${detectedStack.errors.map(e => e.file).join(', ')}`);
    }
    console.log('');
  }
}

async function main() {
  // --self-update: ツール自身を更新して終了
  if (selfUpdateMode) {
    await selfUpdate();
    return;
  }

  // v2.3.0: --for 指定時のみスタック検出とフィルタ適用
  // LESSON_FILES 空チェックより先に実行する（--for 専用エラー契約の保証）
  if (projectDir) {
    applyStackFilter();
  }

  // v2.3.0: LESSON_FILES 空チェック（--for 検証の後段）
  if (LESSON_FILES.length === 0) {
    if (jsonMode) {
      console.log(JSON.stringify({ error: 'No lesson files found', path: SCAN_PATHS }));
    } else {
      console.error(`教訓ファイルが見つかりません: ${SCAN_PATHS}`);
    }
    process.exit(1);
  }

  if (jsonMode) {
    let result;
    switch (mode) {
      case 'analyze': result = doAnalyze(); break;
      case 'sync':    result = doSync();    break;
      case 'health':  result = doHealth();  break;
      case 'map':     result = doMap();     break;
      case 'all':     result = doAll();     break;
    }
    // v2.3.0: 単体モードでは stack をトップレベルに差し込む（doAll は内部で処理済み）
    if (stackMetadata && mode !== 'all') {
      result = { ...result, stack: stackMetadata };
    }
    console.log(JSON.stringify(result, null, 2));
  } else {
    switch (mode) {
      case 'analyze': doAnalyze(); break;
      case 'sync':    doSync();    break;
      case 'health':  doHealth();  break;
      case 'map':     doMap();     break;
      case 'all':     doAll();     break;
    }

    // npmバージョンチェック（--no-version-check / --json では非表示）
    if (!noVersionCheck) {
      const current = getCurrentVersion();
      if (current) {
        const latest = getLatestVersion();
        if (latest && isNewer(current, latest)) {
          console.log(`\n💡 新バージョン v${latest} が利用可能です（現在 v${current}）`);
          console.log(`   更新: npm install -g claude-skill-loop@latest`);
          console.log(`   または: npx claude-skill-loop@latest [options]`);
        }
      }
    }
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(2);
});
