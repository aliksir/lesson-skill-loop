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
