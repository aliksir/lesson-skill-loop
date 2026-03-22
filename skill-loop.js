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
  } catch {}
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
    return null; // オフライン等
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
    return false;
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
      lessonsDir = args[++i] || '';
      break;
    case '--skills-dir':
      skillsDir = args[++i] || '';
      break;
    case '--threshold':
      threshold = parseInt(args[++i], 10) || 3;
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

if (LESSON_FILES.length === 0) {
  if (jsonMode) {
    console.log(JSON.stringify({ error: 'No lesson files found', path: SCAN_PATHS }));
  } else {
    console.error(`教訓ファイルが見つかりません: ${SCAN_PATHS}`);
  }
  process.exit(1);
}

// --- 共通ユーティリティ ---

/**
 * 全教訓ファイルの内容を結合して返す（改行コード正規化済み）
 */
function readAllLessons() {
  return LESSON_FILES
    .map(f => {
      try { return readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { return ''; }
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
    try { content = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { continue; }

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
    try { content = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { continue; }
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
    try { content = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { continue; }

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
  try { content = readFileSync(skillPath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'); } catch { return []; }
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
        } catch { return false; }
      });
  } catch { return []; }
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
    return -1;
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
    return '不明';
  }
}

// --- モード1: タグ分析+スキル化候補 ---

function doAnalyze() {
  const tags = getTags();

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
  const skills = getChecklistSkills();

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
  const skills = getChecklistSkills();

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
  const skills = getChecklistSkills();

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
    return {
      analyze: doAnalyze(),
      sync: doSync(),
      health: doHealth(),
      map: doMap()
    };
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

async function main() {
  // --self-update: ツール自身を更新して終了
  if (selfUpdateMode) {
    await selfUpdate();
    return;
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
