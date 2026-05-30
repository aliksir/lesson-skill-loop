/**
 * skill-loop.test.mjs — lesson-skill-loop v2.2.0 自動テスト
 *
 * node:test + node:assert を使用（依存ゼロ維持）
 * 実行: node --test test/skill-loop.test.mjs
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'skill-loop.js');
const EXAMPLES_LESSONS = join(__dirname, '..', 'examples', 'lessons');

// --- ヘルパー ---

/**
 * skill-loop.mjs を同期実行して結果を返す
 * @param {string[]} args
 * @param {object} [opts]
 * @returns {{ stdout: string, stderr: string, status: number }}
 */
function run(args = [], opts = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf-8',
    cwd: opts.cwd || join(__dirname, '..'),
    env: { ...process.env, ...(opts.env || {}) },
    timeout: 10000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status ?? -1,
  };
}

/**
 * 一時教訓ディレクトリを作成してファイルを書き込む
 * @param {Record<string, string>} files ファイル名→内容
 * @returns {string} 一時ディレクトリパス
 */
function makeTempLessons(files) {
  const dir = join(tmpdir(), `skill-loop-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf-8');
  }
  return dir;
}

// v2.4.3: v2.4.2 で 2 つの describe (--jaccard-min / --execute) で重複定義していた
// `sharedBody` と `makeMergePair` をモジュールスコープに共通化（kurouto Findings F2 対応）
const MERGE_PAIR_SHARED_BODY = 'rate limiting exponential backoff retry api integration testing authentication headers ratelimit';

function makeMergePair() {
  return makeTempLessons({
    'a.md': `# API Rate Limiting Lesson\n\`[api]\` \`[harness]\`\n\n## 概要\n\n${MERGE_PAIR_SHARED_BODY} for client implementations.\n`,
    'b.md': `# API Backoff Lesson\n\`[api]\` \`[harness]\`\n\n## 概要\n\n${MERGE_PAIR_SHARED_BODY} for server side.\n`,
  });
}

// =============================================================================
// 1. --help フラグ
// =============================================================================

describe('--help', () => {
  test('--help: exit 0', () => {
    const { status } = run(['--help']);
    assert.equal(status, 0);
  });

  test('--help: Usageを含む', () => {
    const { stdout } = run(['--help']);
    assert.ok(stdout.includes('Usage'), `stdout に "Usage" が含まれていない:\n${stdout}`);
  });

  test('-h: --help と同等', () => {
    const { status, stdout } = run(['-h']);
    assert.equal(status, 0);
    assert.ok(stdout.includes('Usage'));
  });
});

// =============================================================================
// 2. analyze モード（デフォルト）
// =============================================================================

describe('analyze モード', () => {
  test('正常系: examples/lessons でexit 0', () => {
    const { status } = run([EXAMPLES_LESSONS, '--no-version-check']);
    assert.equal(status, 0);
  });

  test('正常系: タグ分析の出力を含む', () => {
    const { stdout } = run([EXAMPLES_LESSONS, '--no-version-check']);
    assert.ok(stdout.includes('タグ出現回数') || stdout.includes('タグなし'), `stdout:\n${stdout}`);
  });

  test('正常系: スキル化候補セクションが存在する', () => {
    const { stdout } = run([EXAMPLES_LESSONS, '--no-version-check']);
    // 候補あり または 候補なし のどちらかが出力される
    const hasCandidates = stdout.includes('スキル化候補') || stdout.includes('スキル化候補なし');
    assert.ok(hasCandidates, `stdout:\n${stdout}`);
  });
});

// =============================================================================
// 3. --sync モード
// =============================================================================

describe('--sync モード', () => {
  test('正常系: exit 0', () => {
    const { status } = run(['--sync', EXAMPLES_LESSONS, '--no-version-check']);
    assert.equal(status, 0);
  });

  test('正常系: 差分分析の出力を含む', () => {
    const { stdout } = run(['--sync', EXAMPLES_LESSONS, '--no-version-check']);
    assert.ok(stdout.includes('差分分析') || stdout.includes('スキル（*-checklist）'), `stdout:\n${stdout}`);
  });
});

// =============================================================================
// 4. --health モード
// =============================================================================

describe('--health モード', () => {
  test('正常系: exit 0', () => {
    const { status } = run(['--health', EXAMPLES_LESSONS, '--no-version-check']);
    assert.equal(status, 0);
  });

  test('正常系: 健全性チェックの出力を含む', () => {
    const { stdout } = run(['--health', EXAMPLES_LESSONS, '--no-version-check']);
    assert.ok(stdout.includes('健全性') || stdout.includes('スキル（*-checklist）'), `stdout:\n${stdout}`);
  });
});

// =============================================================================
// 5. --map モード
// =============================================================================

describe('--map モード', () => {
  test('正常系: exit 0', () => {
    const { status } = run(['--map', EXAMPLES_LESSONS, '--no-version-check']);
    assert.equal(status, 0);
  });

  test('正常系: トレーサビリティマップの出力を含む', () => {
    const { stdout } = run(['--map', EXAMPLES_LESSONS, '--no-version-check']);
    assert.ok(stdout.includes('トレーサビリティ') || stdout.includes('スキル化済みの教訓はありません'), `stdout:\n${stdout}`);
  });
});

// =============================================================================
// 6. --all モード
// =============================================================================

describe('--all モード', () => {
  test('正常系: exit 0', () => {
    const { status } = run(['--all', EXAMPLES_LESSONS, '--no-version-check']);
    assert.equal(status, 0);
  });
});

// =============================================================================
// 7. --json 出力
// =============================================================================

describe('--json 出力', () => {
  test('analyze --json: パース可能', () => {
    const { stdout, status } = run(['--json', EXAMPLES_LESSONS, '--no-version-check']);
    assert.equal(status, 0);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(stdout); }, `stdout が JSON でない:\n${stdout}`);
    assert.ok(parsed, 'parsed が falsy');
  });

  test('analyze --json: mode フィールドが "analyze"', () => {
    const { stdout } = run(['--json', EXAMPLES_LESSONS, '--no-version-check']);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.mode, 'analyze');
  });

  test('analyze --json: tags 配列が存在する', () => {
    const { stdout } = run(['--json', EXAMPLES_LESSONS, '--no-version-check']);
    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed.tags), `tags が配列でない: ${JSON.stringify(parsed)}`);
  });

  test('analyze --json: candidates 配列が存在する', () => {
    const { stdout } = run(['--json', EXAMPLES_LESSONS, '--no-version-check']);
    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed.candidates), `candidates が配列でない: ${JSON.stringify(parsed)}`);
  });

  test('sync --json: mode フィールドが "sync"', () => {
    const { stdout } = run(['--sync', '--json', EXAMPLES_LESSONS, '--no-version-check']);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.mode, 'sync');
  });

  test('health --json: mode フィールドが "health"', () => {
    const { stdout } = run(['--health', '--json', EXAMPLES_LESSONS, '--no-version-check']);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.mode, 'health');
  });

  test('map --json: mode フィールドが "map"', () => {
    const { stdout } = run(['--map', '--json', EXAMPLES_LESSONS, '--no-version-check']);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.mode, 'map');
  });

  test('all --json: analyze/sync/health/map キーが存在する', () => {
    const { stdout } = run(['--all', '--json', EXAMPLES_LESSONS, '--no-version-check']);
    const parsed = JSON.parse(stdout);
    assert.ok('analyze' in parsed, 'analyze キーがない');
    assert.ok('sync' in parsed, 'sync キーがない');
    assert.ok('health' in parsed, 'health キーがない');
    assert.ok('map' in parsed, 'map キーがない');
  });
});

// =============================================================================
// 8. タグ正規表現: チェックボックス除外
// =============================================================================

describe('タグ正規表現（チェックボックス除外）', () => {
  test('[x] はタグとしてカウントされない', () => {
    const dir = makeTempLessons({
      'test.md': [
        '### Some heading `[api]`',
        '- [x] done item',
        '- [ ] todo item',
        '',
        '### Another heading `[api]`',
        '- [x] another done',
        '',
        '### Third heading `[api]`',
        '- [N/A] not applicable',
      ].join('\n'),
    });

    try {
      const { stdout, status } = run(['--json', dir, '--no-version-check']);
      assert.equal(status, 0, `stderr: ${run(['--json', dir, '--no-version-check']).stderr}`);
      const parsed = JSON.parse(stdout);
      const tagNames = parsed.tags.map(t => t.tag);

      // [api] はカウントされる（3回出現）
      assert.ok(tagNames.includes('[api]'), `[api] がタグ一覧にない: ${JSON.stringify(tagNames)}`);

      // [x], [ ], [N/A] はカウントされない
      assert.ok(!tagNames.includes('[x]'), `[x] がタグとして検出された（誤検出）`);
      assert.ok(!tagNames.includes('[ ]'), `[ ] がタグとして検出された（誤検出）`);
      assert.ok(!tagNames.includes('[N/A]'), `[N/A] がタグとして検出された（誤検出）`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('本文行のタグはカウントされない（見出し行のみ対象）', () => {
    const dir = makeTempLessons({
      'test.md': [
        '### Heading one `[real-tag]`',
        '- This body mentions [real-tag] but should not be double-counted',
        '- And [another-tag] in body should not be counted at all',
        '',
        '### Heading two `[real-tag]`',
        '- Body [real-tag] again',
        '',
        '### Heading three `[real-tag]`',
      ].join('\n'),
    });

    try {
      const { stdout, status } = run(['--json', dir, '--no-version-check']);
      assert.equal(status, 0);
      const parsed = JSON.parse(stdout);
      const tagEntry = parsed.tags.find(t => t.tag === '[real-tag]');

      // 見出し行に3回出現 → count = 3（本文行は含まない）
      assert.ok(tagEntry, `[real-tag] がタグ一覧にない: ${JSON.stringify(parsed.tags)}`);
      assert.equal(tagEntry.count, 3, `count が 3 でない: ${tagEntry.count}（本文行も含まれている可能性）`);

      // [another-tag] は本文行のみ → カウントされない
      const anotherEntry = parsed.tags.find(t => t.tag === '[another-tag]');
      assert.ok(!anotherEntry, `[another-tag] がタグとして検出された（本文行のみのはず）`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('チェックリスト本文でよく使われるパターンが誤検出されない', () => {
    // gates.md スタイルのファイル（チェックリスト系）
    const dir = makeTempLessons({
      'checklist.md': [
        '### Deployment Checklist `[deploy]`',
        '- [x] Build complete',
        '- [x] Tests passed',
        '- [ ] Deploy to staging',
        '- [ ] Smoke test',
        '',
        '### Release Notes `[deploy]`',
        '- [x] Changelog updated',
        '',
        '### Rollback Plan `[deploy]`',
        '- [x] Rollback procedure documented',
      ].join('\n'),
    });

    try {
      const { stdout, status } = run(['--json', dir, '--no-version-check']);
      assert.equal(status, 0);
      const parsed = JSON.parse(stdout);
      const tagNames = parsed.tags.map(t => t.tag);

      assert.ok(tagNames.includes('[deploy]'), `[deploy] がタグ一覧にない`);
      assert.ok(!tagNames.includes('[x]'), `[x] が誤検出された`);
      assert.ok(!tagNames.includes('[ ]'), `[ ] が誤検出された`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =============================================================================
// 9. exitコード: ファイルなし時は exit 1
// =============================================================================

describe('exitコード', () => {
  test('存在しないディレクトリ: exit 1', () => {
    const { status } = run(['/nonexistent/path/that/does/not/exist']);
    assert.equal(status, 1, `exit code が 1 でない: ${status}`);
  });

  test('存在しないディレクトリ --json: exit 1', () => {
    const { status } = run(['--json', '/nonexistent/path/that/does/not/exist']);
    assert.equal(status, 1, `exit code が 1 でない: ${status}`);
  });

  test('存在しないディレクトリ --json: error フィールドを含む', () => {
    const { stdout, status } = run(['--json', '/nonexistent/path/that/does/not/exist']);
    assert.equal(status, 1);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(stdout); }, `stdout が JSON でない:\n${stdout}`);
    assert.ok(parsed.error, `error フィールドがない: ${JSON.stringify(parsed)}`);
  });

  test('空ディレクトリ（.mdファイルなし）: exit 1', () => {
    const dir = makeTempLessons({ 'readme.txt': 'no md files here' });
    try {
      const { status } = run([dir]);
      assert.equal(status, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =============================================================================
// 10. --threshold フラグ
// =============================================================================

describe('--threshold フラグ', () => {
  test('--threshold 1: 全タグがスキル化候補になる', () => {
    const { stdout, status } = run(['--json', '--threshold', '1', EXAMPLES_LESSONS, '--no-version-check']);
    assert.equal(status, 0);
    const parsed = JSON.parse(stdout);
    // 教訓ファイルにタグがあれば、threshold=1で全タグがcandidatesに入る
    assert.ok(parsed.candidates.length >= parsed.tags.length,
      `threshold=1でもcandidatesがtags以下: candidates=${parsed.candidates.length}, tags=${parsed.tags.length}`);
  });

  test('--threshold 999: スキル化候補なし', () => {
    const { stdout, status } = run(['--json', '--threshold', '999', EXAMPLES_LESSONS, '--no-version-check']);
    assert.equal(status, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.candidates.length, 0, `threshold=999でもcandidatesがある: ${JSON.stringify(parsed.candidates)}`);
  });
});

// =============================================================================
// 11. バージョン関連関数（間接テスト）
// =============================================================================

describe('バージョン管理（--no-version-check）', () => {
  test('--no-version-check: バージョン通知が出ない', () => {
    const { stdout } = run([EXAMPLES_LESSONS, '--no-version-check']);
    assert.ok(!stdout.includes('新バージョン'), `--no-version-check なのにバージョン通知が出た:\n${stdout}`);
  });
});

// =============================================================================
// 12. --dir フラグ（位置引数と同等）
// =============================================================================

describe('--dir フラグ', () => {
  test('--dir: 位置引数と同じ結果', () => {
    const { stdout: positional } = run([EXAMPLES_LESSONS, '--json', '--no-version-check']);
    const { stdout: flag } = run(['--dir', EXAMPLES_LESSONS, '--json', '--no-version-check']);

    const p = JSON.parse(positional);
    const f = JSON.parse(flag);

    assert.deepEqual(p.tags, f.tags, '--dir と位置引数でタグが異なる');
  });
});

// =============================================================================
// v2.3.0: スタック検出ブリッジ (--for オプション)
// =============================================================================

/**
 * fixture プロジェクトを一時ディレクトリに作る
 * @param {Record<string, string>} files ファイル名→内容
 * @returns {string} プロジェクトディレクトリの絶対パス
 */
function makeTempProject(files) {
  const dir = join(tmpdir(), `skill-loop-proj-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf-8');
  }
  return dir;
}

/**
 * 一時教訓ディレクトリを作って特定タグの教訓 3 件を持たせる
 */
function makeTempLessonsWithTag(tag) {
  return makeTempLessons({
    'lessons.md': [
      '# Lessons',
      '',
      `### Topic One \`[${tag}]\``,
      '- Content 1',
      '',
      `### Topic Two \`[${tag}]\``,
      '- Content 2',
      '',
      `### Topic Three \`[${tag}]\``,
      '- Content 3',
      ''
    ].join('\n')
  });
}

describe('v2.3.0: --for スタック検出 - package.json', () => {
  test('React + Next.js + TypeScript が検出される', () => {
    const proj = makeTempProject({
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0', next: '^14.0.0' },
        devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' }
      })
    });
    const lessons = makeTempLessonsWithTag('react');
    const r = run(['--for', proj, '--json', '--no-version-check', lessons]);
    assert.equal(r.status, 0);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack, 'stack フィールドが付与される');
    assert.ok(json.stack.technologies.includes('react'));
    assert.ok(json.stack.technologies.includes('next'));
    assert.ok(json.stack.technologies.includes('typescript'));
    assert.ok(json.stack.technologies.includes('vitest'));
    assert.ok(json.stack.languages.includes('javascript'));
    assert.ok(json.stack.sources.includes('package.json'));
  });

  test('dependencies のみ (devDependencies なし) でも動作', () => {
    const proj = makeTempProject({
      'package.json': JSON.stringify({ dependencies: { vue: '^3.0.0' } })
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    assert.equal(r.status, 0);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('vue'));
  });

  test('空の package.json で検出ゼロ', () => {
    const proj = makeTempProject({ 'package.json': '{}' });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    assert.equal(r.status, 0);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack);
    assert.deepEqual(json.stack.technologies, []);
  });

  test('不正な package.json は errors に記録される', () => {
    const proj = makeTempProject({ 'package.json': '{ invalid json' });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    assert.equal(r.status, 0);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.errors.length > 0);
    assert.equal(json.stack.errors[0].file, 'package.json');
  });
});

describe('v2.3.0: --for スタック検出 - requirements.txt', () => {
  test('FastAPI + Pydantic + pytest が検出される', () => {
    const proj = makeTempProject({
      'requirements.txt': 'fastapi==0.104.0\npydantic>=2.0\n# comment\npytest'
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(json.stack.technologies.includes('pydantic'));
    assert.ok(json.stack.technologies.includes('pytest'));
  });

  test('コメント行と -r 指令は除外される', () => {
    const proj = makeTempProject({
      'requirements.txt': '# header\n-r other.txt\nfastapi\npydantic'
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(json.stack.technologies.includes('pydantic'));
    assert.ok(!json.stack.technologies.includes('#'));
    assert.ok(!json.stack.technologies.includes('other.txt'));
  });
});

describe('v2.3.0: --for スタック検出 - pyproject.toml', () => {
  test('[tool.poetry.dependencies] の依存を抽出', () => {
    const proj = makeTempProject({
      'pyproject.toml': [
        '[tool.poetry.dependencies]',
        'python = "^3.10"',
        'fastapi = "^0.104.0"',
        'pydantic = "^2.0"',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(json.stack.technologies.includes('pydantic'));
    assert.ok(!json.stack.technologies.includes('python'));
  });

  test('[project].dependencies 配列（PEP 621）を抽出', () => {
    const proj = makeTempProject({
      'pyproject.toml': [
        '[project]',
        'name = "app"',
        'dependencies = ["fastapi>=0.104", "pydantic>=2.0"]',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(json.stack.technologies.includes('pydantic'));
  });

  test('[[tool.poetry.source]] array-of-tables でセクションが誤爆しない', () => {
    const proj = makeTempProject({
      'pyproject.toml': [
        '[tool.poetry.dependencies]',
        'python = "^3.10"',
        'fastapi = "^0.104"',
        '',
        '[[tool.poetry.source]]',
        'name = "pypi-mirror"',
        'url = "https://pypi.org/simple"',
        '',
        '[tool.poetry.dev-dependencies]',
        'pytest = "^7.0"',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    // array-of-tables の name/url/pypi-mirror を誤って依存として拾わない
    assert.ok(!json.stack.technologies.includes('pypi-mirror'));
    assert.ok(!json.stack.technologies.includes('name'));
    assert.ok(!json.stack.technologies.includes('url'));
  });

  test('セクション見出し末尾のコメント対応', () => {
    const proj = makeTempProject({
      'pyproject.toml': [
        '[project] # main project metadata',
        'name = "app"',
        'dependencies = ["fastapi"]',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
  });
});

describe('v2.3.0: --for スタック検出 - Pipfile', () => {
  test('[packages] セクションから抽出', () => {
    const proj = makeTempProject({
      'Pipfile': [
        '[packages]',
        'fastapi = "*"',
        'pydantic = "*"',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(json.stack.technologies.includes('pydantic'));
  });
});

describe('v2.3.0: --for スタック検出 - Cargo.toml', () => {
  test('[dependencies] インライン形式を検出', () => {
    const proj = makeTempProject({
      'Cargo.toml': [
        '[package]',
        'name = "app"',
        '',
        '[dependencies]',
        'tokio = "1.0"',
        'serde = { version = "1.0" }',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('tokio'));
    assert.ok(json.stack.technologies.includes('serde'));
  });

  test('[dependencies.foo] テーブル形式を検出', () => {
    const proj = makeTempProject({
      'Cargo.toml': [
        '[dependencies]',
        'serde = "1.0"',
        '',
        '[dependencies.axum]',
        'version = "0.7"',
        'features = ["macros"]',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('serde'));
    assert.ok(json.stack.technologies.includes('axum'));
  });

  test('[workspace.dependencies] を検出', () => {
    const proj = makeTempProject({
      'Cargo.toml': [
        '[workspace]',
        'members = ["crates/*"]',
        '',
        '[workspace.dependencies]',
        'tokio = { version = "1.0" }',
        'axum = "0.7"',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('tokio'));
    assert.ok(json.stack.technologies.includes('axum'));
  });

  test('[build-dependencies] を検出', () => {
    const proj = makeTempProject({
      'Cargo.toml': [
        '[package]',
        'name = "app"',
        '',
        '[build-dependencies]',
        'cc = "1.0"',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('cc'));
  });
});

describe('v2.3.0: --for スタック検出 - go.mod', () => {
  test('require ブロックから依存を検出（最終パスセグメント）', () => {
    const proj = makeTempProject({
      'go.mod': [
        'module example.com/app',
        '',
        'go 1.21',
        '',
        'require (',
        '  github.com/gin-gonic/gin v1.9.1',
        '  github.com/stretchr/testify v1.8.4',
        ')',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('gin'));
    assert.ok(json.stack.technologies.includes('testify'));
  });
});

describe('v2.3.0: --for スタック検出 - Gemfile', () => {
  test('gem 行から依存を検出', () => {
    const proj = makeTempProject({
      'Gemfile': [
        "source 'https://rubygems.org'",
        "gem 'rails', '~> 7.0'",
        "gem 'sinatra'",
        'group :test do',
        "  gem 'rspec', '~> 3.0'",
        'end',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('rails'));
    assert.ok(json.stack.technologies.includes('sinatra'));
    assert.ok(json.stack.technologies.includes('rspec'));
  });
});

describe('v2.3.0: --for スタック検出 - composer.json', () => {
  test('vendor 名を抽出し、php/ext-*/ブラックリストを除外', () => {
    const proj = makeTempProject({
      'composer.json': JSON.stringify({
        require: {
          'php': '^8.1',
          'ext-mbstring': '*',
          'laravel/framework': '^10.0',
          'roave/security-advisories': 'dev-latest'
        },
        'require-dev': {
          'phpunit/phpunit': '^10.0',
          'phpstan/phpstan': '^1.10'
        }
      })
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('laravel'));
    assert.ok(json.stack.technologies.includes('phpunit'));
    assert.ok(!json.stack.technologies.includes('php'));
    assert.ok(!json.stack.technologies.includes('roave'));
    assert.ok(!json.stack.technologies.includes('phpstan'));
  });
});

describe('v2.3.0: フレームワーク階層性（hardTags）', () => {
  test('Next.js プロジェクトで [react] が hardTags に含まれる', () => {
    const proj = makeTempProject({
      'package.json': JSON.stringify({ dependencies: { next: '^14.0.0' } })
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.hardTags.includes('[react]'));
    assert.ok(json.stack.hardTags.includes('[next]'));
    assert.ok(json.stack.hardTags.includes('[nextjs]'));
  });

  test('Nuxt プロジェクトで [vue] が hardTags に含まれる', () => {
    const proj = makeTempProject({
      'package.json': JSON.stringify({ dependencies: { nuxt: '^3.0.0' } })
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.hardTags.includes('[vue]'));
    assert.ok(json.stack.hardTags.includes('[nuxt]'));
  });

  test('React 単体プロジェクトで [next] は含まれない', () => {
    const proj = makeTempProject({
      'package.json': JSON.stringify({ dependencies: { react: '^18.0.0' } })
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.hardTags.includes('[react]'));
    assert.ok(!json.stack.hardTags.includes('[next]'));
    assert.ok(!json.stack.hardTags.includes('[nextjs]'));
  });
});

describe('v2.3.0: --for 入力検証', () => {
  test('存在しないパスは exit 1', () => {
    const r = run(['--for', join(tmpdir(), 'skill-loop-nonexistent-xyz-12345'), EXAMPLES_LESSONS]);
    assert.equal(r.status, 1);
  });

  test('存在しないパス --json は error フィールド', () => {
    const r = run(['--for', join(tmpdir(), 'skill-loop-nonexistent-xyz-12345'), '--json', EXAMPLES_LESSONS]);
    assert.equal(r.status, 1);
    const json = JSON.parse(r.stdout);
    assert.ok(json.error);
  });

  test('ファイルパスを渡すと exit 1 (directory 要求)', () => {
    const proj = makeTempProject({ 'package.json': '{}' });
    const filePath = join(proj, 'package.json');
    const r = run(['--for', filePath, EXAMPLES_LESSONS]);
    assert.equal(r.status, 1);
  });

  test('ファイルパスを渡すと --json でエラーフィールド', () => {
    const proj = makeTempProject({ 'package.json': '{}' });
    const filePath = join(proj, 'package.json');
    const r = run(['--for', filePath, '--json', EXAMPLES_LESSONS]);
    assert.equal(r.status, 1);
    const json = JSON.parse(r.stdout);
    assert.ok(json.error);
  });
});

describe('v2.3.0: UTF-8 BOM 対応', () => {
  test('BOM 付き package.json が正しくパースされる', () => {
    const proj = makeTempProject({
      'package.json': '\uFEFF' + JSON.stringify({ dependencies: { react: '^18' } })
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('react'));
  });

  test('BOM 付き pyproject.toml が正しく処理される', () => {
    const proj = makeTempProject({
      'pyproject.toml': '\uFEFF' + [
        '[project]',
        'dependencies = ["fastapi"]',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
  });
});

describe('v2.3.0: 後方互換性 (--for 未指定時)', () => {
  test('--for 未指定時の JSON に stack フィールドが含まれない', () => {
    const lessons = makeTempLessonsWithTag('api');
    const r = run(['--json', '--no-version-check', lessons]);
    assert.equal(r.status, 0);
    const json = JSON.parse(r.stdout);
    assert.ok(!('stack' in json), '--for 指定時のみ stack が付与される');
  });

  test('--for 未指定時の analyze JSON 構造が既存と同等', () => {
    const lessons = makeTempLessonsWithTag('api');
    const r = run(['--json', '--no-version-check', lessons]);
    const json = JSON.parse(r.stdout);
    assert.equal(json.mode, 'analyze');
    assert.ok('threshold' in json);
    assert.ok('tags' in json);
    assert.ok('candidates' in json);
  });

  test('--for 指定時のみ stack フィールドがトップレベルに付く', () => {
    const proj = makeTempProject({
      'package.json': JSON.stringify({ dependencies: { react: '^18' } })
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok('stack' in json);
    assert.ok('projectDir' in json.stack);
    assert.ok('languages' in json.stack);
    assert.ok('technologies' in json.stack);
    assert.ok('sources' in json.stack);
    assert.ok('hardTags' in json.stack);
    assert.ok('softTags' in json.stack);
    assert.ok('errors' in json.stack);
  });
});

describe('v2.3.0: --all --json との組み合わせ', () => {
  test('--all --json で stack はトップレベルに 1 回のみ付与', () => {
    const proj = makeTempProject({
      'package.json': JSON.stringify({ dependencies: { react: '^18' } })
    });
    const r = run(['--all', '--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack);
    // 各モードサブオブジェクトに stack は複製されない
    assert.ok(!json.analyze?.stack);
    assert.ok(!json.sync?.stack);
    assert.ok(!json.health?.stack);
    assert.ok(!json.map?.stack);
  });
});

describe('v2.3.0: スタック未検出時の fallback', () => {
  test('未対応マニフェストのみはフィルタなし fallback', () => {
    const proj = makeTempProject({ 'random.txt': 'hello' });
    const lessons = makeTempLessonsWithTag('api');
    const r = run(['--for', proj, '--no-version-check', lessons]);
    assert.equal(r.status, 0);
    // examples/lessons の [api] タグは表示される（フィルタなし動作）
    assert.ok(r.stdout.includes('api'));
  });
});

describe('v2.3.0: 複数マニフェスト同居', () => {
  test('JS と Python のマニフェストが両方検出される', () => {
    const proj = makeTempProject({
      'package.json': JSON.stringify({ dependencies: { react: '^18' } }),
      'requirements.txt': 'fastapi'
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.languages.includes('javascript'));
    assert.ok(json.stack.languages.includes('python'));
    assert.ok(json.stack.technologies.includes('react'));
    assert.ok(json.stack.technologies.includes('fastapi'));
  });
});

// =============================================================================
// v2.3.0 修正対応（玄人猫実装レビュー Critical 2 件 + Important 1 件）
// =============================================================================

describe('v2.3.0: 三連引用文字列内を依存として誤抽出しない（回帰テスト）', () => {
  test('pyproject.toml の """ ブロック内の key = value を拾わない', () => {
    const proj = makeTempProject({
      'pyproject.toml': [
        '[tool.poetry.dependencies]',
        'python = "^3.10"',
        'fastapi = "^0.104"',
        'script = """',
        'name = "still-inside"',
        'run = 1',
        '"""',
        'pytest = "^7.0"',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(json.stack.technologies.includes('pytest'));
    // 三連引用文字列内の行を誤抽出しない
    assert.ok(!json.stack.technologies.includes('script'));
    assert.ok(!json.stack.technologies.includes('name'));
    assert.ok(!json.stack.technologies.includes('run'));
    assert.ok(!json.stack.technologies.includes('still-inside'));
  });

  test("''' single-quoted multiline も同様にスキップする", () => {
    const proj = makeTempProject({
      'pyproject.toml': [
        '[project]',
        "description = '''",
        'fake = "trap"',
        "'''",
        'dependencies = ["fastapi"]',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(!json.stack.technologies.includes('fake'));
    assert.ok(!json.stack.technologies.includes('description'));
  });
});

describe('v2.3.0: --for 検証が LESSON_FILES 空より先に走る', () => {
  test('空 lessons ディレクトリ + 存在しない --for パス → --for エラーに到達', () => {
    const emptyLessons = makeTempLessons({}); // ファイル 0 個
    const bogusProj = join(tmpdir(), `skill-loop-bogus-${Date.now()}-xyz`);
    const r = run(['--for', bogusProj, '--json', emptyLessons]);
    assert.equal(r.status, 1);
    const json = JSON.parse(r.stdout);
    // --for 専用エラーに到達している（LESSON_FILES 空ではない）
    assert.ok(json.error);
    assert.ok(json.error.includes('--for'), `expected --for related error, got: ${json.error}`);
  });

  test('空 lessons ディレクトリ + ファイルパス --for → --for エラーに到達', () => {
    const emptyLessons = makeTempLessons({});
    const proj = makeTempProject({ 'package.json': '{}' });
    const filePath = join(proj, 'package.json');
    const r = run(['--for', filePath, '--json', emptyLessons]);
    assert.equal(r.status, 1);
    const json = JSON.parse(r.stdout);
    assert.ok(json.error);
    assert.ok(json.error.includes('directory') || json.error.includes('--for'));
  });
});

describe('v2.3.0: --all --json スキーマに mode: "all" を含む', () => {
  test('--all --json のトップレベルに mode: "all" が付与される', () => {
    const r = run(['--all', '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.equal(json.mode, 'all');
    assert.ok('analyze' in json);
    assert.ok('sync' in json);
    assert.ok('health' in json);
    assert.ok('map' in json);
  });
});

describe('v2.3.0: extras 付き依存の正確な抽出（回帰テスト）', () => {
  test('requirements.txt: fastapi[standard] → fastapi のみ抽出', () => {
    const proj = makeTempProject({
      'requirements.txt': 'fastapi[standard]>=0.104.0\npydantic>=2.0'
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(json.stack.technologies.includes('pydantic'));
    assert.ok(!json.stack.technologies.includes('fastapi[standard]'));
  });

  test('requirements.txt: VCS URL は無視される', () => {
    const proj = makeTempProject({
      'requirements.txt': 'fastapi\ngit+https://github.com/foo/bar.git\npydantic'
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(json.stack.technologies.includes('pydantic'));
    assert.ok(!json.stack.technologies.includes('git+https'));
  });

  test('pyproject.toml: extras 付き PEP 621 依存を正しく抽出', () => {
    const proj = makeTempProject({
      'pyproject.toml': [
        '[project]',
        'name = "app"',
        'dependencies = [',
        '  "fastapi[standard]>=0.104",',
        '  "pydantic>=2.0",',
        ']',
      ].join('\n')
    });
    const r = run(['--for', proj, '--json', '--no-version-check', EXAMPLES_LESSONS]);
    const json = JSON.parse(r.stdout);
    assert.ok(json.stack.technologies.includes('fastapi'));
    assert.ok(json.stack.technologies.includes('pydantic'));
    assert.ok(!json.stack.technologies.includes('fastapi[standard]'));
  });
});

// =============================================================================
// v2.4.0: --merge-twice (2度発火統合候補検出、dry-run)
// =============================================================================

describe('v2.4.0: --merge-twice 基本動作', () => {
  test('--merge-twice: JSON 出力スキーマが想定通り', () => {
    const dir = makeTempLessons({
      'a.md': '# Test A\n`[harness]`\n\n## 概要\n\nrate limiting and exponential backoff for the api integration test.\n',
      'b.md': '# Test B\n`[harness]`\n\n## 概要\n\nrate limiting check and exponential backoff retry logic for api integration.\n',
    });
    const r = run(['--merge-twice', '--json', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.equal(json.mode, 'merge-twice');
    assert.ok(json.threshold);
    assert.equal(typeof json.threshold.tagOverlapMin, 'number');
    assert.equal(typeof json.threshold.keywordJaccardMin, 'number');
    assert.equal(typeof json.days, 'number');
    assert.ok(Array.isArray(json.candidates));
    assert.equal(typeof json.totalCandidates, 'number');
  });

  test('--merge-twice: 同テーマペアを検出する (英数字共通多めの fixture)', () => {
    // 共通キーワード豊富な lesson ペア (英数字主体で Jaccard 0.20 を超えるよう設計)
    const sharedBody = 'rate limiting exponential backoff retry api integration testing authentication headers ratelimit';
    const dir = makeTempLessons({
      'a.md': `# API Rate Limiting Lesson\n\`[api]\` \`[harness]\`\n\n## 概要\n\n${sharedBody} for client implementations.\n`,
      'b.md': `# API Backoff Lesson\n\`[api]\` \`[harness]\`\n\n## 概要\n\n${sharedBody} for server side.\n`,
    });
    const r = run(['--merge-twice', '--json', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.ok(json.candidates.length >= 1, `期待: 候補 1 件以上、実際: ${json.candidates.length}\n${r.stdout}`);
    const first = json.candidates[0];
    assert.ok(Array.isArray(first.sharedCategoryTags));
    assert.ok(first.sharedCategoryTags.length >= 1);
    assert.ok(typeof first.jaccardScore === 'number');
    assert.ok(first.jaccardScore >= json.threshold.keywordJaccardMin);
  });

  test('--merge-twice: --days で「新規」ウィンドウが効く (古い mtime は新規扱いから外れる)', () => {
    const dir = makeTempLessons({
      'recent.md': '# Recent\n`[harness]`\n\n## 概要\n\nrate limiting exponential backoff retry api integration.\n',
      'old.md':    '# Old\n`[harness]`\n\n## 概要\n\nrate limiting exponential backoff retry api integration old version.\n',
    });
    // old.md の mtime を 60 日前に設定
    const old = new Date(Date.now() - 60 * 86400 * 1000);
    utimesSync(join(dir, 'old.md'), old, old);

    const r = run(['--merge-twice', '--days', '30', '--json', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.equal(json.days, 30);
    // newFile に old.md が含まれないこと (newLessons には入らないはず)
    for (const c of json.candidates) {
      assert.ok(!c.newFile.endsWith('old.md'), `old.md は新規扱いされてはいけない: newFile=${c.newFile}`);
    }
  });

  test('--merge-twice: --help に説明が表示される', () => {
    const { stdout } = run(['--help']);
    assert.ok(stdout.includes('--merge-twice'), `--help に --merge-twice が含まれていない:\n${stdout}`);
  });
});

// =============================================================================
// v2.4.1: --merge-twice text モード + カタカナ抽出 + shared tags Jaccard 算入
// =============================================================================

describe('v2.4.1: --merge-twice text モード スモークテスト', () => {
  test('--merge-twice: text モードで候補ペアフォーマットが表示される', () => {
    // 共通キーワード豊富な lesson ペア (--json なしで text 出力経路を通す)
    const sharedBody = 'rate limiting exponential backoff retry api integration testing authentication headers ratelimit';
    const dir = makeTempLessons({
      'a.md': `# API Rate Limiting Lesson\n\`[api]\` \`[harness]\`\n\n## 概要\n\n${sharedBody} for client implementations.\n`,
      'b.md': `# API Backoff Lesson\n\`[api]\` \`[harness]\`\n\n## 概要\n\n${sharedBody} for server side.\n`,
    });
    const r = run(['--merge-twice', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    // text モード固有の表示要素を確認
    assert.ok(r.stdout.includes('統合候補検出'), `stdout に '統合候補検出' が含まれていない:\n${r.stdout}`);
    assert.ok(r.stdout.includes('候補ペア'), `stdout に '候補ペア' が含まれていない:\n${r.stdout}`);
    assert.ok(r.stdout.includes('Jaccard score'), `stdout に 'Jaccard score' が含まれていない:\n${r.stdout}`);
    assert.ok(r.stdout.includes('shared カテゴリタグ'), `stdout に 'shared カテゴリタグ' が含まれていない:\n${r.stdout}`);
  });

  test('--merge-twice: text モードで候補ゼロ時は「統合候補なし」表示', () => {
    // 共通タグなし、キーワードもほぼ共通なし
    const dir = makeTempLessons({
      'a.md': '# Topic A\n`[harness]`\n\n## 概要\n\nrate limiting exponential backoff.\n',
      'b.md': '# Topic B\n`[security]`\n\n## 概要\n\ncross site scripting prevention.\n',
    });
    const r = run(['--merge-twice', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.ok(r.stdout.includes('統合候補なし'), `候補ゼロ時の表示が出ていない:\n${r.stdout}`);
  });
});

describe('v2.4.1: 日本語短文 Jaccard 強化', () => {
  test('--merge-twice: カタカナキーワードで日本語短文ペアを検出', () => {
    // 共通カタカナキーワードを多数含む日本語 lesson ペア
    // (英数字に頼らず、カタカナで Jaccard 閾値を超えられること)
    const sharedKana = 'ナレッジ ハーネス ペイロード キャッシュ レビュー アサイン パイプライン トリガー リトライ ハンドラ';
    const dir = makeTempLessons({
      'a.md': `# 日本語タイトル A\n\`[harness]\`\n\n## 概要\n\n${sharedKana} の取り扱いを整理する。\n`,
      'b.md': `# 日本語タイトル B\n\`[harness]\`\n\n## 概要\n\n${sharedKana} を改善するための手順。\n`,
    });
    const r = run(['--merge-twice', '--json', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.ok(json.candidates.length >= 1, `日本語短文 fixture で候補が検出されない:\n${r.stdout}`);
    // カタカナ高頻度語 (テスト/コード等) は STOP_WORDS で除外されていることを間接確認
    // = sharedKeywords に「テスト」等が含まれない
    if (json.candidates[0]?.sharedKeywords) {
      const STOP_KANA = ['テスト', 'コード', 'ファイル', 'モード', 'フラグ', 'ログ'];
      for (const sw of STOP_KANA) {
        assert.ok(!json.candidates[0].sharedKeywords.includes(sw),
          `カタカナ STOP_WORD '${sw}' が sharedKeywords に含まれている`);
      }
    }
  });
});

// =============================================================================
// v2.4.2: --jaccard-min CLI override
// =============================================================================

describe('v2.4.2: --jaccard-min CLI', () => {
  // v2.4.3: makeMergePair / MERGE_PAIR_SHARED_BODY はモジュールスコープへ共通化

  test('--jaccard-min 0.99: 高閾値で候補ゼロ', () => {
    const dir = makeMergePair();
    const r = run(['--merge-twice', '--jaccard-min', '0.99', '--json', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.equal(json.threshold.keywordJaccardMin, 0.99, '閾値が CLI 指定値で上書きされていない');
    assert.equal(json.totalCandidates, 0, `高閾値 0.99 で候補ゼロが期待値だが ${json.totalCandidates} 件:\n${r.stdout}`);
  });

  test('--jaccard-min 0.01: 低閾値で候補が検出される', () => {
    const dir = makeMergePair();
    const r = run(['--merge-twice', '--jaccard-min', '0.01', '--json', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.equal(json.threshold.keywordJaccardMin, 0.01);
    assert.ok(json.totalCandidates >= 1, `低閾値 0.01 で候補 1 件以上が期待値:\n${r.stdout}`);
  });

  test('--jaccard-min 1.5: 範囲外で exit 1', () => {
    const dir = makeMergePair();
    const r = run(['--merge-twice', '--jaccard-min', '1.5', '--json', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 1, `範囲外で exit 1 期待、実際: ${r.status}`);
    assert.match(r.stderr, /must be a number between 0\.0 and 1\.0/);
  });

  test('--jaccard-min abc: 非数値で exit 1', () => {
    const dir = makeMergePair();
    const r = run(['--merge-twice', '--jaccard-min', 'abc', '--json', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 1, `非数値で exit 1 期待、実際: ${r.status}`);
    assert.match(r.stderr, /must be a number between 0\.0 and 1\.0/);
  });

  test('--jaccard-min 未指定: デフォルト 0.20 維持 (後方互換)', () => {
    const dir = makeMergePair();
    const r = run(['--merge-twice', '--json', '--no-version-check'], { env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const json = JSON.parse(r.stdout);
    assert.equal(json.threshold.keywordJaccardMin, 0.20, `デフォルト 0.20 が維持されていない: ${json.threshold.keywordJaccardMin}`);
  });
});

// =============================================================================
// v2.4.2: --execute (merge-plan.json 書き出し)
// =============================================================================

describe('v2.4.2: --execute merge-plan.json', () => {
  // v2.4.3: makeMergePair / MERGE_PAIR_SHARED_BODY はモジュールスコープへ共通化

  test('--execute: merge-plan.json が CWD に書き出される', () => {
    const dir = makeMergePair();
    const cwd = makeTempLessons({}); // 空の一時 CWD
    const r = run(['--merge-twice', '--execute', '--no-version-check'], { cwd, env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const planPath = join(cwd, 'merge-plan.json');
    assert.ok(existsSync(planPath), `merge-plan.json が CWD に書き出されていない: ${planPath}\nstdout: ${r.stdout}`);
  });

  test('--execute: JSON 形式 {version, generated_at, threshold, candidates}', async () => {
    const { readFileSync } = await import('node:fs');
    const dir = makeMergePair();
    const cwd = makeTempLessons({});
    const r = run(['--merge-twice', '--execute', '--no-version-check'], { cwd, env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const plan = JSON.parse(readFileSync(join(cwd, 'merge-plan.json'), 'utf-8'));
    assert.equal(plan.version, '2.4.3');
    assert.match(plan.generated_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(plan.threshold);
    assert.equal(typeof plan.threshold.keywordJaccardMin, 'number');
    assert.equal(typeof plan.totalCandidates, 'number');
    assert.ok(Array.isArray(plan.candidates));
    if (plan.candidates.length > 0) {
      assert.equal(plan.candidates[0].action, 'TBD', '各候補に action: "TBD" が付与されていない');
    }
  });

  test('--execute なし: merge-plan.json は書き出されない (後方互換)', () => {
    const dir = makeMergePair();
    const cwd = makeTempLessons({});
    const r = run(['--merge-twice', '--no-version-check'], { cwd, env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.equal(existsSync(join(cwd, 'merge-plan.json')), false, '--execute なしで merge-plan.json が書き出されている');
  });

  test('--execute + --jaccard-min: 両フラグ組み合わせで threshold が JSON に反映', async () => {
    const { readFileSync } = await import('node:fs');
    const dir = makeMergePair();
    const cwd = makeTempLessons({});
    const r = run(['--merge-twice', '--execute', '--jaccard-min', '0.05', '--no-version-check'], { cwd, env: { LESSON_SKILL_LESSONS_DIR: dir } });
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const plan = JSON.parse(readFileSync(join(cwd, 'merge-plan.json'), 'utf-8'));
    assert.equal(plan.threshold.keywordJaccardMin, 0.05, `--jaccard-min 0.05 が plan に反映されていない: ${plan.threshold.keywordJaccardMin}`);
  });
});

// =============================================================================
// v2.4.3: F1 — candidates=0 時の --execute 動作（空配列で書き出し）
// =============================================================================

describe('v2.4.3: --execute candidates=0 でも書き出す (F1)', () => {
  test('--execute + --jaccard-min 0.99: candidates=0 でも merge-plan.json が書き出される', async () => {
    const { readFileSync } = await import('node:fs');
    const dir = makeMergePair();
    const cwd = makeTempLessons({});
    const r = run(
      ['--merge-twice', '--execute', '--jaccard-min', '0.99', '--no-version-check'],
      { cwd, env: { LESSON_SKILL_LESSONS_DIR: dir } }
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const planPath = join(cwd, 'merge-plan.json');
    assert.ok(existsSync(planPath), `candidates=0 でも merge-plan.json が書き出されるべき (F1)\nstdout: ${r.stdout}`);
    const plan = JSON.parse(readFileSync(planPath, 'utf-8'));
    assert.equal(plan.candidates.length, 0, `candidates が空配列であるべき: ${JSON.stringify(plan.candidates)}`);
    assert.equal(plan.totalCandidates, 0);
  });

  test('--execute + --jaccard-min 0.99: 空配列でも version/threshold schema 維持', async () => {
    const { readFileSync } = await import('node:fs');
    const dir = makeMergePair();
    const cwd = makeTempLessons({});
    const r = run(
      ['--merge-twice', '--execute', '--jaccard-min', '0.99', '--no-version-check'],
      { cwd, env: { LESSON_SKILL_LESSONS_DIR: dir } }
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const plan = JSON.parse(readFileSync(join(cwd, 'merge-plan.json'), 'utf-8'));
    assert.equal(plan.version, '2.4.3');
    assert.equal(plan.threshold.keywordJaccardMin, 0.99);
    assert.match(plan.generated_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(Array.isArray(plan.candidates));
  });
});

// =============================================================================
// v2.4.3: F3 — --json --execute 両立（stdout JSON + merge-plan.json 同時出力）
// =============================================================================

describe('v2.4.3: --json --execute 両立 (F3)', () => {
  test('--json --execute 両指定: stdout JSON parse 可 + merge-plan.json 存在', async () => {
    const { readFileSync } = await import('node:fs');
    const dir = makeMergePair();
    const cwd = makeTempLessons({});
    const r = run(
      ['--merge-twice', '--json', '--execute', '--no-version-check'],
      { cwd, env: { LESSON_SKILL_LESSONS_DIR: dir } }
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    // stdout の JSON が parse 可能
    const stdoutJson = JSON.parse(r.stdout);
    assert.equal(stdoutJson.mode, 'merge-twice');
    assert.ok(Array.isArray(stdoutJson.candidates));
    // merge-plan.json も書き出されている
    const planPath = join(cwd, 'merge-plan.json');
    assert.ok(existsSync(planPath), `--json --execute 両指定で merge-plan.json が書き出されるべき (F3)\nstdout: ${r.stdout}`);
    const plan = JSON.parse(readFileSync(planPath, 'utf-8'));
    assert.equal(plan.version, '2.4.3');
    // v2.4.4 Phase 1 (Nit-1): stdout JSON の candidates.length と merge-plan.json の totalCandidates が一致
    assert.equal(
      stdoutJson.candidates.length,
      plan.totalCandidates,
      `stdoutJson.candidates.length (${stdoutJson.candidates.length}) と merge-plan.json totalCandidates (${plan.totalCandidates}) が不一致 — Nit-1`
    );
    assert.equal(
      stdoutJson.candidates.length,
      plan.candidates.length,
      `stdoutJson.candidates.length と plan.candidates.length も一致するべき — Nit-1`
    );
  });

  test('--json 単独: merge-plan.json は書き出されない (回帰)', () => {
    const dir = makeMergePair();
    const cwd = makeTempLessons({});
    const r = run(
      ['--merge-twice', '--json', '--no-version-check'],
      { cwd, env: { LESSON_SKILL_LESSONS_DIR: dir } }
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const planPath = join(cwd, 'merge-plan.json');
    assert.equal(existsSync(planPath), false, `--json 単独で merge-plan.json が書き出されるべきでない (回帰)`);
  });
});

// =============================================================================
// v2.4.2: --help に新フラグ表示
// =============================================================================

describe('v2.4.2: --help に新フラグ', () => {
  test('--help: --jaccard-min が含まれる', () => {
    const { stdout } = run(['--help']);
    assert.ok(stdout.includes('--jaccard-min'), `--help に --jaccard-min が含まれていない:\n${stdout}`);
  });

  test('--help: --execute が含まれる', () => {
    const { stdout } = run(['--help']);
    assert.ok(stdout.includes('--execute'), `--help に --execute が含まれていない:\n${stdout}`);
  });
});

// =============================================================================
// v2.4.4 Phase 1 (Nit-2): --json --execute --jaccard-min 0.99 3フラグ組み合わせ
// =============================================================================

describe('v2.4.4 Phase 1 (Nit-2): --json --execute --jaccard-min 0.99 3フラグ組み合わせ', () => {
  test('3フラグ同時指定: candidates=0 で stdout JSON + merge-plan.json 両方が空配列で書出', async () => {
    const { readFileSync } = await import('node:fs');
    const dir = makeMergePair();
    const cwd = makeTempLessons({});
    const r = run(
      ['--merge-twice', '--json', '--execute', '--jaccard-min', '0.99', '--no-version-check'],
      { cwd, env: { LESSON_SKILL_LESSONS_DIR: dir } }
    );
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    // stdout JSON が candidates=[] (高閾値)
    const stdoutJson = JSON.parse(r.stdout);
    assert.equal(stdoutJson.mode, 'merge-twice');
    assert.ok(Array.isArray(stdoutJson.candidates));
    assert.equal(stdoutJson.candidates.length, 0, `--jaccard-min 0.99 で候補ゼロのはず`);
    // merge-plan.json も書き出され、空配列
    const planPath = join(cwd, 'merge-plan.json');
    assert.ok(existsSync(planPath), `--json --execute --jaccard-min 0.99 で merge-plan.json が書き出されるべき`);
    const plan = JSON.parse(readFileSync(planPath, 'utf-8'));
    assert.equal(plan.candidates.length, 0, `plan.candidates が空配列のはず`);
    assert.equal(plan.totalCandidates, 0);
    // Nit-1 相当: stdout と file の長さ一致
    assert.equal(stdoutJson.candidates.length, plan.totalCandidates);
  });
});

// =============================================================================
// v2.4.4 Phase 1: --apply-plan dry-run（実マージなし）
// =============================================================================

describe('v2.4.4 Phase 1: --apply-plan dry-run', () => {
  const FIXTURES_DIR = join(__dirname, 'fixtures');
  const FIXTURE_ALL_MERGE = join(FIXTURES_DIR, 'sample-plan-all-merge.json');
  const FIXTURE_MIXED = join(FIXTURES_DIR, 'sample-plan-mixed.json');
  const FIXTURE_TBD = join(FIXTURES_DIR, 'sample-plan-tbd-residual.json');

  test('T16 正常系: --apply-plan all-merge fixture で merge 件数集計', () => {
    const r = run(['--apply-plan', FIXTURE_ALL_MERGE, '--no-version-check']);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.ok(r.stdout.includes('merge: 2'), `stdout に "merge: 2" が含まれない:\n${r.stdout}`);
    assert.ok(r.stdout.includes('skip: 0'), `stdout に "skip: 0" が含まれない`);
    assert.ok(r.stdout.includes('ignore: 0'), `stdout に "ignore: 0" が含まれない`);
    assert.ok(r.stdout.includes('dry-run'), `stdout に "dry-run" 注記が含まれない`);
  });

  test('T17 正常系: --apply-plan mixed fixture で各 action 件数集計', () => {
    const r = run(['--apply-plan', FIXTURE_MIXED, '--no-version-check']);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.ok(r.stdout.includes('merge: 1'));
    assert.ok(r.stdout.includes('skip: 1'));
    assert.ok(r.stdout.includes('ignore: 1'));
  });

  test('T18 異常系: --apply-plan TBD 残存で exit 1', () => {
    const r = run(['--apply-plan', FIXTURE_TBD, '--no-version-check']);
    assert.equal(r.status, 1, `TBD 残存で exit 1 のはず: stdout=${r.stdout}, stderr=${r.stderr}`);
    assert.ok(r.stderr.includes('TBD'), `stderr に 'TBD' エラーが含まれるはず:\n${r.stderr}`);
  });

  test('T19 異常系: --apply-plan ファイル不在で exit 1', () => {
    const r = run(['--apply-plan', '/nonexistent-merge-plan.json', '--no-version-check']);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('not found'), `stderr に 'not found' が含まれるはず:\n${r.stderr}`);
  });

  test('T20 異常系: --apply-plan 不正 action 値で exit 1', () => {
    const dir = makeTempLessons({
      'bad-plan.json': JSON.stringify({
        version: '2.4.3',
        generated_at: '2026-05-24T00:00:00.000Z',
        candidates: [
          { newFile: 'a.md', existingFile: 'b.md', action: 'delete' }
        ],
      }),
    });
    const r = run(['--apply-plan', join(dir, 'bad-plan.json'), '--no-version-check']);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('delete'), `stderr に不正値 'delete' エラーが含まれるはず:\n${r.stderr}`);
  });

  test('T21 --apply-plan --json: 構造化 JSON 出力', () => {
    const r = run(['--apply-plan', FIXTURE_MIXED, '--json', '--no-version-check']);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    const out = JSON.parse(r.stdout);
    assert.equal(out.mode, 'apply-plan');
    assert.equal(out.dryRun, true);
    assert.equal(out.summary.merge, 1);
    assert.equal(out.summary.skip, 1);
    assert.equal(out.summary.ignore, 1);
    assert.ok(Array.isArray(out.candidates));
    assert.equal(out.candidates.length, 3);
  });

  test('T22 [critical] --apply-plan で実マージが行われない（fixture mtime 不変）', async () => {
    const { statSync } = await import('node:fs');
    const before = statSync(FIXTURE_MIXED).mtimeMs;
    // 1ms 遅延で確実に検出可能に
    await new Promise(r => setTimeout(r, 5));
    const r = run(['--apply-plan', FIXTURE_MIXED, '--no-version-check']);
    assert.equal(r.status, 0);
    const after = statSync(FIXTURE_MIXED).mtimeMs;
    assert.equal(before, after, `fixture ファイルが mtime 変化 → 実マージが発生した可能性！ Phase 1 では発生してはならない`);
  });

  test('T23 異常系: --apply-plan 引数なしで exit 1', () => {
    const r = run(['--apply-plan', '--no-version-check']);
    assert.equal(r.status, 1, `引数なしで exit 1 のはず`);
    assert.ok(r.stderr.includes('--apply-plan'), `stderr に --apply-plan エラーが含まれるはず:\n${r.stderr}`);
  });

  test('T24 異常系: --apply-plan で不正 JSON は exit 1', () => {
    const dir = makeTempLessons({ 'broken.json': '{ broken: json' });
    const r = run(['--apply-plan', join(dir, 'broken.json'), '--no-version-check']);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('Invalid JSON'), `stderr に 'Invalid JSON' が含まれるはず:\n${r.stderr}`);
  });
});

// =============================================================================
// v2.4.4 Phase 1: --help に --apply-plan 表示
// =============================================================================

describe('v2.4.4 Phase 1: --help に --apply-plan', () => {
  test('--help: --apply-plan が含まれる', () => {
    const { stdout } = run(['--help']);
    assert.ok(stdout.includes('--apply-plan'), `--help に --apply-plan が含まれていない:\n${stdout}`);
  });

  test('--help: --apply-plan の説明に "dry-run" 注記が含まれる', () => {
    const { stdout } = run(['--help']);
    // 「dry-run 解析」または同等の説明
    assert.ok(stdout.includes('dry-run'), `--help の --apply-plan 説明に 'dry-run' 注記が含まれていない:\n${stdout}`);
  });
});

// =============================================================================
// v2.4.5 Phase 2: --apply-plan --execute (実マージ) + --rollback-plan + Nit 1/2/3
// =============================================================================

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir as os_tmpdir } from 'node:os';

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// 一時 lessons + plan セットアップヘルパー（T22-v2, T25-T33 共通）
function setupTmpLessonsAndPlan(actions = ['merge']) {
  const dir = join(os_tmpdir(), `lsl-v245-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });

  const candidates = actions.map((action, i) => {
    const newFile = join(dir, `new-${i}.md`);
    const existingFile = join(dir, `existing-${i}.md`);
    writeFileSync(newFile, `### lesson new ${i} [test]\n\nbody new ${i}\n`);
    writeFileSync(existingFile, `### lesson existing ${i} [test]\n\nbody existing ${i}\n`);
    return {
      newFile,
      existingFile,
      sharedCategoryTags: ['test'],
      sharedKeywords: ['lesson'],
      jaccardScore: 0.5,
      action,
    };
  });

  const planPath = join(dir, 'merge-plan.json');
  writeFileSync(planPath, JSON.stringify({
    version: '2.4.3',
    generated_at: new Date().toISOString(),
    threshold: { tagOverlapMin: 2, keywordJaccardMin: 0.2 },
    days: 30,
    totalCandidates: candidates.length,
    candidates,
  }, null, 2));

  return { dir, planPath, candidates };
}

describe('v2.4.5 Phase 2: --apply-plan --execute (実マージ)', () => {
  test('T25 [critical] --execute で action=merge が実行され、existingFile に newFile が append される', () => {
    const { dir, planPath, candidates } = setupTmpLessonsAndPlan(['merge']);
    try {
      const r = run(['--apply-plan', planPath, '--execute', '--no-version-check'], { cwd: dir });
      assert.equal(r.status, 0, `exit code 0 expected, stderr:\n${r.stderr}`);

      // existingFile に append されていること
      const merged = readFileSync(candidates[0].existingFile, 'utf-8');
      assert.ok(merged.includes('body existing 0'), `existingFile に元の内容が残っているはず`);
      assert.ok(merged.includes('body new 0'), `existingFile に newFile 内容が append されているはず`);
      assert.ok(merged.includes('\n\n---\n\n'), `区切り文字 \\n\\n---\\n\\n が挿入されているはず`);

      // newFile は削除されている
      assert.equal(existsSync(candidates[0].newFile), false, `newFile は削除されているはず`);

      // backup ディレクトリが生成されている
      const backupRoot = join(dir, '.apply-plan-backup');
      assert.ok(existsSync(backupRoot), `backup ルートディレクトリが存在するはず`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('T26 [critical] backup ディレクトリ構造 + restore-manifest.json スキーマ', () => {
    const { dir, planPath } = setupTmpLessonsAndPlan(['merge', 'merge']);
    try {
      const r = run(['--apply-plan', planPath, '--execute', '--no-version-check'], { cwd: dir });
      assert.equal(r.status, 0, `stderr:\n${r.stderr}`);

      const backupRoot = join(dir, '.apply-plan-backup');
      const subdirs = readdirSync(backupRoot);
      assert.equal(subdirs.length, 1, `1 つの backup サブディレクトリが生成されているはず`);

      const backupDir = join(backupRoot, subdirs[0]);
      assert.ok(existsSync(join(backupDir, 'backup')), `backup/ サブディレクトリ存在`);
      assert.ok(existsSync(join(backupDir, 'moved')), `moved/ サブディレクトリ存在`);
      assert.ok(existsSync(join(backupDir, 'restore-manifest.json')), `restore-manifest.json 存在`);

      // backup/ と moved/ それぞれ 2 ファイル
      assert.equal(readdirSync(join(backupDir, 'backup')).length, 2);
      assert.equal(readdirSync(join(backupDir, 'moved')).length, 2);

      // manifest スキーマ
      const manifest = JSON.parse(readFileSync(join(backupDir, 'restore-manifest.json'), 'utf-8'));
      assert.equal(manifest.manifest_version, '1.0');
      assert.equal(manifest.tool_version, '2.4.5');
      assert.ok(manifest.applied_at);
      assert.ok(manifest.source_plan_path);
      assert.equal(manifest.candidates.length, 2);
      assert.equal(manifest.rolled_back_at, null);
      for (const c of manifest.candidates) {
        assert.equal(c.action, 'merge');
        assert.ok(c.backup_uuid);
        assert.ok(c.existingFile_backup_path);
        assert.ok(c.newFile_moved_path);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('T27 [critical] --rollback-plan で完全復元（hash 比較）', () => {
    const { dir, planPath, candidates } = setupTmpLessonsAndPlan(['merge', 'merge']);
    try {
      // execute 前の hash 記録
      const hashesBefore = candidates.map(c => ({
        existingFile: c.existingFile,
        newFile: c.newFile,
        existingHash: hashFile(c.existingFile),
        newHash: hashFile(c.newFile),
      }));

      // execute
      const execR = run(['--apply-plan', planPath, '--execute', '--no-version-check'], { cwd: dir });
      assert.equal(execR.status, 0, `execute stderr:\n${execR.stderr}`);

      const backupRoot = join(dir, '.apply-plan-backup');
      const subdirs = readdirSync(backupRoot);
      const backupDir = join(backupRoot, subdirs[0]);

      // newFile が削除されている前提
      for (const c of candidates) {
        assert.equal(existsSync(c.newFile), false);
      }

      // rollback
      const rbR = run(['--rollback-plan', backupDir, '--no-version-check'], { cwd: dir });
      assert.equal(rbR.status, 0, `rollback stderr:\n${rbR.stderr}`);

      // hash 比較
      for (const h of hashesBefore) {
        assert.ok(existsSync(h.existingFile), `existingFile 復元`);
        assert.ok(existsSync(h.newFile), `newFile 復元`);
        assert.equal(hashFile(h.existingFile), h.existingHash, `existingFile hash 一致`);
        assert.equal(hashFile(h.newFile), h.newHash, `newFile hash 一致`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('T28 mixed action: merge のみ実行、skip/ignore は manifest.skipped に記録', () => {
    const { dir, planPath, candidates } = setupTmpLessonsAndPlan(['merge', 'skip', 'ignore']);
    try {
      // skip / ignore の元 mtime 記録
      const skipFileBefore = statSync(candidates[1].existingFile).mtimeMs;
      const ignoreFileBefore = statSync(candidates[2].existingFile).mtimeMs;

      const r = run(['--apply-plan', planPath, '--execute', '--no-version-check'], { cwd: dir });
      assert.equal(r.status, 0, `stderr:\n${r.stderr}`);

      // skip / ignore の existingFile / newFile は変更なし
      assert.ok(existsSync(candidates[1].newFile), `skip の newFile は残存`);
      assert.ok(existsSync(candidates[2].newFile), `ignore の newFile は残存`);

      // manifest 確認
      const backupRoot = join(dir, '.apply-plan-backup');
      const subdirs = readdirSync(backupRoot);
      const manifest = JSON.parse(readFileSync(join(backupRoot, subdirs[0], 'restore-manifest.json'), 'utf-8'));
      assert.equal(manifest.candidates.length, 1, `merge のみ candidates に`);
      assert.equal(manifest.skipped.length, 2, `skip + ignore で 2 件 skipped に`);

      // Nit-C: skip/ignore は merge 対象外 → existingFile の mtime は不変であること
      assert.equal(statSync(candidates[1].existingFile).mtimeMs, skipFileBefore, `skip の existingFile mtime 不変`);
      assert.equal(statSync(candidates[2].existingFile).mtimeMs, ignoreFileBefore, `ignore の existingFile mtime 不変`);

      // Nit-D: manifest.skipped の path は絶対パスで記録される（監査ログのパス一貫性）
      for (const s of manifest.skipped) {
        assert.ok(isAbsolute(s.newFile), `skipped.newFile は絶対パス: ${s.newFile}`);
        assert.ok(isAbsolute(s.existingFile), `skipped.existingFile は絶対パス: ${s.existingFile}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('T29 異常系: --execute で existingFile 不在 → exit 1', () => {
    const { dir, planPath, candidates } = setupTmpLessonsAndPlan(['merge']);
    try {
      // existingFile を削除
      rmSync(candidates[0].existingFile);
      const r = run(['--apply-plan', planPath, '--execute', '--no-version-check'], { cwd: dir });
      assert.equal(r.status, 1, `existingFile 不在で exit 1 のはず`);
      assert.ok(r.stderr.includes('existingFile not found') || r.stderr.includes('not found'), `stderr:\n${r.stderr}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('T30 異常系: --rollback-plan ディレクトリ不在 → exit 1', () => {
    const r = run(['--rollback-plan', '/nonexistent/path/to/backup/xyz', '--no-version-check']);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('rollback directory not found') || r.stderr.includes('not found'), `stderr:\n${r.stderr}`);
  });

  test('T31 異常系: --rollback-plan で manifest 不在 → exit 1', () => {
    const dir = join(os_tmpdir(), `lsl-v245-t31-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const r = run(['--rollback-plan', dir, '--no-version-check']);
      assert.equal(r.status, 1);
      assert.ok(r.stderr.includes('restore-manifest.json not found') || r.stderr.includes('not found'), `stderr:\n${r.stderr}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('T32 [critical R1] rollback 二重実行で exit 1', () => {
    const { dir, planPath } = setupTmpLessonsAndPlan(['merge']);
    try {
      const execR = run(['--apply-plan', planPath, '--execute', '--no-version-check'], { cwd: dir });
      assert.equal(execR.status, 0, `execute stderr:\n${execR.stderr}`);

      const backupRoot = join(dir, '.apply-plan-backup');
      const subdirs = readdirSync(backupRoot);
      const backupDir = join(backupRoot, subdirs[0]);

      // 1 回目 rollback
      const rb1 = run(['--rollback-plan', backupDir, '--no-version-check'], { cwd: dir });
      assert.equal(rb1.status, 0, `1 回目 rollback 成功はず`);

      // 2 回目 rollback → exit 1
      const rb2 = run(['--rollback-plan', backupDir, '--no-version-check'], { cwd: dir });
      assert.equal(rb2.status, 1, `2 回目 rollback は exit 1`);
      assert.ok(rb2.stderr.includes('既に rollback 済み') || rb2.stderr.includes('already'), `stderr:\n${rb2.stderr}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('T33 rollback 後の manifest に rolled_back_at が記録される', () => {
    const { dir, planPath } = setupTmpLessonsAndPlan(['merge']);
    try {
      run(['--apply-plan', planPath, '--execute', '--no-version-check'], { cwd: dir });
      const backupRoot = join(dir, '.apply-plan-backup');
      const backupDir = join(backupRoot, readdirSync(backupRoot)[0]);

      // rollback 前は null
      const manifestBefore = JSON.parse(readFileSync(join(backupDir, 'restore-manifest.json'), 'utf-8'));
      assert.equal(manifestBefore.rolled_back_at, null);

      run(['--rollback-plan', backupDir, '--no-version-check'], { cwd: dir });

      // rollback 後は ISO 8601 文字列
      const manifestAfter = JSON.parse(readFileSync(join(backupDir, 'restore-manifest.json'), 'utf-8'));
      assert.ok(manifestAfter.rolled_back_at);
      assert.match(manifestAfter.rolled_back_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('v2.4.5 Phase 2 Nit-1: T22 強化（lessons/*.md mtime 不変）', () => {
  test('T22-v2 [critical Nit-1] dry-run (--apply-plan 単独) で lessons/*.md mtime が不変', async () => {
    const { dir, planPath, candidates } = setupTmpLessonsAndPlan(['merge', 'skip']);
    try {
      const mtimesBefore = candidates.map(c => ({
        existing: statSync(c.existingFile).mtimeMs,
        new: statSync(c.newFile).mtimeMs,
      }));

      await new Promise(r => setTimeout(r, 20));

      // dry-run (--execute なし)
      const r = run(['--apply-plan', planPath, '--no-version-check']);
      assert.equal(r.status, 0);

      const mtimesAfter = candidates.map(c => ({
        existing: statSync(c.existingFile).mtimeMs,
        new: statSync(c.newFile).mtimeMs,
      }));

      for (let i = 0; i < candidates.length; i++) {
        assert.equal(mtimesBefore[i].existing, mtimesAfter[i].existing, `lessons[${i}] existingFile mtime 不変`);
        assert.equal(mtimesBefore[i].new, mtimesAfter[i].new, `lessons[${i}] newFile mtime 不変`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('v2.4.5 Phase 2 Nit-2: 同時指定エラー', () => {
  test('T34a [critical Nit-2] --apply-plan + --sync → exit 1', () => {
    const r = run(['--apply-plan', './foo.json', '--sync', '--no-version-check']);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('must be used alone'), `stderr:\n${r.stderr}`);
  });

  test('T34b --apply-plan + --health → exit 1', () => {
    const r = run(['--apply-plan', './foo.json', '--health', '--no-version-check']);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('must be used alone'), `stderr:\n${r.stderr}`);
  });

  test('T34c --rollback-plan + --sync → exit 1', () => {
    const r = run(['--rollback-plan', './foo-dir', '--sync', '--no-version-check']);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('must be used alone'), `stderr:\n${r.stderr}`);
  });
});

describe('v2.4.5 Phase 2 Nit-3: candidates=[] 警告', () => {
  test('T35a [critical Nit-3] dry-run で candidates=[] に警告メッセージ', () => {
    const dir = join(os_tmpdir(), `lsl-v245-t35a-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const planPath = join(dir, 'empty-plan.json');
      writeFileSync(planPath, JSON.stringify({
        version: '2.4.3',
        generated_at: new Date().toISOString(),
        candidates: [],
      }));
      const r = run(['--apply-plan', planPath, '--no-version-check']);
      assert.equal(r.status, 0);
      assert.ok(r.stdout.includes('candidates が空') || r.stdout.includes('candidates'), `stdout:\n${r.stdout}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('T35b dry-run --json で candidates=[] に warning フィールド', () => {
    const dir = join(os_tmpdir(), `lsl-v245-t35b-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const planPath = join(dir, 'empty-plan.json');
      writeFileSync(planPath, JSON.stringify({
        version: '2.4.3',
        generated_at: new Date().toISOString(),
        candidates: [],
      }));
      const r = run(['--apply-plan', planPath, '--json', '--no-version-check']);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.ok(out.warning, `JSON out.warning フィールド存在`);
      assert.ok(out.warning.includes('candidates が空'), `warning メッセージ`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('v2.4.5 Phase 2: --help に --rollback-plan / --execute 拡張', () => {
  test('--help: --rollback-plan が含まれる', () => {
    const { stdout } = run(['--help']);
    assert.ok(stdout.includes('--rollback-plan'), `--help に --rollback-plan が含まれていない:\n${stdout}`);
  });

  test('--help: --apply-plan --execute の説明が含まれる', () => {
    const { stdout } = run(['--help']);
    assert.ok(stdout.includes('--apply-plan --execute') || stdout.includes('破壊操作'), `--help に --apply-plan --execute 説明なし:\n${stdout}`);
  });
});

