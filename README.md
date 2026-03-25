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

| Mode | Command | What it does |
|------|---------|-------------|
| **Analyze** | `claude-skill-loop [dir]` | Count tags, propose skills for patterns appearing 3+ times |
| **Sync** | `claude-skill-loop --sync [dir]` | Compare existing skills with lessons, find unreflected entries |
| **Health** | `claude-skill-loop --health [dir]` | Check skill freshness and evidence strength |
| **Map** | `claude-skill-loop --map [dir]` | Full traceability: which lessons back which skills (with full text) |
| **All** | `claude-skill-loop --all [dir]` | Run all modes |

## Options

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format (for scripting / CI integration) |
| `--dir <path>` | Specify lessons directory (alternative to positional arg) |
| `--skills-dir <path>` | Specify skills directory |
| `--threshold <n>` | Skill proposal threshold, default: `3` |

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

### Setup for Cowork

#### 1. Clone or download

```bash
git clone https://github.com/aliksir/lesson-skill-loop.git
```

Or download the ZIP from the [Releases](https://github.com/aliksir/lesson-skill-loop/releases) page.

#### 2. Copy the skill to your Claude skills directory

```bash
cp -r lesson-skill-loop/skills/skill-loop ~/.claude/skills/
```

This places `SKILL.md` at `~/.claude/skills/skill-loop/SKILL.md`.

#### 3. Verify installation

In a Claude Cowork session, type:

```
/skill-loop
```

Claude will detect the skill and run the analysis using built-in tools.

#### 4. Prepare your lesson files

Place your lesson markdown files in one of these default locations (or specify a path when invoking):

- `./lessons/` (current project directory)
- `./memory/lessons/` (Claude memory directory)

Lesson files should use the tag format described in [Lesson File Format](#lesson-file-format).

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
