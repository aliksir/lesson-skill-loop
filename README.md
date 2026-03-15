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

## Migrating from Bash version

If you used `lesson-skill-check.sh` before, the Node.js version is a drop-in replacement with the same output format:

| Bash | Node.js |
|------|---------|
| `bash lesson-skill-check.sh [dir]` | `claude-skill-loop [dir]` |
| `bash lesson-skill-check.sh --sync` | `claude-skill-loop --sync` |
| `bash lesson-skill-check.sh --health` | `claude-skill-loop --health` |
| `bash lesson-skill-check.sh --map` | `claude-skill-loop --map` |
| `bash lesson-skill-check.sh --all` | `claude-skill-loop --all` |

The Bash version (`lesson-skill-check.sh`) is still included for backward compatibility.

**New in v2:**
- `--json` flag for structured output
- `--threshold <n>` to customize the skill proposal threshold
- `--dir` and `--skills-dir` flags
- Cross-platform (Windows/macOS/Linux) — no bash required
- Zero dependencies (Node.js 18+ built-ins only)

## Inspired By

- [EvoSkill](https://arxiv.org/abs/2603.02766) — Automated skill discovery for multi-agent systems
- [Neko Gundan](https://github.com/aliksir/neko-gundan) — Multi-agent orchestration for Claude Code

## License

MIT
