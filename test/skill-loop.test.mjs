/**
 * skill-loop.test.mjs — lesson-skill-loop v2.2.0 自動テスト
 *
 * node:test + node:assert を使用（依存ゼロ維持）
 * 実行: node --test test/skill-loop.test.mjs
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
