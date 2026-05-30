# lesson-skill-loop

Turn your development lessons into reusable skills — automatically.

**[日本語版 README](README.ja.md)**

## What It Does

Developers accumulate lessons from bugs, incidents, and mistakes. These lessons sit in markdown files and are rarely revisited. This tool closes the loop:

```
Lessons (past mistakes) → Analysis → Skill proposals → Skills (checklists)
                                                            ↓
                                                       Skills used
                                                            ↓
                                                       New lessons
                                                            ↓
                                                   Skill improvements
```

## Quick Start

```bash
# Run directly with npx (no install needed)
npx claude-skill-loop examples/lessons

# Or install globally
npm install -g claude-skill-loop
claude-skill-loop /path/to/your/lessons
```

## Modes

### Analysis (CLI)

| Mode | Command | What it does |
|------|---------|-------------|
| **Analyze** | `claude-skill-loop [dir]` | Count tags, propose skills for patterns appearing 3+ times |
| **Sync** | `claude-skill-loop --sync [dir]` | Compare existing skills with lessons, find unreflected entries |
| **Health** | `claude-skill-loop --health [dir]` | Check skill freshness and evidence strength |
| **Map** | `claude-skill-loop --map [dir]` | Full traceability: which lessons back which skills (with full text) |
| **All** | `claude-skill-loop --all [dir]` | Run all modes |

### Recording (Skill — works in Cowork)

| Command | What it does |
|---------|-------------|
| `/lesson [tag] description` | Record a lesson with tags |
| `/lesson list` | Show all recorded lessons |
| `/lesson tags` | Show tag frequency summary |
| `/lesson search keyword` | Search lessons by keyword |

Record lessons during work, then analyze with `/skill-loop` to close the feedback loop.

## Options

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format (for scripting / CI integration) |
| `--dir <path>` | Specify lessons directory (alternative to positional arg) |
| `--skills-dir <path>` | Specify skills directory |
| `--for <path>` | **(v2.3.0+)** Filter lessons by stack detected in `<path>`. See "Stack-aware filtering" below. |
| `--merge-twice` | **(v2.4.0+)** Detect duplicate-theme lesson candidates that should be merged. See "Merge-twice detection" below. |
| `--days <n>` | **(v2.4.0+)** New-lesson window for `--merge-twice` mode, default: `30` (days, by mtime). |
| `--threshold <n>` | Skill proposal threshold, default: `3` |

## Stack-aware filtering (`--for`, v2.3.0+)

`--for <project-path>` detects the technology stack in the target project and shows only lessons relevant to the detected stack. This lets you surface "past failures that matter for *this* project" — complementary to tools like `autoskills` that push *generic* skills.

```bash
# Show only lessons tagged with technologies detected in ./my-next-app
claude-skill-loop --for ./my-next-app ~/.claude/lessons

# Combine with any mode
claude-skill-loop --all --for ./my-rust-service ~/.claude/lessons
```

**Supported manifests (v2.3.0)**: `package.json`, `requirements.txt`, `pyproject.toml`, `Pipfile`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`. Top-level only; monorepos are not supported in v2.3.0.

**Path semantics**: Relative paths are resolved from the current working directory. The target must be a directory — passing a file will exit with an error.

**Framework hierarchy**: Parent frameworks are automatically included. For example, a Next.js project also matches `[react]` lessons; a Nuxt project also matches `[vue]` lessons.

**Output**: In `--json` mode, a `stack` field is added at top level **only when `--for` is specified**:

```json
{
  "mode": "analyze",
  "tags": [...],
  "stack": {
    "projectDir": "/abs/path/to/project",
    "languages": ["javascript"],
    "technologies": ["react", "next", "typescript"],
    "sources": ["package.json"],
    "hardTags": ["[react]", "[next]", "[nextjs]", "[typescript]", "[javascript]"],
    "softTags": ["[hooks]", "[ssr]", "[frontend]", "[types]"],
    "errors": []
  }
}
```

When `--for` is not specified, the JSON output is byte-for-byte identical to v2.2.x.

## Merge-twice detection (`--merge-twice`, v2.4.0+)

`--merge-twice` detects pairs of lessons that cover the same theme and should be merged into a single lesson file. Inspired by the "twice-fire merge" concept from [`claude-smart`](https://github.com/ReflexioAI/claude-smart) — when a lesson is recorded twice on the same theme, it's a signal to consolidate.

```bash
# Detect merge candidates in the lessons directory
claude-skill-loop --merge-twice ~/.claude/lessons

# Tighten the new-lesson window to the last 7 days
claude-skill-loop --merge-twice --days 7 ~/.claude/lessons

# Machine-readable JSON output
claude-skill-loop --merge-twice --json ~/.claude/lessons
```

**Detection rule**: A pair is flagged as same-theme if **both** conditions hold:
1. **Shared primary tag**: at least 1 category tag matches (category tags are derived dynamically from `dev-lessons.md`, with fallback to the union of all `[tag]` entries).
2. **Keyword Jaccard ≥ 0.20**: keyword sets are extracted from title + first H2 section body, using ASCII-alphanumeric tokens + contiguous CJK spans.

**Scope**: All `(new × new) ∪ (new × existing)` pairs, where "new" = mtime within the last `--days` window (default 30).

**Output (text mode)**:
```
🔗 統合候補検出 (--merge-twice、直近 30 日 vs 既存)
================================================
カテゴリタグ集合: 69 件
新規 lesson: 21 件 / 全 lesson: 25 件

✅ 統合候補なし
   閾値: 主タグ一致 >= 1 AND キーワード Jaccard >= 0.2
```

**Dry-run only**: This release surfaces candidates but does not modify any files. Use the output to decide which lessons to merge manually. `--execute` mode for real merge is **available since v2.4.5** (see the Phase 2 section below).

**v2.4.1 improvements** (current release): keyword extraction now also picks up contiguous **katakana spans** (2+ chars), so Japanese short-text lesson pairs reach the 0.20 threshold more reliably. **Shared category tags** are also included in the Jaccard numerator and denominator (with a `tag:` prefix to avoid keyword collisions).

**Known limitations (still open)**:
- `--merge-twice` and `--for <project>` are **independent**: when used together, `--for` filtering applies to the other modes (`--analyze` / `--sync` / `--health` / `--map`) but **not** to `--merge-twice`'s pair detection. `--merge-twice` always scans the full `LESSON_FILES` set, regardless of `--for`.

## Apply merge-plan.json (`--apply-plan`, v2.4.4+, Phase 1)

`--apply-plan <path>` reads a `merge-plan.json` (written by `--merge-twice --execute`) and outputs a **dry-run summary** of how each candidate would be processed. Each `candidate.action` field (`merge` / `skip` / `ignore`) is counted and listed.

**Phase 1 (this section)**: validation and summary only — **no files are modified**. Actual merge execution and rollback are implemented in **v2.4.5+ (Phase 2)** — see the next section.

```bash
# 1) Generate merge-plan.json from candidates
claude-skill-loop --merge-twice --execute --no-version-check

# 2) Edit each candidate's "action" field manually (TBD → merge / skip / ignore)
$EDITOR merge-plan.json

# 3) Dry-run the plan to see what would happen
claude-skill-loop --apply-plan ./merge-plan.json

# JSON output for CI
claude-skill-loop --apply-plan ./merge-plan.json --json
```

Example output:

```
📋 merge-plan.json を読み込みました (./merge-plan.json)
   version: 2.4.3
   generated_at: 2026-05-24T08:00:00.000Z
   totalCandidates: 3

📊 サマリ:
   merge: 1 件
   skip: 1 件
   ignore: 1 件

📝 merge 対象 (1 件):
   1. lessons/recent.md ⇐ lessons/old.md (jaccard: 0.42)

⚠️  これは dry-run です。実マージは --execute で実行可能 (v2.4.5+)。
```

**Validation rules**:
- `candidates[].action` must be one of `merge` / `skip` / `ignore`. **`TBD` is rejected** (forces manual review).
- Missing required fields (`version`, `candidates`, `newFile`, `existingFile`, `action`) → exit code 1.
- Malformed JSON or missing file → exit code 1.

**Why phased**: actual merge involves destructive file operations (append / delete / git commit). Phase 1 locks the JSON schema and validation so Phase 2 can safely build on top without re-architecting.

## Execute and Rollback merge-plan.json (`--apply-plan --execute` / `--rollback-plan`, v2.4.5+, Phase 2)

`v2.4.5` adds **actual merge execution** and **rollback** support on top of Phase 1's dry-run.

### Execute (`--apply-plan --execute`)

```bash
# 1) Generate merge-plan.json and edit each candidate's "action" (same as Phase 1)
claude-skill-loop --merge-twice --execute --no-version-check
$EDITOR merge-plan.json

# 2) Execute the merge (destructive!)
claude-skill-loop --apply-plan ./merge-plan.json --execute
```

For each `candidate.action === 'merge'`:
- `existingFile` is backed up to `./.apply-plan-backup/{stamp}/backup/{uuid}.md`
- `newFile` is moved to `./.apply-plan-backup/{stamp}/moved/{uuid}.md`
- `newFile` content is appended to `existingFile` with separator `\n\n---\n\n`
- A `restore-manifest.json` is written into the same backup directory

`skip` / `ignore` actions are logged but no files are modified.

### Rollback (`--rollback-plan`)

```bash
# Restore the state before --execute (uses the backup directory created above)
claude-skill-loop --rollback-plan ./.apply-plan-backup/20260524_220530_847_12345
```

Rollback restores every `existingFile` and `newFile` to its original content using the backup. The manifest's `rolled_back_at` field is updated, and **the same backup directory cannot be rolled back twice** (exit 1 on retry).

### Recommended `.gitignore`

The backup directory contains lessons content snapshots; do not commit it.

```gitignore
.apply-plan-backup/
```

### Safety

- `--apply-plan` and `--rollback-plan` cannot be combined with each other or with `--sync` / `--health` / `--map` / `--all` / `--merge-twice` (exit 1).
- Manifest `version: "1.0"` allows future migration.
- Paths in `merge-plan.json` are normalised to absolute paths at execute time, so rollback works regardless of CWD.

## Lesson File Format

Lessons are markdown files with tagged headings:

```markdown
### Rate Limiting `[api]` `[auth]`
- **Always check rate limit headers**: X-RateLimit-Remaining tells you...
- **Implement exponential backoff**: Start at 1s, double each retry...
```

Tags in `[brackets]` are the key. When the same tag appears in 3+ headings, the tool proposes creating a skill (checklist) for that pattern.

## Skill Format

Skills are Claude Code compatible checklists:

```markdown
---
name: api-checklist
description: API integration checklist based on past lessons.
---

# API Integration Checklist

- [ ] **Rate limit handling**: Check X-RateLimit-Remaining
- [ ] **API keys in env vars**: No hardcoded secrets
```

Skills named `*-checklist` are automatically detected by `--sync` and `--health`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LESSON_SKILL_LESSONS_DIR` | `./examples/lessons` | Path to lesson files (single directory) |
| `LESSON_SKILL_SCAN_PATHS` | (uses `LESSONS_DIR`) | Comma-separated paths to scan (files and/or directories) |
| `LESSON_SKILL_SKILLS_DIR` | `~/.claude/skills` | Path to skill directories |
| `CLAUDE_SKILLS_DIR` | `~/.claude/skills` | Fallback for skills directory |

### Multiple Scan Paths

If your lessons are spread across multiple files/directories, use `LESSON_SKILL_SCAN_PATHS`:

```bash
# Scan both a directory and a standalone file
LESSON_SKILL_SCAN_PATHS="memory/lessons/,memory/dev-lessons.md" claude-skill-loop

# Scan multiple directories
LESSON_SKILL_SCAN_PATHS="lessons/,retrospectives/,postmortems/" claude-skill-loop
```

Each path can be a directory (scans `*.md` files) or a single `.md` file.

## JSON Output

Use `--json` for scripting or CI integration:

```bash
claude-skill-loop --json --all examples/lessons | jq '.analyze.candidates'
```

## How It Works with Claude Code

1. **You work** — bugs happen, lessons are recorded in `lessons/*.md` with tags
2. **Run the tool** — `claude-skill-loop --all` shows what patterns repeat
3. **Create skills** — use `/skill-creator` in Claude Code to turn proposals into skills
4. **Skills improve** — `--sync` detects new lessons that should update existing skills
5. **Skills retire** — `--health` flags skills with weak evidence or stale content

### Register as a Slash Command

Create `~/.claude/commands/skill-loop.md` to use `/skill-loop` directly in Claude Code:

```markdown
# Lesson-Skill Feedback Loop

Run the following command:

\`\`\`bash
npx claude-skill-loop --all --dir /path/to/your/lessons --skills-dir ~/.claude/skills
\`\`\`
```

Then in Claude Code:

```
/skill-loop          # Run all modes
/skill-loop analyze  # Tag analysis only
/skill-loop health   # Health check only
```

### Plugin Structure (commands/)

The `commands/` directory contains ready-to-use Claude Code slash command definitions:

| File | Slash command | Description |
|------|---------------|-------------|
| `commands/skill-loop.md` | `/skill-loop` | Run all modes (analyze + sync + health + map) |
| `commands/skill-loop-health.md` | `/skill-loop-health` | Health check only |
| `commands/skill-loop-sync.md` | `/skill-loop-sync` | Sync check only |

Copy any of these to `~/.claude/commands/` and customize the paths for your setup.

## Claude Cowork Support

This tool also works in **Claude Cowork** (browser-based collaboration) where Bash is not available.

The `skills/skill-loop/SKILL.md` contains instructions for Claude to perform the same analysis using built-in tools (Read, Glob, Grep) instead of running Node.js. All four modes (analyze, sync, health, map) are supported.

### Important limitation

Cowork can only access files within the current project. The skill works **only when lesson files (`lessons/*.md`) exist inside the project repository**. If your lessons are stored locally (e.g., `~/.claude/memory/lessons/`), use the CLI version (`npx claude-skill-loop`) instead.

### Setup for Cowork

#### 1. Clone or download

```bash
git clone https://github.com/aliksir/lesson-skill-loop.git
```

Or download the ZIP from the [Releases](https://github.com/aliksir/lesson-skill-loop/releases) page.

#### 2. Copy the skills to your Claude skills directory

```bash
cp -r lesson-skill-loop/skills/skill-loop ~/.claude/skills/
cp -r lesson-skill-loop/skills/lesson ~/.claude/skills/
```

This installs two skills:
- `~/.claude/skills/skill-loop/SKILL.md` — analyze lessons and propose skills
- `~/.claude/skills/lesson/SKILL.md` — record lessons with tags

#### 3. Verify installation

In a Claude Cowork session, type:

```
/lesson [test] This is a test lesson
/lesson list
/skill-loop
```

#### 4. The full loop in Cowork

```
/lesson [api] Rate limit headers must be checked     ← Record
/lesson [api] Always use exponential backoff          ← Record more
/lesson tags                                          ← Check tag frequency
/skill-loop                                           ← Analyze → skill candidates
```

No lesson files needed upfront — `/lesson` creates `lessons/dev-lessons.md` automatically.

### Cowork vs CLI comparison

| Feature | CLI (`npx claude-skill-loop`) | Cowork (`/skill-loop`) |
|---------|-------------------------------|------------------------|
| Analyze mode | ✅ | ✅ |
| Sync mode | ✅ | ✅ |
| Health mode | ✅ | ✅ (file dates may show "unknown") |
| Map mode | ✅ | ✅ |
| JSON output | ✅ `--json` | ❌ (not needed in Cowork) |
| Self-update | ✅ `--self-update` | ❌ (re-copy SKILL.md to update) |
| Custom threshold | ✅ `--threshold N` | ❌ (fixed at 3) |
| Speed | Fast (native Node.js) | Slower (Claude reads files one by one) |

## Migrating from Bash version

The Bash version (`lesson-skill-check.sh`) was removed in v2.2.0. If you were using it, switch to the Node.js version — the commands are identical:

```bash
# Before (Bash)
bash lesson-skill-check.sh --all

# After (Node.js)
claude-skill-loop --all
```

All flags (`--sync`, `--health`, `--map`, `--all`) work the same way. The Node.js version adds `--json`, `--threshold`, `--dir`, `--skills-dir`, and `--self-update`.

## Inspired By

- [EvoSkill](https://arxiv.org/abs/2603.02766) — Automated skill discovery for multi-agent systems
- [Neko Gundan](https://github.com/aliksir/neko-gundan) — Multi-agent orchestration for Claude Code

## License

MIT
